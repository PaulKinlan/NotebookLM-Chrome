/**
 * Reconciler - Mount Operations
 *
 * Handles initial mounting of VNodes to the DOM.
 * Functions accept reconcile as a parameter to avoid circular dependencies.
 */

import type { VNode } from '../vnode.ts'
import type { ComponentInstance } from '../component.ts'
import type { ReconcilerFn } from './reconciler-types.ts'
import { mountedNodes } from '../reconciler.ts'
import { applyProps } from './reconciler-props.ts'
import * as componentModule from '../component.ts'

/**
 * Mount a new VNode to the DOM
 */
export async function mount(
  parent: Node,
  vnode: VNode,
  component: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
): Promise<Node> {
  switch (vnode.type) {
    case 'text': {
      const node = document.createTextNode(vnode.value)
      mountedNodes.set(node, { node, vdom: vnode })
      parent.appendChild(node)
      return node
    }

    case 'element': {
      return mountElement(parent, vnode, reconcile)
    }

    case 'component': {
      return mountComponent(parent, vnode, component, reconcile)
    }

    case 'fragment': {
      return mountFragment(parent, vnode, component, reconcile)
    }

    default:
      return parent.appendChild(document.createTextNode(''))
  }
}

/**
 * Mount an element VNode
 */
export function mountElement(
  parent: Node,
  vnode: Extract<VNode, { type: 'element' }>,
  reconcile: ReconcilerFn,
): Element {
  const { tag, props, children } = vnode

  // Handle SVG namespace
  const namespace = tag === 'svg' ? 'http://www.w3.org/2000/svg/svg' : null
  const el = namespace ? document.createElementNS(namespace, tag) : document.createElement(tag)

  // Debug logging for form elements
  if (tag === 'form') {
    console.log('[mountElement] Creating form element with props:', props)
    console.log('[mountElement] Form has onSubmit?', typeof props.onSubmit === 'function')
  }

  // Apply props (attributes, event listeners, style)
  applyProps(el, props)

  // Recursively mount children
  for (const child of children) {
    void reconcile(el, null, child)
  }

  parent.appendChild(el)

  mountedNodes.set(el, { node: el, vdom: vnode })
  return el
}

/**
 * Mount a component VNode
 */
export async function mountComponent(
  parent: Node,
  vnode: Extract<VNode, { type: 'component' }>,
  parentComponent: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
): Promise<Node> {
  const { fn, props } = vnode

  // Create component instance
  const instance = componentModule.createComponentInstance(fn, props, parentComponent)

  // Check if this is an ErrorBoundary component
  if ((fn as { __isErrorBoundary?: boolean }).__isErrorBoundary) {
    instance.isErrorBoundary = true
    instance.errorBoundaryProps = {
      fallback: (props as { fallback?: (error: Error) => VNode | Node }).fallback,
      onError: (props as { onError?: (error: Error, errorInfo: { componentStack?: string }) => void }).onError,
    }
  }

  // Create a container node for this component
  const container = document.createComment('')
  parent.appendChild(container)

  // Store instance info
  instance.mountedNode = container
  mountedNodes.set(container, { node: container, vdom: vnode, component: instance })

  // Render the component
  await renderComponent(instance, reconcile)

  return instance.mountedNode
}

/**
 * Mount a fragment VNode
 */
export function mountFragment(
  parent: Node,
  vnode: Extract<VNode, { type: 'fragment' }>,
  component: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
): Node {
  for (const child of vnode.children) {
    void reconcile(parent, null, child, component)
  }

  // Fragments don't have a single DOM node, return parent for chaining
  return parent
}

/**
 * Re-render a component instance
 * This is called by the scheduler when state changes
 */
export async function renderComponent(instance: ComponentInstance, reconcile: ReconcilerFn): Promise<void> {
  if (instance.isUnmounted) {
    return
  }

  // Handle error boundary state - if there's an error, render fallback
  if (instance.isErrorBoundary && instance.errorState) {
    const error = instance.errorState
    const fallback = instance.errorBoundaryProps?.fallback

    let newVNode: VNode
    if (fallback) {
      try {
        const result = fallback(error)
        newVNode = normalizeVNode(result)
      }
      catch {
        newVNode = { type: 'text', value: `Error: ${error.message}` }
      }
    }
    else {
      // Default fallback UI
      newVNode = {
        type: 'element',
        tag: 'div',
        props: { className: 'error-boundary' },
        children: [
          { type: 'element', tag: 'h3', props: {}, children: [{ type: 'text', value: 'Something went wrong' }] },
          { type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: error.message }] },
        ],
      }
    }

    // Update with fallback content
    instance.currentVNode = newVNode
    const oldNode = instance.mountedNode
    const oldVNode = instance.currentVNode

    if (!oldNode || !oldNode.parentNode) {
      return
    }

    const parent = oldNode.parentNode
    await reconcile(parent, oldVNode, newVNode, instance)
    return
  }

  // Set current component for hooks
  componentModule.setCurrentComponent(instance)

  // Reset hook index for new render
  componentModule.resetHookIndex(instance)

  // Get the previous mounted node and vnode
  const oldNode = instance.mountedNode
  const oldVNode = instance.currentVNode

  // Run component function to get new vnode
  let newVNode: VNode
  try {
    const result = instance.fn(instance.props)
    // Wrap raw Node in a text VNode if needed
    newVNode = normalizeVNode(result)

    // Reset error state on successful render
    componentModule.resetErrorState(instance)
  }
  catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))

    // Try to find an error boundary to handle this error
    const captured = componentModule.captureError(instance, errorObj)

    if (captured) {
      // Error was captured by an error boundary
      componentModule.setCurrentComponent(null)
      return
    }

    // No error boundary found - log error and render empty
    const componentName = instance.fn.name || 'Anonymous'
    console.error(`Error rendering component "${componentName}" (no error boundary):`, errorObj.message, errorObj.stack)
    newVNode = { type: 'text', value: '' }
  }

  // Store new vnode
  instance.currentVNode = newVNode

  // Clear current component
  componentModule.setCurrentComponent(null)

  // Reconcile the new tree
  if (!oldNode || !oldNode.parentNode) {
    // No parent - can't update
    return
  }

  const parent = oldNode.parentNode

  // If old node was a comment (component placeholder), we need to handle specially
  if (oldNode.nodeType === Node.COMMENT_NODE) {
    // Create a fragment to hold the new content
    const tempContainer = document.createDocumentFragment()

    // Mount the new vnode to temp container
    await reconcile(tempContainer, oldVNode, newVNode, instance)

    // Replace the placeholder with the new content
    parent.replaceChild(tempContainer, oldNode)

    // Update instance's mounted node to point to the first real child
    instance.mountedNode = tempContainer.firstChild || parent.firstChild

    // CRITICAL: Update mountedNodes WeakMap with the new node
    // The old comment node is gone, so we need to map the new node to the instance
    if (instance.mountedNode) {
      mountedNodes.set(instance.mountedNode, {
        node: instance.mountedNode,
        vdom: newVNode,
        component: instance,
      })
    }
  }
  else {
    // Normal reconcile
    await reconcile(parent, oldVNode, newVNode, instance)

    // Update mountedNodes in case the node reference changed
    if (instance.mountedNode) {
      mountedNodes.set(instance.mountedNode, {
        node: instance.mountedNode,
        vdom: newVNode,
        component: instance,
      })
    }
  }
}

/**
 * Normalize a value to a VNode
 * Handles raw DOM nodes and converts them to VNodes
 */
export function normalizeVNode(value: VNode | Node): VNode {
  // If it's already a VNode, return as-is
  if (value && typeof value === 'object' && 'type' in value) {
    return value
  }

  // Convert DOM Node to a wrapper VNode
  if (value instanceof Node) {
    return {
      type: 'text',
      value: value.nodeType === Node.TEXT_NODE ? value.textContent || '' : '',
    }
  }

  // Convert primitives to text VNode
  return {
    type: 'text',
    value: String(value ?? ''),
  }
}

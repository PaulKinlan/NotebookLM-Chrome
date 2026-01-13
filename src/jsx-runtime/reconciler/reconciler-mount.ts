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
import { markRendering, markRenderComplete } from '../scheduler.ts'
import { registerComponentInstance } from './reconciler-update.ts'

// Track mount depth to detect infinite loops
let mountDepth = 0
const MAX_MOUNT_DEPTH = 1000 // Increased for very complex UI trees with nested components

// Track active mount operations to detect cycles
const activeMountStack: string[] = []

/**
 * Mount a new VNode to the DOM
 */
export async function mount(
  parent: Node,
  vnode: VNode,
  component: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
  svgNamespace?: string,
): Promise<Node> {
  // Create a unique key for this mount operation
  const vnodeInfo = vnode.type === 'element'
    ? `<${vnode.tag}>`
    : vnode.type === 'component'
      ? `Component(${(vnode.fn as { name?: string }).name || 'Anonymous'})`
      : vnode.type === 'text'
        ? `Text("${String(vnode.value ?? '').slice(0, 20)}")`
        : vnode.type

  mountDepth++
  activeMountStack.push(vnodeInfo)

  if (mountDepth > MAX_MOUNT_DEPTH) {
    console.error('[mount] Maximum mount depth exceeded!')
    console.error('[mount] Stack trace:', activeMountStack.join(' → '))
    mountDepth = 0
    activeMountStack.length = 0
    return parent.appendChild(document.createTextNode(''))
  }

  try {
    return await mountInner(parent, vnode, component, reconcile, svgNamespace)
  }
  finally {
    activeMountStack.pop()
    mountDepth--
  }
}

async function mountInner(
  parent: Node,
  vnode: VNode,
  component: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
  svgNamespace?: string,
): Promise<Node> {
  switch (vnode.type) {
    case 'text': {
      const node = document.createTextNode(vnode.value)
      mountedNodes.set(node, { node, vdom: vnode })
      parent.appendChild(node)
      return node
    }

    case 'element': {
      return mountElement(parent, vnode, reconcile, svgNamespace)
    }

    case 'component': {
      return mountComponent(parent, vnode, component, reconcile, svgNamespace)
    }

    case 'fragment': {
      return mountFragment(parent, vnode, component, reconcile, svgNamespace)
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
  svgNamespace: string | null = null,
): Element {
  const { tag, props, children } = vnode

  // Handle SVG namespace - check if we're explicitly in SVG context or creating an svg element
  const isInSvg = svgNamespace === 'http://www.w3.org/2000/svg'
  const namespace = tag === 'svg' || isInSvg ? 'http://www.w3.org/2000/svg' : null
  const el = namespace ? document.createElementNS(namespace, tag) : document.createElement(tag)

  // For <select> elements, we need to mount children BEFORE applying props.
  // This is because setting the 'value' prop requires the option to exist in the DOM.
  if (tag === 'select') {
    // Pass SVG namespace context to children
    const childNamespace = namespace || undefined
    for (const child of children) {
      void reconcile(el, null, child, undefined, childNamespace)
    }
    // Apply props after children are mounted
    applyProps(el, props)
  }
  else {
    // Normal order: props first, then children
    applyProps(el, props)

    // Recursively mount children
    const childNamespace = namespace || undefined
    for (const child of children) {
      void reconcile(el, null, child, undefined, childNamespace)
    }
  }

  // Append the element to the parent
  // Handle edge case where parent is a DocumentFragment that's already been inserted
  // into the DOM (via replaceChild), in which case we need to append to the fragment's parent
  try {
    if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE && parent.parentNode) {
      // DocumentFragment that's already in the DOM - append to its parent instead
      parent.parentNode.appendChild(el)
    }
    else {
      parent.appendChild(el)
    }
  }
  catch (e) {
    console.error(`[mountElement] Failed to append <${tag}> to parent:`, parent, `parent.nodeType:`, parent.nodeType, `parent.nodeName:`, parent.nodeName, `error:`, e)
    throw e
  }

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
  svgNamespace?: string,
): Promise<Node> {
  const { fn, props } = vnode

  // Create component instance
  const instance = componentModule.createComponentInstance(fn, props, parentComponent)

  // Store SVG namespace for this component (persists across renders)
  instance.svgNamespace = svgNamespace

  // Register this instance IMMEDIATELY and SYNCHRONOUSLY
  // This ensures the instance is available for lookup before any state updates are scheduled
  registerComponentInstance(fn, instance)

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
  svgNamespace?: string,
): Node {
  // Mount all children
  for (const child of vnode.children) {
    void reconcile(parent, null, child, component, svgNamespace)
  }

  // Fragments don't have a single DOM node, return parent for chaining
  return parent
}

// Track render depth to detect infinite loops
let renderDepth = 0
const MAX_RENDER_DEPTH = 1000 // Increased for very complex UI trees with nested components

/**
 * Reset the render depth counter
 * Called by the scheduler at the start of each flush to prevent depth
 * from accumulating across multiple RAF cycles.
 */
export function resetRenderDepth(): void {
  renderDepth = 0
}

/**
 * Re-render a component instance
 * This is called by the scheduler when state changes
 */
export async function renderComponent(instance: ComponentInstance, reconcile: ReconcilerFn): Promise<void> {
  if (instance.isUnmounted) {
    return
  }

  // Mark this component as currently rendering to prevent re-entry
  markRendering(instance)

  const compName = instance.fn.name || 'Anonymous'
  renderDepth++

  if (renderDepth > MAX_RENDER_DEPTH) {
    console.error('[renderComponent] Maximum render depth exceeded! Component:', compName, 'Stack:', new Error().stack)
    renderDepth = 0
    markRenderComplete(instance)
    return
  }

  try {
    await renderComponentInner(instance, reconcile)
  }
  finally {
    renderDepth--
    markRenderComplete(instance)
  }
}

async function renderComponentInner(instance: ComponentInstance, reconcile: ReconcilerFn): Promise<void> {
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
    await reconcile(parent, oldVNode, newVNode, instance, instance.svgNamespace)
    return
  }

  // Set current component for hooks
  componentModule.setCurrentComponent(instance)

  // Reset hook index for new render
  componentModule.resetHookIndex(instance)

  // Get the previous mounted node and vnode
  let oldNode = instance.mountedNode
  const oldVNode = instance.currentVNode

  // SPECIAL CASE: For Fragment-returning components, instance.mountedNode points to the parent.
  // We need to find the first actual DOM element child to use for reconciliation.
  if (oldVNode?.type === 'fragment' && oldNode?.nodeType === Node.ELEMENT_NODE) {
    const firstChild = (oldNode as Element).firstElementChild
    if (firstChild) {
      oldNode = firstChild
    }
  }

  // Run component function to get new vnode
  let newVNode: VNode
  try {
    const result = instance.fn(instance.props)
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
  console.log(`[renderComponent] Reconcile: oldNode=${oldNode?.nodeName}, oldNode.nodeType=${oldNode?.nodeType}, oldNode.parentNode=${oldNode?.parentNode?.nodeName}`)

  // For Fragment-returning components, oldNode might be the parent container with no parentNode
  // In this case, use oldNode as the parent and find the first actual child element
  if (
    oldNode
    && !oldNode.parentNode
    && oldVNode?.type === 'fragment'
    && oldNode.nodeType === Node.ELEMENT_NODE
  ) {
    const parent = oldNode
    const firstElementChild = (parent as Element).firstElementChild

    if (!firstElementChild) {
      // No children yet, mount the new fragment
      await reconcile(parent, oldVNode, newVNode, instance, instance.svgNamespace)

      // Update mountedNodes
      mountedNodes.set(parent, {
        node: parent,
        vdom: newVNode,
        component: instance,
      })
      return
    }

    // Find the mounted data for the first child to use as oldVNode for its children
    const firstChildData = mountedNodes.get(firstElementChild)
    const oldChildrenVNode = firstChildData?.vdom || oldVNode

    await reconcile(parent, oldChildrenVNode, newVNode, instance, instance.svgNamespace)

    // Update mountedNodes
    mountedNodes.set(parent, {
      node: parent,
      vdom: newVNode,
      component: instance,
    })
    return
  }

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
    await reconcile(tempContainer, oldVNode, newVNode, instance, instance.svgNamespace)

    // Replace the placeholder with the new content
    parent.replaceChild(tempContainer, oldNode)

    // CRITICAL: For Fragment-returning components, keep mountedNode pointing to parent
    // instead of firstChild. This ensures we can find all children during reconciliation.
    if (newVNode.type === 'fragment') {
      instance.mountedNode = parent
    }
    else {
      instance.mountedNode = tempContainer.firstChild || parent.firstChild
    }

    // CRITICAL: Update mountedNodes WeakMap with the new node
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
    await reconcile(parent, oldVNode, newVNode, instance, instance.svgNamespace)

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

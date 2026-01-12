/**
 * Virtual DOM Reconciliation Engine
 *
 * Diffs two virtual DOM trees and applies minimal patches to the actual DOM.
 * This is the heart of the re-rendering system.
 */

import type { VNode, MountedNode } from './vnode.ts'
import type { ComponentInstance } from './component.ts'
import { setRenderCallback } from './scheduler.ts'

// Lazy imports to avoid circular dependency
let componentModule: typeof import('./component.ts') | null = null

async function getComponentModule() {
  if (!componentModule) {
    componentModule = await import('./component.ts')
  }
  return componentModule
}

/**
 * Map to track mounted DOM nodes back to their VNodes
 * Used for re-rendering components
 */
export const mountedNodes = new WeakMap<Node, MountedNode>()

// Initialize the render callback for the scheduler
setRenderCallback((component) => {
  void renderComponent(component)
})

/**
 * Diff two VNodes and apply patches to the DOM
 *
 * @param parent - The parent DOM node
 * @param oldVNode - The previous virtual node (null for initial mount)
 * @param newVNode - The new virtual node to render
 * @param component - The component instance (if rendering a component)
 * @returns The DOM node that was rendered/updated
 */
export async function reconcile(
  parent: Node,
  oldVNode: VNode | null,
  newVNode: VNode,
  component?: ComponentInstance,
): Promise<Node> {
  // Case 1: No old node - initial mount
  if (!oldVNode) {
    return mount(parent, newVNode, component)
  }

  // Case 2: Type changed - replace entirely
  if (oldVNode.type !== newVNode.type) {
    const newNode = await mount(parent, newVNode, component)
    const oldNode = parent.firstChild
    if (oldNode) {
      parent.replaceChild(newNode, oldNode)
    }
    else {
      parent.appendChild(newNode)
    }
    return newNode
  }

  // Case 3: Same type - update in place (both old and new have same type)
  if (newVNode.type === 'text' && oldVNode.type === 'text') {
    if (oldVNode.value !== newVNode.value) {
      parent.textContent = newVNode.value
    }
    return parent.firstChild!
  }

  if (newVNode.type === 'element' && oldVNode.type === 'element') {
    return updateElement(parent as Element, oldVNode, newVNode)
  }

  if (newVNode.type === 'component' && oldVNode.type === 'component') {
    return updateComponent(parent, oldVNode, newVNode)
  }

  if (newVNode.type === 'fragment' && oldVNode.type === 'fragment') {
    return updateFragment(parent, oldVNode, newVNode, component)
  }

  return parent.firstChild!
}

/**
 * Mount a new VNode to the DOM
 */
async function mount(parent: Node, vnode: VNode, component?: ComponentInstance): Promise<Node> {
  switch (vnode.type) {
    case 'text': {
      const node = document.createTextNode(vnode.value)
      mountedNodes.set(node, { node, vdom: vnode })
      parent.appendChild(node)
      return node
    }

    case 'element': {
      return mountElement(parent, vnode)
    }

    case 'component': {
      return mountComponent(parent, vnode, component)
    }

    case 'fragment': {
      return mountFragment(parent, vnode, component)
    }

    default:
      return parent.appendChild(document.createTextNode(''))
  }
}

/**
 * Mount an element VNode
 */
function mountElement(parent: Node, vnode: Extract<VNode, { type: 'element' }>): Element {
  const { tag, props, children } = vnode

  // Handle SVG namespace
  const namespace = tag === 'svg' ? 'http://www.w3.org/2000/svg/svg' : null
  const el = namespace ? document.createElementNS(namespace, tag) : document.createElement(tag)

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
async function mountComponent(
  parent: Node,
  vnode: Extract<VNode, { type: 'component' }>,
  parentComponent?: ComponentInstance,
): Promise<Node> {
  const mod = await getComponentModule()
  const { fn, props } = vnode

  // Create component instance
  const instance = mod.createComponentInstance(fn, props, parentComponent)

  // Create a container node for this component
  const container = document.createComment('')
  parent.appendChild(container)

  // Store instance info
  instance.mountedNode = container
  mountedNodes.set(container, { node: container, vdom: vnode, component: instance })

  // Render the component
  await renderComponent(instance)

  // Return the component's rendered content
  return instance.mountedNode
}

/**
 * Mount a fragment VNode
 */
function mountFragment(
  parent: Node,
  vnode: Extract<VNode, { type: 'fragment' }>,
  component?: ComponentInstance,
): Node {
  for (const child of vnode.children) {
    void reconcile(parent, null, child, component)
  }

  // Fragments don't have a single DOM node, return parent for chaining
  return parent
}

/**
 * Update an element VNode (diff props and children)
 */
function updateElement(
  parent: Element,
  oldVNode: Extract<VNode, { type: 'element' }>,
  newVNode: Extract<VNode, { type: 'element' }>,
): Node {
  const el = parent.firstChild as Element

  // Diff props
  diffProps(el, oldVNode.props, newVNode.props)

  // Diff children
  void diffChildren(el, oldVNode.children, newVNode.children)

  // Update mounted node reference
  mountedNodes.set(el, { node: el, vdom: newVNode })

  return el
}

/**
 * Update a component VNode (re-run component function)
 */
async function updateComponent(
  parent: Node,
  oldVNode: Extract<VNode, { type: 'component' }>,
  newVNode: Extract<VNode, { type: 'component' }>,
): Promise<Node> {
  const mod = await getComponentModule()

  // Check if it's the same component function
  if (oldVNode.fn !== newVNode.fn) {
    // Different component - replace entirely
    const newNode = await mountComponent(parent, newVNode)
    const oldNode = parent.firstChild
    if (oldNode) {
      // Cleanup old component
      const mounted = mountedNodes.get(oldNode)
      if (mounted?.component) {
        mod.unmountComponent(mounted.component)
      }
      parent.replaceChild(newNode, oldNode)
    }
    return newNode
  }

  // Same component - check if we have an instance
  const instance = mountedNodes.get(parent.firstChild!)?.component
  if (!instance) {
    // No instance - create new
    return mountComponent(parent, newVNode)
  }

  // Update props and re-render
  instance.props = newVNode.props
  await renderComponent(instance)

  return instance.mountedNode!
}

/**
 * Re-render a component instance
 * This is called by the scheduler when state changes
 */
export async function renderComponent(instance: ComponentInstance): Promise<void> {
  const mod = await getComponentModule()

  if (instance.isUnmounted) {
    return
  }

  // Set current component for hooks
  mod.setCurrentComponent(instance)

  // Reset hook index for new render
  mod.resetHookIndex(instance)

  // Get the previous mounted node and vnode
  const oldNode = instance.mountedNode
  const oldVNode = instance.currentVNode

  // Run component function to get new vnode
  let newVNode: VNode
  try {
    const result = instance.fn(instance.props)
    // Wrap raw Node in a text VNode if needed
    newVNode = normalizeVNode(result)
  }
  catch (error) {
    console.error('Error rendering component:', error)
    newVNode = { type: 'text', value: '' }
  }

  // Store new vnode
  instance.currentVNode = newVNode

  // Clear current component
  mod.setCurrentComponent(null)

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
  }
  else {
    // Normal reconcile
    await reconcile(parent, oldVNode, newVNode, instance)
  }
}

/**
 * Update a fragment VNode
 */
async function updateFragment(
  parent: Node,
  oldVNode: Extract<VNode, { type: 'fragment' }>,
  newVNode: Extract<VNode, { type: 'fragment' }>,
  component?: ComponentInstance,
): Promise<Node> {
  // For fragments, we need to diff children in place
  await diffChildren(parent, oldVNode.children, newVNode.children, component)
  return parent
}

/**
 * Apply props to a DOM element
 */
function applyProps(el: Element, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key') continue

    // Event handlers (onClick, onChange, etc.)
    if (key.startsWith('on')) {
      const eventType = key.slice(2).toLowerCase()
      if (typeof value === 'function') {
        el.addEventListener(eventType, value as EventListener)
      }
      continue
    }

    // Style object
    if (key === 'style' && typeof value === 'object') {
      Object.assign((el as HTMLElement).style, value)
      continue
    }

    // Class name
    if (key === 'className') {
      el.setAttribute('class', String(value))
      continue
    }

    // Boolean attributes
    if (value === false || value === null || value === undefined) {
      el.removeAttribute(key)
    }
    else if (value === true) {
      el.setAttribute(key, '')
    }
    else if (typeof value === 'string' || typeof value === 'number') {
      el.setAttribute(key, String(value))
    }
  }
}

/**
 * Diff props between old and new VNode
 */
function diffProps(el: Element, oldProps: Record<string, unknown>, newProps: Record<string, unknown>): void {
  // Remove old props
  for (const key of Object.keys(oldProps)) {
    if (key !== 'children' && key !== 'key' && !(key in newProps)) {
      if (key.startsWith('on')) {
        const eventType = key.slice(2).toLowerCase()
        if (typeof oldProps[key] === 'function') {
          el.removeEventListener(eventType, oldProps[key] as EventListener)
        }
      }
      else if (key === 'className') {
        el.removeAttribute('class')
      }
      else {
        el.removeAttribute(key)
      }
    }
  }

  // Apply new/changed props
  for (const key of Object.keys(newProps)) {
    if (key !== 'children' && key !== 'key' && newProps[key] !== oldProps[key]) {
      const value = newProps[key]

      if (key.startsWith('on')) {
        const eventType = key.slice(2).toLowerCase()
        // Remove old listener
        if (typeof oldProps[key] === 'function') {
          el.removeEventListener(eventType, oldProps[key] as EventListener)
        }
        // Add new listener
        if (typeof value === 'function') {
          el.addEventListener(eventType, value as EventListener)
        }
      }
      else if (key === 'style' && typeof value === 'object') {
        // Clear old styles
        ;(el as HTMLElement).style.cssText = ''
        // Apply new styles
        Object.assign((el as HTMLElement).style, value)
      }
      else if (key === 'className') {
        el.setAttribute('class', String(value))
      }
      else if (value === false || value === null || value === undefined) {
        el.removeAttribute(key)
      }
      else if (value === true) {
        el.setAttribute(key, '')
      }
      else if (typeof value === 'string' || typeof value === 'number') {
        el.setAttribute(key, String(value))
      }
    }
  }
}

/**
 * Diff children between old and new VNode
 */
async function diffChildren(
  parent: Node,
  oldChildren: VNode[],
  newChildren: VNode[],
  component?: ComponentInstance,
): Promise<void> {
  const oldLen = oldChildren.length
  const newLen = newChildren.length
  const maxLen = Math.max(oldLen, newLen)

  // Simple diff algorithm - iterate and reconcile
  // A production system would use React's key-based diffing
  for (let i = 0; i < maxLen; i++) {
    const oldChild = oldChildren[i]
    const newChild = newChildren[i]

    if (!oldChild && newChild) {
      // Mount new child
      await reconcile(parent, null, newChild, component)
    }
    else if (oldChild && !newChild) {
      // Remove old child
      if (i < parent.childNodes.length) {
        const childNode = parent.childNodes[i]
        const mounted = mountedNodes.get(childNode)
        const mod = await getComponentModule()
        if (mounted?.component) {
          mod.unmountComponent(mounted.component)
        }
        // Only remove if this node is still a child of the parent
        if (childNode.parentNode === parent) {
          try {
            parent.removeChild(childNode)
          }
          catch (e) {
            // Ignore NotFoundError - node may have been removed already
            if ((e as DOMException).name !== 'NotFoundError') {
              throw e
            }
          }
        }
      }
    }
    else if (oldChild && newChild) {
      // Reconcile existing child
      if (i < parent.childNodes.length) {
        await reconcile(parent.childNodes[i], oldChild, newChild, component)
      }
    }
  }

  // Remove extra children
  while (parent.childNodes.length > newLen) {
    const lastChild = parent.lastChild!
    if (lastChild.parentNode === parent) {
      const mounted = mountedNodes.get(lastChild)
      const mod = await getComponentModule()
      if (mounted?.component) {
        mod.unmountComponent(mounted.component)
      }
      try {
        parent.removeChild(lastChild)
      }
      catch (e) {
        // Ignore NotFoundError - node may have been removed already
        if ((e as DOMException).name !== 'NotFoundError') {
          throw e
        }
      }
    }
  }
}

/**
 * Normalize a value to a VNode
 * Handles raw DOM nodes and converts them to VNodes
 */
function normalizeVNode(value: VNode | Node): VNode {
  // If it's already a VNode, return as-is
  if (value && typeof value === 'object' && 'type' in value) {
    return value
  }

  // Convert DOM Node to a wrapper VNode
  if (value instanceof Node) {
    // For raw DOM nodes, we treat them as opaque
    // Create a wrapper that preserves the node
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

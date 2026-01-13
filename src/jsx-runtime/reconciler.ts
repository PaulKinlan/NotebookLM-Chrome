/**
 * Virtual DOM Reconciliation Engine
 *
 * Main entry point for the reconciliation system.
 * Delegates to specialized modules in the reconciler/ folder.
 */

import type { VNode, MountedNode } from './vnode.ts'
import type { ComponentInstance } from './component.ts'
import { setRenderCallback, setResetRenderDepthCallback } from './scheduler.ts'
import { resetRenderDepth } from './reconciler/reconciler-mount.ts'

// Import from reconciler modules
import {
  mount,
  renderComponent,
} from './reconciler/index.ts'
import {
  updateElement,
  updateComponent,
  updateFragment,
} from './reconciler/index.ts'

// Re-export all functions and types for external use
export * from './reconciler/index.ts'

/**
 * Map to track mounted DOM nodes back to their VNodes
 * This is the single source of truth - imported by other modules
 */
export const mountedNodes = new WeakMap<Node, MountedNode>()

/**
 * Reconcile function - defined here so it can be passed to submodules
 */
async function reconcile(
  parent: Node,
  oldVNode: VNode | null,
  newVNode: VNode,
  component?: ComponentInstance,
): Promise<Node> {
  // Case 1: No old node - initial mount
  if (!oldVNode) {
    return mount(parent, newVNode, component, reconcile)
  }

  // Case 2: Type changed - replace entirely
  if (oldVNode.type !== newVNode.type) {
    const newNode = await mount(parent, newVNode, component, reconcile)
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
    if (parent instanceof Element) {
      return updateElement(parent, oldVNode, newVNode, reconcile)
    }
    // Parent is not an Element (e.g., DocumentFragment), mount new element
    const newNode = await mount(parent, newVNode, component, reconcile)
    const oldNode = parent.firstChild
    if (oldNode) {
      parent.replaceChild(newNode, oldNode)
    }
    return newNode
  }

  if (newVNode.type === 'component' && oldVNode.type === 'component') {
    return updateComponent(parent, oldVNode, newVNode, reconcile)
  }

  if (newVNode.type === 'fragment' && oldVNode.type === 'fragment') {
    return updateFragment(parent, oldVNode, newVNode, component, reconcile)
  }

  return parent.firstChild!
}

// Export reconcile for use in scheduler
export { reconcile }

// Initialize the render callback for the scheduler
setRenderCallback((component) => {
  return renderComponent(component, reconcile)
})

// Initialize the reset render depth callback
setResetRenderDepthCallback(resetRenderDepth)

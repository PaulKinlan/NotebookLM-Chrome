/**
 * Reconciler - Update Operations
 *
 * Handles updating existing VNodes in the DOM.
 */

import type { VNode } from '../vnode.ts'
import type { ComponentInstance } from '../component.ts'
import type { ReconcilerFn } from './reconciler-types.ts'
import { mountedNodes } from '../reconciler.ts'
import { diffProps } from './reconciler-props.ts'
import { diffChildren } from './reconciler-children.ts'
import { mountComponent, renderComponent } from './reconciler-mount.ts'
import * as componentModule from '../component.ts'

/**
 * Update an element VNode (diff props and children)
 */
export async function updateElement(
  parent: Element,
  oldVNode: Extract<VNode, { type: 'element' }>,
  newVNode: Extract<VNode, { type: 'element' }>,
  reconcile: ReconcilerFn,
): Promise<Node> {
  // Find the DOM element that corresponds to oldVNode
  let el: Element | null = null

  for (const child of parent.children) {
    if (child.tagName === oldVNode.tag.toUpperCase()) {
      const mounted = mountedNodes.get(child)
      // Check if this is the exact element we're looking for
      if (mounted?.vdom === oldVNode) {
        el = child
        break
      }
      // For keyed elements, also check by key
      const oldKey = oldVNode.key
      const childKey = (mounted?.vdom as Extract<VNode, { type: 'element' }> | undefined)?.key
      if (oldKey && childKey === oldKey) {
        el = child
        break
      }
      // If there's no key on the old vnode, use the first matching tag
      if (!oldKey && !el) {
        el = child
      }
    }
  }

  if (!el) {
    // Fallback to firstChild (for single-child elements)
    el = parent.firstChild as Element
  }

  // Diff props
  diffProps(el, oldVNode.props, newVNode.props)

  // Diff children
  await diffChildren(el, oldVNode.children, newVNode.children, undefined, reconcile)

  // Update mounted node reference
  mountedNodes.set(el, { node: el, vdom: newVNode })

  return el
}

/**
 * Update a component VNode (re-run component function)
 */
export async function updateComponent(
  parent: Node,
  oldVNode: Extract<VNode, { type: 'component' }>,
  newVNode: Extract<VNode, { type: 'component' }>,
  reconcile: ReconcilerFn,
): Promise<Node> {
  // Check if it's the same component function
  if (oldVNode.fn !== newVNode.fn) {
    // Different component - replace entirely
    const newNode = await mountComponent(parent, newVNode, undefined, reconcile)
    const oldNode = parent.firstChild
    if (oldNode) {
      // Cleanup old component
      const mounted = mountedNodes.get(oldNode)
      if (mounted?.component) {
        componentModule.unmountComponent(mounted.component)
      }
      parent.replaceChild(newNode, oldNode)
    }
    return newNode
  }

  // Same component - check if we have an instance
  const instance = mountedNodes.get(parent.firstChild!)?.component
  if (!instance) {
    // No instance - create new
    return mountComponent(parent, newVNode, undefined, reconcile)
  }

  // Update props and re-render
  instance.props = newVNode.props
  await renderComponent(instance, reconcile)

  return instance.mountedNode!
}

/**
 * Update a fragment VNode
 */
export async function updateFragment(
  parent: Node,
  oldVNode: Extract<VNode, { type: 'fragment' }>,
  newVNode: Extract<VNode, { type: 'fragment' }>,
  component: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
): Promise<Node> {
  // For fragments, we need to diff children in place
  await diffChildren(parent, oldVNode.children, newVNode.children, component, reconcile)
  return parent
}

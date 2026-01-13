/**
 * Reconciler - Children Diffing
 *
 * Handles key-based reconciliation of child VNodes.
 */

import type { VNode } from '../vnode.ts'
import type { ComponentInstance } from '../component.ts'
import type { ReconcilerFn } from './reconciler-types.ts'
import { mountedNodes } from '../reconciler.ts'
import { diffProps } from './reconciler-props.ts'
import * as componentModule from '../component.ts'

/**
 * Get the key for a VNode, using index as fallback
 */
export function getVNodeKey(vnode: VNode, index: number): string {
  if (vnode.type === 'component' || vnode.type === 'element') {
    return vnode.key ?? `__index_${index}`
  }
  return `__index_${index}`
}

/**
 * Diff children between old and new VNode using key-based reconciliation
 *
 * This algorithm:
 * 1. Builds a map of old children by key, tracking both VNode and DOM node
 * 2. Matches new children to old children by key
 * 3. Moves DOM nodes to correct positions using insertBefore
 * 4. Removes unmatched old children
 */
export async function diffChildren(
  parent: Node,
  oldChildren: VNode[],
  newChildren: VNode[],
  component: ComponentInstance | undefined,
  reconcile: ReconcilerFn,
): Promise<void> {
  // Edge case: no old children - mount all new children
  if (oldChildren.length === 0) {
    for (const newChild of newChildren) {
      await reconcile(parent, null, newChild, component)
    }
    return
  }

  // Edge case: no new children - remove all old children
  if (newChildren.length === 0) {
    for (let i = parent.childNodes.length - 1; i >= 0; i--) {
      const childNode = parent.childNodes[i]
      const mounted = mountedNodes.get(childNode)
      if (mounted?.component) {
        componentModule.unmountComponent(mounted.component)
      }
      if (childNode.parentNode === parent) {
        try {
          parent.removeChild(childNode)
        }
        catch (e) {
          if ((e as DOMException).name !== 'NotFoundError') {
            throw e
          }
        }
      }
    }
    return
  }

  // Build a map of old children by key for O(1) lookup
  const oldByKey = new Map<string, { vnode: VNode, domNode: Node }>()
  const domChildren = Array.from(parent.childNodes)

  // Map old children to DOM nodes by position
  for (let i = 0; i < oldChildren.length && i < domChildren.length; i++) {
    const key = getVNodeKey(oldChildren[i], i)
    const domNode = domChildren[i]
    oldByKey.set(key, { vnode: oldChildren[i], domNode })
  }

  // Track which old children have been matched
  const matched = new Set<string>()

  // Track the last placed DOM node to know where to insert the next one
  let lastPlacedNode: Node | null = null

  // Process each new child in order
  for (let newIdx = 0; newIdx < newChildren.length; newIdx++) {
    const newChild = newChildren[newIdx]
    const key = getVNodeKey(newChild, newIdx)
    const match = oldByKey.get(key)

    if (match && !matched.has(key)) {
      // Found a matching old child - reconcile and reuse it
      matched.add(key)

      const { vnode: oldChildVNode, domNode } = match

      // Reconcile the existing node (update its props/children)
      if (domNode instanceof Element && newChild.type === 'element' && oldChildVNode.type === 'element') {
        // Update props
        diffProps(domNode, oldChildVNode.props, newChild.props)

        // Recursively diff children
        await diffChildren(domNode, oldChildVNode.children, newChild.children, component, reconcile)

        // Update mounted node reference
        mountedNodes.set(domNode, { node: domNode, vdom: newChild })
      }
      else {
        // For other node types, use standard reconcile
        const parentForReconcile = domNode.nodeType === Node.TEXT_NODE ? domNode : parent
        await reconcile(parentForReconcile, oldChildVNode, newChild, component)
      }

      // Check if the node needs to be moved
      // The node should be immediately after lastPlacedNode (or at the beginning if lastPlacedNode is null)
      if (lastPlacedNode === null) {
        // First node should be at the beginning
        if (domNode !== parent.firstChild) {
          parent.insertBefore(domNode, parent.firstChild)
        }
      }
      else if (lastPlacedNode.nextSibling !== domNode) {
        // Node should be immediately after the last placed node
        parent.insertBefore(domNode, lastPlacedNode.nextSibling)
      }

      // Update last placed node
      lastPlacedNode = domNode
    }
    else {
      // No match (or duplicate key) - create a new node
      const newNode = await reconcile(parent, null, newChild, component)

      // Insert after the last placed node
      const targetBeforeNode = lastPlacedNode?.nextSibling ?? null
      try {
        parent.insertBefore(newNode, targetBeforeNode)
      }
      catch (e) {
        if ((e as DOMException).name !== 'NotFoundError') {
          throw e
        }
      }

      // Update last placed node
      lastPlacedNode = newNode
    }
  }

  // Remove unmatched old children
  const unmatchedKeys = Array.from(oldByKey.keys()).filter(key => !matched.has(key))

  for (const key of unmatchedKeys) {
    const entry = oldByKey.get(key)
    if (entry) {
      const { domNode } = entry
      if (
        domNode
        && 'nodeType' in domNode
        && domNode.nodeType === Node.ELEMENT_NODE
        && domNode.parentNode === parent
      ) {
        const mounted = mountedNodes.get(domNode)
        if (mounted?.component) {
          componentModule.unmountComponent(mounted.component)
        }
        parent.removeChild(domNode)
      }
    }
  }
}

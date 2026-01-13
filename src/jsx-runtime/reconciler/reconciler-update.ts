/**
 * Reconciler - Update Operations
 *
 * Handles updating existing VNodes in the DOM.
 */

import type { VNode, ComponentFn } from '../vnode.ts'
import type { ComponentInstance } from '../component.ts'
import type { ReconcilerFn } from './reconciler-types.ts'
import { mountedNodes } from '../reconciler.ts'
import { diffProps } from './reconciler-props.ts'
import { diffChildren } from './reconciler-children.ts'
import { mountComponent } from './reconciler-mount.ts'
import * as componentModule from '../component.ts'
import { currentlyRendering } from '../scheduler.ts'
import { renderComponent } from './reconciler-mount.ts'

/**
 * Map component functions to their instances.
 * This provides a reliable way to look up component instances
 * independent of DOM structure (which can change when placeholders are replaced).
 *
 * Key: The component function (reference equality)
 * Value: The component instance (for singletons like App) or an array of instances
 */
const componentInstances = new WeakMap<ComponentFn, ComponentInstance[]>()

/**
 * Register a component instance when it's mounted
 */
export function registerComponentInstance(fn: ComponentFn, instance: ComponentInstance): void {
  let instances = componentInstances.get(fn)
  if (!instances) {
    instances = []
    componentInstances.set(fn, instances)
  }
  instances.push(instance)
}

/**
 * Unregister a component instance when it's unmounted
 */
export function unregisterComponentInstance(fn: ComponentFn, instance: ComponentInstance): void {
  const instances = componentInstances.get(fn)
  if (instances) {
    const index = instances.indexOf(instance)
    if (index !== -1) {
      instances.splice(index, 1)
    }
    if (instances.length === 0) {
      componentInstances.delete(fn)
    }
  }
}

/**
 * Update an element VNode (diff props and children)
 */
export async function updateElement(
  parent: Element,
  oldVNode: Extract<VNode, { type: 'element' }>,
  newVNode: Extract<VNode, { type: 'element' }>,
  reconcile: ReconcilerFn,
  svgNamespace?: string,
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
    // Fallback to firstChild if it's an Element
    const firstChild = parent.firstChild
    if (firstChild instanceof Element) {
      el = firstChild
    }
  }

  if (!el) {
    // No valid element found - this shouldn't happen in normal flow
    // Create and append a new element
    const newEl = document.createElement(oldVNode.tag)
    parent.appendChild(newEl)
    // Diff props
    diffProps(newEl, oldVNode.props, newVNode.props)
    // Diff children
    await diffChildren(newEl, oldVNode.children, newVNode.children, undefined, reconcile, svgNamespace)
    // Update mounted node reference
    mountedNodes.set(newEl, { node: newEl, vdom: newVNode })
    return newEl
  }

  // Diff props
  diffProps(el, oldVNode.props, newVNode.props)

  // Diff children
  await diffChildren(el, oldVNode.children, newVNode.children, undefined, reconcile, svgNamespace)

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
  const compName = (newVNode.fn as { name?: string }).name || 'Anonymous'

  // Debug logging
  console.log(`[updateComponent] Called for "${compName}", parent.childNodes.length=${parent.childNodes.length}`)

  // Check if it's the same component function
  if (oldVNode.fn !== newVNode.fn) {
    console.log(`[updateComponent] Different component function, replacing`)
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

  // Same component - look up the instance using our function-based map
  // This is more reliable than DOM-based lookups because the DOM structure
  // changes when component placeholders are replaced with actual content
  const instances = componentInstances.get(newVNode.fn)

  console.log(`[updateComponent] "${compName}" Looking up instance in componentInstances map, found ${instances?.length || 0} instances`)

  const instance = instances?.[0] // For now, assume first instance (works for singletons like App)

  if (!instance) {
    console.log(`[updateComponent] "${compName}" No instance found in componentInstances map, creating new`)
    // No instance - create new
    return mountComponent(parent, newVNode, undefined, reconcile)
  }
  console.log(`[updateComponent] "${compName}" Reusing existing instance with ${instance.hooks.length} hooks`)

  // RE-ENTRY PROTECTION: If this component is currently rendering,
  // just update props and return. The current render will complete with the new props.
  // This prevents infinite loops when setState is called during render.
  if (currentlyRendering.has(instance)) {
    instance.props = newVNode.props
    return instance.mountedNode!
  }

  // Update props and re-render synchronously
  // We call renderComponent directly instead of scheduleUpdate because
  // reconciliation expects synchronous DOM updates.
  // The re-entry protection above prevents infinite loops.
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

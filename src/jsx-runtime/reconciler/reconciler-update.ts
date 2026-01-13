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
  // Debug logging for select
  if (oldVNode.tag === 'select' || newVNode.tag === 'select') {
    console.log(`[updateElement] Called for tag=${oldVNode.tag}, oldChildren=${oldVNode.children.length}, newChildren=${newVNode.children.length}`)
    console.log(`[updateElement] oldVNode===newVNode: ${oldVNode === newVNode}`)
    console.log(`[updateElement] newVNode.children===newVNode.children: ${newVNode.children === newVNode.children}`)
  }

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

  // For <select> elements, we need to diff children BEFORE props.
  // This is because setting the 'value' prop requires the option to exist in the DOM.
  // If we set value first, then add the option, the value won't be set correctly.
  if (el instanceof HTMLSelectElement) {
    console.log(`[updateElement] SELECT element detected: ${el.id || '(no id)'}, oldChildren=${oldVNode.children.length}, newChildren=${newVNode.children.length}`)
    // Diff children first (add/update/remove options)
    await diffChildren(el, oldVNode.children, newVNode.children, undefined, reconcile, svgNamespace)
    // Then diff props (set value after options exist)
    console.log(`[updateElement] After diffChildren for ${el.id || '(no id)'}, options count=${el.options.length}`)
    diffProps(el, oldVNode.props, newVNode.props)
    console.log(`[updateElement] After diffProps for ${el.id || '(no id)'}, value="${el.value}"`)
  }
  else {
    // Normal order: props first, then children
    diffProps(el, oldVNode.props, newVNode.props)
    // Diff children
    await diffChildren(el, oldVNode.children, newVNode.children, undefined, reconcile, svgNamespace)
  }

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
  console.log(`[updateFragment] Called with oldChildren=${oldVNode.children.length}, newChildren=${newVNode.children.length}`)
  // For fragments, we need to diff children in place
  await diffChildren(parent, oldVNode.children, newVNode.children, component, reconcile)
  return parent
}

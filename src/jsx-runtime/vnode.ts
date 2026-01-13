/**
 * Virtual DOM Node Types
 *
 * Defines the virtual node representation used by the reconciliation engine.
 * VNodes are lightweight JavaScript objects that describe what should be rendered.
 */

/**
 * Component function signature
 * Components are functions that take props and return a VNode or DOM Node
 */
export type ComponentFn<P = Record<string, unknown>> = (props: P) => VNode | Node

/**
 * Virtual Node - a discriminated union type for all node types
 *
 * - text: Plain text content
 * - element: HTML/SVG element with tag, props, and children
 * - component: User-defined function component
 * - fragment: DocumentFragment-like grouping without a wrapper element
 */
export type VNode
  = | { type: 'text', value: string }
    | { type: 'element', tag: string, props: Record<string, unknown>, children: VNode[], key?: string }
    | { type: 'component', fn: ComponentFn, props: Record<string, unknown>, key?: string }
    | { type: 'fragment', children: VNode[] }

/**
 * A mounted node represents a VNode that has been rendered to the DOM
 * Keeps track of the actual DOM node and its virtual representation
 */
export interface MountedNode {
  /** The actual DOM node */
  node: Node
  /** The virtual node representation */
  vdom: VNode
  /** If this is a component root, the component instance */
  component?: ComponentInstance
}

/**
 * Component instance (imported here for type circularity avoidance)
 */
import type { ComponentInstance } from './component.ts'

/**
 * Check if a VNode is a text node
 */
export function isTextNode(vnode: VNode): vnode is Extract<VNode, { type: 'text' }> {
  return vnode.type === 'text'
}

/**
 * Check if a VNode is an element node
 */
export function isElementNode(vnode: VNode): vnode is Extract<VNode, { type: 'element' }> {
  return vnode.type === 'element'
}

/**
 * Check if a VNode is a component node
 */
export function isComponentNode(vnode: VNode): vnode is Extract<VNode, { type: 'component' }> {
  return vnode.type === 'component'
}

/**
 * Check if a VNode is a fragment
 */
export function isFragmentNode(vnode: VNode): vnode is Extract<VNode, { type: 'fragment' }> {
  return vnode.type === 'fragment'
}

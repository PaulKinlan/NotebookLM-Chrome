// ============================================================================
// JSX Runtime - VNode-based
// ============================================================================
// This is a VNode-based JSX runtime that works with the reconciler.
// All JSX expressions return VNodes, which are then rendered via render().

import type { VNode, ComponentFn } from './jsx-runtime/vnode.ts'

// Re-export hooks and VDOM types for components that use state
export { useState, useEffect, useContext, useMemo, useCallback, createContext, ContextProvider } from './jsx-runtime/hooks/index.ts'
export type { Context } from './jsx-runtime/hooks/useContext.ts'
export type { VNode, ComponentFn }
export { render, renderToDOM } from './jsx-runtime/render.ts'

// ============================================================================
// VNode Child Types
// ============================================================================

// Children can be VNodes, primitives, arrays, null/undefined/boolean (ignored)
type VNodeChild = VNode | string | number | boolean | null | undefined | VNodeChild[]

/**
 * Normalize a child value to a VNode or array of VNodes
 */
function normalizeChild(child: VNodeChild): VNode[] {
  // Ignore null, undefined, boolean
  if (child === null || child === undefined || child === false || child === true) {
    return []
  }

  // Flatten arrays
  if (Array.isArray(child)) {
    return child.flatMap(normalizeChild)
  }

  // Already a VNode
  if (typeof child === 'object' && 'type' in child) {
    return [child]
  }

  // Convert primitives to text VNodes
  return [{ type: 'text', value: String(child) }]
}

/**
 * Normalize children from props to an array of VNodes
 */
function normalizeChildren(children: VNodeChild | VNodeChild[]): VNode[] {
  if (Array.isArray(children)) {
    return children.flatMap(normalizeChild)
  }
  return normalizeChild(children)
}

// ============================================================================
// JSX Factory Functions
// ============================================================================

/**
 * Fragment - groups children without a wrapper element
 * Returns a VNode of type 'fragment'
 */
export function Fragment(props: { children?: VNodeChild | VNodeChild[] }): VNode {
  const children = props.children
  return {
    type: 'fragment',
    children: children !== undefined ? normalizeChildren(children) : [],
  }
}

/**
 * jsx - creates VNodes from JSX expressions
 *
 * For function components, returns a component VNode that will be rendered by the reconciler.
 * For string tags (elements), returns an element VNode.
 *
 * @param tag - The element tag name or component function
 * @param props - The props/attributes including children
 * @param key - Optional key for reconciliation
 */
export function jsx(
  tag: string | ((props: Record<string, unknown>) => Node | VNode),
  props: Record<string, unknown> & { key?: string | number | null },
  key?: string | number | null,
): VNode {
  // Handle component functions
  if (typeof tag === 'function') {
    return {
      type: 'component',
      fn: tag as ComponentFn,
      props: { ...props, ...(key !== undefined ? { key } : {}) },
      key: key !== undefined && key !== null ? String(key) : undefined,
    }
  }

  // Handle element tags
  const { children, key: propsKey, ...restProps } = props
  const effectiveKey = key ?? propsKey

  return {
    type: 'element',
    tag,
    props: restProps,
    children: children !== undefined ? normalizeChildren(children as VNodeChild | VNodeChild[]) : [],
    key: effectiveKey !== undefined && effectiveKey !== null ? String(effectiveKey) : undefined,
  }
}

/**
 * jsxs - same as jsx, kept for React compatibility
 * Used by the JSX transform for elements with multiple children
 */
export function jsxs(
  tag: string | ((props: Record<string, unknown>) => Node | VNode),
  props: Record<string, unknown> & { key?: string | number | null },
): VNode {
  const { key, ...restProps } = props
  return jsx(tag, restProps, key)
}

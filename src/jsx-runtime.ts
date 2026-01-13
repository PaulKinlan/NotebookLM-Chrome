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
  const result = Array.isArray(children)
    ? children.flatMap(normalizeChild)
    : normalizeChild(children)

  // Debug logging for select children
  const hasArrayChildren = Array.isArray(children) && children.some(c => Array.isArray(c))
  if (hasArrayChildren) {
    console.log('[normalizeChildren] Input had nested arrays, result length:', result.length)
    console.log('[normalizeChildren] Input:', JSON.stringify(children.map((c: unknown) => {
      if (Array.isArray(c)) return `[array with ${c.length} items]`
      if (c && typeof c === 'object' && 'type' in c) {
        const vnode = c as { type: string, tag?: string }
        return `${vnode.type}${vnode.tag ? `(${vnode.tag})` : ''}`
      }
      return String(c)
    })))
    console.log('[normalizeChildren] Result:', JSON.stringify(result.map((c: unknown) => {
      if (c && typeof c === 'object' && 'type' in c) {
        const vnode = c as { type: string, tag?: string }
        return `${vnode.type}${vnode.tag ? `(${vnode.tag})` : ''}`
      }
      return String(c)
    })))
  }

  return result
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
  // Debug logging for select element
  if (typeof tag === 'string' && tag === 'select' && (props as { id?: string }).id === 'notebook-select') {
    console.log('[jsx] Creating select element, children:', JSON.stringify(props.children))
    console.log('[jsx] children type:', Array.isArray(props.children) ? 'array' : typeof props.children)
    if (Array.isArray(props.children)) {
      console.log('[jsx] children length:', props.children.length)
      props.children.forEach((child: unknown, i: number) => {
        if (child && typeof child === 'object' && 'type' in child) {
          const childVNode = child as { type: string, tag?: string }
          console.log(`[jsx] child ${i}: type=${childVNode.type}${childVNode.type === 'element' && childVNode.tag ? `, tag=${childVNode.tag}` : ''}`)
        }
        else {
          console.log(`[jsx] child ${i}:`, child)
        }
      })
    }
  }

  // SPECIAL CASE: Fragment - call it directly to get the fragment VNode
  // instead of wrapping it in a component VNode
  // This is needed because esbuild's JSX transform calls jsx(Fragment, { children: [...] })
  if (typeof tag === 'function' && tag.name === 'Fragment') {
    const result = tag(props)
    // Fragment always returns a VNode, but we need to handle the Node case for type safety
    if (result instanceof Node) {
      return { type: 'text', value: result.textContent || '' }
    }
    return result
  }

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

  const normalizedChildren = children !== undefined ? normalizeChildren(children as VNodeChild | VNodeChild[]) : []

  // Debug logging for select element
  if (tag === 'select' && (props as { id?: string }).id === 'notebook-select') {
    console.log(`[jsx] Creating select VNode with ${normalizedChildren.length} children`)
    normalizedChildren.forEach((child: unknown, i: number) => {
      if (child && typeof child === 'object' && 'type' in child) {
        const childVNode = child as { type: string, tag?: string }
        console.log(`[jsx]   child ${i}: type=${childVNode.type}${childVNode.type === 'element' && childVNode.tag ? `, tag=${childVNode.tag}` : ''}`)
      }
    })
  }

  return {
    type: 'element',
    tag,
    props: restProps,
    children: normalizedChildren,
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

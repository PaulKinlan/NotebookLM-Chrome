// ============================================================================
// Re-export hooks system
// ============================================================================

// Export hooks and VDOM types for components that use state
export { useState, useEffect, useContext, useMemo, useCallback, createContext, ContextProvider } from './jsx-runtime/hooks/index.ts'
export type { Context } from './jsx-runtime/hooks/useContext.ts'
export type { VNode, ComponentFn } from './jsx-runtime/vnode.ts'
export { render, renderToDOM } from './jsx-runtime/render.ts'

// ============================================================================
// Legacy JSX Runtime (for non-hook components)
// ============================================================================

type Child = Node | string | number | boolean | null | undefined

function isNode(x: unknown): x is Node {
  return typeof Node !== 'undefined' && x instanceof Node
}

// SVG namespace for creating SVG elements
const SVG_NS = 'http://www.w3.org/2000/svg'

// SVG element names that need to be created in the SVG namespace
const SVG_TAGS = new Set([
  'svg',
  'path',
  'circle',
  'rect',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'text',
  'tspan',
  'g',
  'defs',
  'use',
  'marker',
  'clipPath',
  'mask',
  'pattern',
  'gradient',
  'linearGradient',
  'radialGradient',
  'stop',
  'animate',
  'animateTransform',
  'animateMotion',
  'image',
  'foreignObject',
])

function append(el: Element | DocumentFragment, child: Child): void {
  if (child === null || child === undefined || child === false || child === true) return

  if (Array.isArray(child)) {
    for (const c of child as unknown as Child[]) append(el, c)
    return
  }

  if (isNode(child)) {
    el.appendChild(child)
    return
  }

  el.appendChild(document.createTextNode(String(child)))
}

export function Fragment(props: { children?: Child | Child[] }): DocumentFragment {
  const frag = document.createDocumentFragment()
  const children = props.children

  if (Array.isArray(children)) {
    for (const c of children) append(frag, c)
  }
  else {
    append(frag, children)
  }

  return frag
}

/**
 * jsx is for elements with static children (known at compile time)
 * Children are passed in props
 */
export function jsx(
  tag: string | ((props: Record<string, unknown>) => Node),
  props: Record<string, unknown> & { key?: string | number | null },
  key?: string | number | null,
): Node {
  if (typeof tag === 'function') {
    return tag({ ...props, ...(key !== undefined ? { key } : {}) })
  }

  // Create element in correct namespace (HTML or SVG)
  const isSvg = SVG_TAGS.has(tag)
  const el = isSvg
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag)

  // Set key as data attribute for debugging/reconciliation
  if (key !== undefined && key !== null) {
    el.setAttribute('data-key', String(key))
  }

  if (props) {
    for (const [propKey, value] of Object.entries(props)) {
      // Skip key - already handled above
      if (propKey === 'key') continue
      if (propKey === 'className') {
        // For SVG, set class attribute; for HTML, set class directly
        if (isSvg) {
          el.setAttribute('class', String(value))
        }
        else {
          (el as HTMLElement).className = String(value)
        }
      }
      else if (propKey.startsWith('on') && typeof value === 'function') {
        // onClick -> click
        const event = propKey.slice(2).toLowerCase()
        el.addEventListener(event, value as EventListener)
      }
      else if (value === true) {
        el.setAttribute(propKey, '')
      }
      else if (
        propKey === 'style'
        && value !== null
        && value !== undefined
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        const style = (el as HTMLElement).style
        // Type assertion is safe here - we've validated value is a non-array object above
        const styleObj = value as Record<string, unknown>
        for (const [styleName, styleValue] of Object.entries(styleObj)) {
          if (styleValue === null || styleValue === undefined || styleValue === false) {
            continue
          }
          // CSS property values must be strings - skip non-primitive values
          if (typeof styleValue !== 'string' && typeof styleValue !== 'number') {
            continue
          }
          style.setProperty(styleName, String(styleValue))
        }
      }
      else if (value !== false && value !== null && propKey !== 'children') {
        // For boolean attributes on SVG (like fill="true"), convert to string
        // Only primitive types are valid attribute values
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          continue
        }
        el.setAttribute(propKey, String(value))
      }
    }

    // Handle children from props
    if ('children' in props) {
      const children = props.children
      const childrenValue = children as Child | Child[]
      if (Array.isArray(childrenValue)) {
        for (const c of childrenValue) append(el, c)
      }
      else {
        append(el, childrenValue)
      }
    }
  }

  return el
}

/**
 * jsxs is for elements with multiple/dynamic children (arrays)
 * Children are passed in props
 * Same implementation as jsx - kept separate for React compatibility
 */
export function jsxs(
  tag: string | ((props: Record<string, unknown>) => Node),
  props: Record<string, unknown> & { key?: string | number | null },
): Node {
  const { key, ...restProps } = props
  return jsx(tag, restProps, key)
}

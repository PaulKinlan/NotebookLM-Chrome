/**
 * Reconciler - Props Diffing
 *
 * Handles diffing and applying props to DOM elements.
 * No circular dependencies - pure functions.
 */

/**
 * Apply props to a DOM element
 */
export function applyProps(el: Element, props: Record<string, unknown>): void {
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
export function diffProps(el: Element, oldProps: Record<string, unknown>, newProps: Record<string, unknown>): void {
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

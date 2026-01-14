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

    // Ref prop - set ref.current to the element
    if (key === 'ref' && value && typeof value === 'object' && 'current' in value) {
      ;(value as { current: Element | null }).current = el
      continue
    }

    // Event handlers (onClick, onChange, etc.)
    if (key.startsWith('on')) {
      const eventType = key.slice(2).toLowerCase()
      if (typeof value === 'function') {
        // Debug logging for ALL click events
        if (eventType === 'click' && el.tagName === 'BUTTON') {
          const dataTab = (el as HTMLElement).getAttribute('data-tab')
          const id = (el as HTMLElement).id
          console.log(`[applyProps] Attaching click listener to button${id ? ' id="' + id + '"' : ''}${dataTab ? ' data-tab="' + dataTab + '"' : ''}:`, el)
          // Wrap the handler to log when it's actually called and set a data attribute for testing
          el.addEventListener(eventType, function (this: HTMLElement, e: Event) {
            console.log(`[applyProps] CLICK EVENT FIRED on button${id ? ' id="' + id + '"' : ''}${dataTab ? ' data-tab="' + dataTab + '"' : ''}`)
            // Set a data attribute that tests can check
            el.setAttribute('data-click-fired', 'true')
            // Also set a window property for easier testing
            if (dataTab) {
              ;(window as { __lastClickTab?: string }).__lastClickTab = dataTab
            }
            else if (id) {
              ;(window as { __lastClickId?: string }).__lastClickId = id
            }
            return (value as EventListener).call(this, e)
          })
          continue
        }
        // Debug logging for form submit events
        if (eventType === 'submit' && el.tagName === 'FORM') {
          console.log('[applyProps] Attaching submit listener to form:', el)
        }
        // Debug logging for input events
        if (eventType === 'input' && el.tagName === 'INPUT') {
          console.log('[applyProps] Attaching input listener to input:', el, 'id:', (el as HTMLInputElement).id)
          // Wrap the handler to log when it's actually called
          const inputId = (el as HTMLInputElement).id
          el.addEventListener(eventType, function (this: HTMLElement, e: Event) {
            console.log('[applyProps] INPUT EVENT FIRED on element with id:', inputId, 'value:', (e.target as HTMLInputElement).value)
            return (value as EventListener).call(this, e)
          })
          continue
        }
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
      if (value === null || value === undefined) {
        el.removeAttribute('class')
      }
      else if (typeof value === 'string' || typeof value === 'number') {
        el.setAttribute('class', String(value))
      }
      continue
    }

    // Form element properties - must be set as properties, not attributes
    // These control the current value, while attributes only set initial values
    if (key === 'value' && ('value' in el)) {
      if (value === null || value === undefined) {
        ;(el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = ''
      }
      else if (typeof value === 'string' || typeof value === 'number') {
        ;(el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = String(value)
      }
      continue
    }
    if (key === 'checked' && ('checked' in el)) {
      (el as HTMLInputElement).checked = Boolean(value)
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
      else if (key === 'value' && 'value' in el) {
        // Reset to empty for form elements
        (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = ''
      }
      else if (key === 'checked' && 'checked' in el) {
        (el as HTMLInputElement).checked = false
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

      // Ref prop - set ref.current to the element
      if (key === 'ref' && value && typeof value === 'object' && 'current' in value) {
        ;(value as { current: Element | null }).current = el
        continue
      }

      if (key.startsWith('on')) {
        const eventType = key.slice(2).toLowerCase()
        // Remove old listener
        if (typeof oldProps[key] === 'function') {
          el.removeEventListener(eventType, oldProps[key] as EventListener)
        }
        // Add new listener
        if (typeof value === 'function') {
          // Debug logging for form submit events
          if (eventType === 'submit' && el.tagName === 'FORM') {
            console.log('[diffProps] Updating submit listener on form:', el)
          }
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
        // Debug logging for tab-settings element
        if ((el as HTMLElement).id === 'tab-settings') {
          const oldValue = typeof oldProps[key] === 'string' ? oldProps[key] : '(none)'
          const newValue = typeof value === 'string' ? value : '(none)'
          console.log(`[diffProps] Updating className for tab-settings: from "${oldValue}" to "${newValue}"`)
        }
        if (value === null || value === undefined) {
          el.removeAttribute('class')
        }
        else if (typeof value === 'string' || typeof value === 'number') {
          el.setAttribute('class', String(value))
        }
      }
      // Form element properties - must be set as properties, not attributes
      else if (key === 'value' && 'value' in el) {
        // Debug logging for select value changes
        if (el.tagName === 'SELECT' && (el as HTMLSelectElement).id === 'notebook-select') {
          const selectEl = el as HTMLSelectElement
          const options = Array.from(selectEl.options).map(o => ({ value: o.value, text: o.text }))
          const valueStr = (value === null || value === undefined)
            ? ''
            : typeof value === 'string' || typeof value === 'number'
              ? String(value)
              : '[object]'
          console.log(`[diffProps] VALUE: Updating notebook-select value from "${selectEl.value}" to "${valueStr}", options:`, JSON.stringify(options))
          const hasOptionWithValue = Array.from(selectEl.options).some(o => o.value === valueStr)
          console.log(`[diffProps] Has option with value "${valueStr}": ${hasOptionWithValue}`)
        }
        if (value === null || value === undefined) {
          ;(el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = ''
        }
        else if (typeof value === 'string' || typeof value === 'number') {
          ;(el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = String(value)
        }
        if (el.tagName === 'SELECT' && (el as HTMLSelectElement).id === 'notebook-select') {
          console.log(`[diffProps] notebook-select value is now "${(el as HTMLSelectElement).value}"`)
        }
      }
      else if (key === 'checked' && 'checked' in el) {
        (el as HTMLInputElement).checked = Boolean(value)
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

/**
 * useState Hook
 *
 * Manages component state and triggers re-renders when state changes.
 */

import { getCurrentComponent } from '../component.ts'
import { scheduleUpdate } from '../scheduler.ts'

/**
 * useState hook - manages component state
 *
 * @param initialValue - Initial state value or function that returns initial state
 * @returns A tuple of [currentValue, setValue]
 *
 * @example
 * ```tsx
 * const [count, setCount] = useState(0)
 * const [name, setName] = useState(() => getName())
 * ```
 */
export function useState<T>(
  initialValue: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useState can only be used in components')
  }

  const index = component.hookIndex++

  // Debug logging for App component activeTab state (hook index 0)
  const compName = component.fn.name || 'Anonymous'
  if (compName === 'App' && index === 0) {
    console.log(`[useState] App activeTab (hook index 0): current=`, component.hooks[index]?.value, `hookIndex=`, index, `hooks.length=`, component.hooks.length)
  }

  // Initialize hook if first render
  if (index >= component.hooks.length) {
    const value = typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue

    component.hooks.push({
      type: 'state',
      value,
    })
  }

  const hook = component.hooks[index]

  // Debug logging for HeaderStateful notebooks state
  if (compName === 'HeaderStateful' && index === 1) {
    const notebooksArr = hook.value as Array<{ id: string, name: string } | undefined>
    console.log(`[useState] HeaderStateful notebooks (hook index 1): length=${notebooksArr?.length ?? 0}, items:`, notebooksArr?.map(n => ({ id: n?.id ?? '', name: n?.name ?? '' })))
  }

  // Defensive check - should never happen if hooks are used correctly
  if (!hook) {
    throw new Error(
      `useState: Hook at index ${index} is undefined. `
      + `This usually means hooks are being called conditionally or in different orders between renders. `
      + `Component: ${component.fn.name || 'Anonymous'}`,
    )
  }

  // Create setter function that schedules re-render
  const setState = (newValue: T | ((prev: T) => T)) => {
    const hookValue = hook.value as T
    const nextValue = typeof newValue === 'function'
      ? (newValue as (prev: T) => T)(hookValue)
      : newValue

    // Debug logging for tab state changes
    const compName = component.fn.name || 'Anonymous'
    console.log(`[useState] setState called for component "${compName}", hook index: ${index}, current: ${String(hookValue)}, next: ${String(nextValue)}`)

    // Only trigger update if value actually changed
    if (hookValue !== nextValue) {
      hook.value = nextValue
      console.log(`[useState] Value changed, scheduling update for component "${compName}"`)
      // The scheduler will check if this component is currently rendering
      // and prevent re-entry, which avoids infinite render loops
      scheduleUpdate(component)
    }
    else {
      console.log(`[useState] Value unchanged, skipping update for component "${compName}"`)
    }
  }

  return [hook.value as T, setState]
}

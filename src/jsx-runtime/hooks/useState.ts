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

  // Create setter function that schedules re-render
  const setState = (newValue: T | ((prev: T) => T)) => {
    const hookValue = hook.value as T
    const nextValue = typeof newValue === 'function'
      ? (newValue as (prev: T) => T)(hookValue)
      : newValue

    // Only trigger update if value actually changed
    if (hookValue !== nextValue) {
      hook.value = nextValue
      console.log('[useState] State changed from', hookValue, 'to', nextValue, ', scheduling update')
      scheduleUpdate(component)
    }
    else {
      console.log('[useState] State unchanged, skipping update')
    }
  }

  return [hook.value as T, setState]
}

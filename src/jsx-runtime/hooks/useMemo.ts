/**
 * useMemo and useCallback Hooks
 *
 * Performance optimization hooks that memoize values and functions.
 */

import { getCurrentComponent } from '../component.ts'

/**
 * Check if two dependency arrays are the same using Object.is
 */
function depsAreSame(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((val, i) => Object.is(val, b[i]))
}

/**
 * useMemo hook - memoize a computed value
 *
 * Only recomputes the value when dependencies change.
 *
 * @param factory - Function that computes the value
 * @param deps - Dependency array; value recomputes when these change
 * @returns The memoized value
 *
 * @example
 * ```tsx
 * const filteredItems = useMemo(() => {
 *   return items.filter(item => item.active)
 * }, [items])
 * ```
 */
export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useMemo can only be used in components')
  }

  const index = component.hookIndex++

  // Initialize hook if first render
  if (index >= component.hooks.length) {
    const value = factory()
    component.hooks.push({
      type: 'memo',
      value,
      deps,
    })
    return value
  }

  // Check if dependencies changed
  const hook = component.hooks[index]
  const depsChanged = !hook.deps || !depsAreSame(deps, hook.deps)

  if (depsChanged) {
    const value = factory()
    hook.value = value
    hook.deps = deps
  }

  return hook.value as T
}

/**
 * useCallback hook - memoize a function
 *
 * Returns the same function instance until dependencies change.
 * Equivalent to useMemo(() => fn, deps).
 *
 * @param callback - The function to memoize
 * @param deps - Dependency array; function changes when these change
 * @returns The memoized function
 *
 * @example
 * ```tsx
 * const handleClick = useCallback(() => {
 *   console.log('Clicked!', count)
 * }, [count])
 *
 * // Without useCallback, handleClick would be a new function on every render
 * // which would cause child components that receive it as a prop to re-render
 * ```
 */
export function useCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: unknown[],
): T {
  // useMemo is defined above, but we can't call it during the same hook execution
  // because it would increment the hook index. So we inline the logic.
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useCallback can only be used in components')
  }

  const index = component.hookIndex++

  if (index >= component.hooks.length) {
    component.hooks.push({
      type: 'callback',
      value: callback,
      deps,
    })
    return callback
  }

  const hook = component.hooks[index]
  const depsChanged = !hook.deps || !depsAreSame(deps, hook.deps)

  if (depsChanged) {
    hook.value = callback
    hook.deps = deps
  }

  return hook.value as T
}

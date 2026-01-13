/**
 * useEffect Hook
 *
 * Manages side effects in components.
 * Effects run after render and can have cleanup functions.
 */

import { getCurrentComponent } from '../component.ts'

/**
 * Check if two dependency arrays are the same using Object.is
 */
function depsAreSame(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((val, i) => Object.is(val, b[i]))
}

/**
 * Queue of effects to run after current render completes
 */
const effectQueue: Array<() => void> = []
let effectScheduled = false

/**
 * Schedule effects to run after render
 */
function scheduleEffects(): void {
  if (!effectScheduled) {
    effectScheduled = true
    void Promise.resolve().then(() => {
      const effects = effectQueue.splice(0)
      effectScheduled = false
      for (const effect of effects) {
        try {
          effect()
        }
        catch (error) {
          console.error('Error running effect:', error)
        }
      }
    })
  }
}

/**
 * useEffect hook - manages side effects
 *
 * @param effect - Function that may return a cleanup function
 * @param deps - Dependency array; effect runs when these values change
 *
 * @example
 * ```tsx
 * // Run on every render
 * useEffect(() => {
 *   document.title = `Count: ${count}`
 * })
 *
 * // Run only on mount
 * useEffect(() => {
 *   console.log('Mounted')
 *   return () => console.log('Unmounted')
 * }, [])
 *
 * // Run when count changes
 * useEffect(() => {
 *   console.log('Count changed:', count)
 * }, [count])
 * ```
 */
export function useEffect(
  effect: () => (() => void) | void,
  deps?: unknown[],
): void {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useEffect can only be used in components')
  }

  const index = component.hookIndex++

  // Initialize or get existing effect hook
  if (index >= component.hooks.length) {
    // First render - create hook
    component.hooks.push({
      type: 'effect',
      value: effect,
      deps,
      cleanup: undefined,
    })

    // Schedule effect to run after mount
    const runEffect = () => {
      const cleanup = effect()
      if (cleanup) {
        component.hooks[index].cleanup = cleanup
      }
    }
    effectQueue.push(runEffect)
    scheduleEffects()
  }
  else {
    // Update - check if deps changed
    const hook = component.hooks[index]
    const depsChanged = !deps || !hook.deps || !depsAreSame(deps, hook.deps)

    if (depsChanged) {
      // Run cleanup if exists
      if (hook.cleanup) {
        hook.cleanup()
        hook.cleanup = undefined
      }

      // Update hook and schedule new effect
      hook.value = effect
      hook.deps = deps

      // Wrap effect to capture cleanup
      const runEffect = () => {
        const cleanup = effect()
        if (cleanup) {
          hook.cleanup = cleanup
        }
      }

      effectQueue.push(runEffect)
      scheduleEffects()
    }
  }
}

/**
 * Run cleanup for all effects in a component
 * Called when component unmounts
 */
export function runEffectCleanups(component: { hooks: unknown[] }): void {
  for (const hook of component.hooks) {
    if (hook && typeof hook === 'object' && 'cleanup' in hook && typeof hook.cleanup === 'function') {
      ;(hook.cleanup as () => void)()
      hook.cleanup = undefined
    }
  }
}

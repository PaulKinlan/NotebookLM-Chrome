/**
 * useLayoutEffect Hook
 *
 * Synchronous effect that runs before DOM paint.
 * Use this for reading layout from the DOM and synchronously re-rendering.
 *
 * The signature is identical to useEffect, but it fires synchronously
 * after all DOM mutations but before the browser paints.
 *
 * Prefer useEffect when possible to avoid blocking visual updates.
 */

import { getCurrentComponent } from '../component.ts'

/**
 * Queue of layout effects to run synchronously after render
 */
const layoutEffectQueue: Array<() => void> = []
let layoutEffectScheduled = false

/**
 * Schedule layout effects to run synchronously
 */
function scheduleLayoutEffects(): void {
  if (!layoutEffectScheduled) {
    layoutEffectScheduled = true
    // Use queueMicrotask to run after current synchronous code
    // but before paint
    queueMicrotask(() => {
      const effects = layoutEffectQueue.splice(0)
      layoutEffectScheduled = false
      for (const effect of effects) {
        try {
          effect()
        }
        catch (error) {
          console.error('Error running layout effect:', error)
        }
      }
    })
  }
}

/**
 * Check if two dependency arrays are the same using Object.is
 */
function depsAreSame(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((val, i) => Object.is(val, b[i]))
}

/**
 * useLayoutEffect hook - synchronous version of useEffect
 *
 * @param effect - Function that may return a cleanup function
 * @param deps - Dependency array; effect runs when these values change
 *
 * @example
 * ```tsx
 * // Measure DOM after render
 * useLayoutEffect(() => {
 *   const rect = ref.current.getBoundingClientRect()
 *   // Do something with measurements before paint
 *   return () => {
 *     // Cleanup
 *   }
 * }, [dependency])
 * ```
 *
 * @example
 * ```tsx
 * // Run on every render (no deps)
 * useLayoutEffect(() => {
 *   console.log('Layout updated')
 * })
 *
 * // Run only on mount (empty deps)
 * useLayoutEffect(() => {
 *   console.log('Mounted')
 *   return () => console.log('Unmounted')
 * }, [])
 *
 * // Run when count changes
 * useLayoutEffect(() => {
 *   console.log('Count changed:', count)
 * }, [count])
 * ```
 */
export function useLayoutEffect(
  effect: () => (() => void) | void,
  deps?: unknown[],
): void {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useLayoutEffect can only be used in components')
  }

  const index = component.hookIndex++

  // Initialize or get existing effect hook
  if (index >= component.hooks.length) {
    // First render - create hook
    component.hooks.push({
      type: 'layout',
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
    layoutEffectQueue.push(runEffect)
    scheduleLayoutEffects()
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

      layoutEffectQueue.push(runEffect)
      scheduleLayoutEffects()
    }
  }
}

/**
 * Run cleanup for all layout effects in a component
 * Called when component unmounts
 */
export function runLayoutEffectCleanups(component: { hooks: unknown[] }): void {
  for (const hook of component.hooks) {
    if (hook && typeof hook === 'object' && 'cleanup' in hook && typeof hook.cleanup === 'function') {
      ;(hook.cleanup as () => void)()
      hook.cleanup = undefined
    }
  }
}

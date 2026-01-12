/**
 * useSyncExternalStore Hook
 *
 * Subscribes to an external store and re-renders when it changes.
 * Useful for integrating with external state management like Redux, Zustand, etc.
 *
 * This is the React 18 concurrency-safe way to read from external stores.
 */

import { getCurrentComponent } from '../component.ts'
import { scheduleUpdate } from '../scheduler.ts'

/**
 * Subscribe function signature
 * Takes a callback and returns an unsubscribe function
 */
export type Subscribe = (onStoreChange: () => void) => () => void

/**
 * GetSnapshot function signature
 * Returns the current snapshot of the store
 */
export type GetSnapshot<T> = () => T

/**
 * useSyncExternalStore hook - subscribe to external store
 *
 * @param subscribe - Function to register a callback for store changes
 * @param getSnapshot - Function to get the current snapshot from the store
 * @param getServerSnapshot - Optional function to get snapshot on server (for SSR)
 * @returns The current snapshot from the store
 *
 * @example
 * ```tsx
 * // Simple store
 * interface Store<T> {
 *   getSnapshot: () => T
 *   subscribe: (callback: () => void) => () => void
 * }
 *
 * const store = createStore({ count: 0 })
 *
 * function Counter() {
 *   const count = useSyncExternalStore(
 *     store.subscribe,
 *     () => store.getSnapshot().count
 *   )
 *   return <div>{count}</div>
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Browser API example - media query
 * function useMediaQuery(query: string) {
 *   return useSyncExternalStore(
 *     (callback) => {
 *       const mql = window.matchMedia(query)
 *       mql.addEventListener('change', callback)
 *       return () => mql.removeEventListener('change', callback)
 *     },
 *     () => window.matchMedia(query).matches
 *   )
 * }
 * ```
 */
export function useSyncExternalStore<T>(
  subscribe: Subscribe,
  getSnapshot: GetSnapshot<T>,
): T {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useSyncExternalStore can only be used in components')
  }

  const index = component.hookIndex++

  // Get current snapshot
  const snapshot = getSnapshot()

  // Initialize hook if first render
  if (index >= component.hooks.length) {
    // Create the store change handler
    const onStoreChange = () => {
      const hook = component.hooks[index] as unknown as ExternalStoreHook<T>
      if (!hook) return

      // Check if the snapshot actually changed
      const newSnapshot = getSnapshot()
      if (newSnapshot !== hook.snapshot) {
        hook.snapshot = newSnapshot
        scheduleUpdate(component)
      }
    }

    // Subscribe to the store
    const unsubscribe = subscribe(onStoreChange)

    component.hooks.push({
      type: 'external',
      snapshot,
      unsubscribe,
    } as unknown as Hook)

    return snapshot
  }

  // On re-renders, just return the stored snapshot
  // The onStoreChange callback will trigger re-renders when needed
  const hook = component.hooks[index] as unknown as ExternalStoreHook<T>

  // Update snapshot if it changed (could happen if component re-rendered
  // for another reason but store also changed)
  const currentSnapshot = getSnapshot()
  if (currentSnapshot !== hook.snapshot) {
    hook.snapshot = currentSnapshot
  }

  return hook.snapshot
}

/**
 * Cleanup external store subscriptions
 * Called when component unmounts
 */
export function cleanupExternalStore(component: { hooks: unknown[] }): void {
  for (const hook of component.hooks) {
    if (hook && typeof hook === 'object' && 'type' in hook && hook.type === 'external') {
      const externalHook = hook as ExternalStoreHook<unknown>
      if (externalHook.unsubscribe) {
        externalHook.unsubscribe()
        externalHook.unsubscribe = undefined
      }
    }
  }
}

/**
 * Internal hook state for external store subscriptions
 */
interface ExternalStoreHook<T> {
  type: 'external'
  /** The current snapshot from the store */
  snapshot: T
  /** Unsubscribe function */
  unsubscribe?: () => void
}

// Import Hook type for type checking
import type { Hook } from '../component.ts'

/**
 * Update Scheduler
 *
 * Manages batching and scheduling of component updates.
 * Breaking circular dependency between component.ts and reconciler.ts
 */

import type { ComponentInstance } from './component.ts'

/**
 * Queue of components that need to be re-rendered
 */
const updateQueue: Set<ComponentInstance> = new Set()

/**
 * Whether an update has been scheduled
 */
let updateScheduled = false

/**
 * Render callback - set by the reconciler
 */
let renderCallback: ((component: ComponentInstance) => void) | null = null

/**
 * Set the render callback (called by reconciler on init)
 */
export function setRenderCallback(callback: (component: ComponentInstance) => void): void {
  renderCallback = callback
}

/**
 * Schedule a component update
 * Updates are batched using requestAnimationFrame
 */
export function scheduleUpdate(component: ComponentInstance): void {
  if (component.isUnmounted) {
    return
  }

  updateQueue.add(component)

  if (!updateScheduled) {
    updateScheduled = true

    // Use requestAnimationFrame for batching updates
    requestAnimationFrame(() => {
      flushUpdates()
    })
  }
}

/**
 * Flush all pending updates
 */
function flushUpdates(): void {
  const updates = Array.from(updateQueue)
  updateQueue.clear()
  updateScheduled = false

  if (!renderCallback) {
    console.warn('Scheduler: renderCallback not set, updates will be ignored')
    return
  }

  for (const comp of updates) {
    if (!comp.isUnmounted && comp.mountedNode) {
      renderCallback(comp)
    }
  }

  // Notify any waiting promises that updates are complete
  if (updateResolveCallback) {
    updateResolveCallback()
    updateResolveCallback = null
    updatePromise = null
  }
}

/**
 * Callback to notify waiting promises
 */
let updateResolveCallback: (() => void) | null = null

/**
 * Get a promise that resolves after all pending updates
 * Useful for testing
 */
let updatePromise: Promise<void> | null = null

export function getUpdatePromise(): Promise<void> {
  if (!updatePromise) {
    updatePromise = new Promise((resolve) => {
      if (updateQueue.size === 0 && !updateScheduled) {
        resolve()
        updatePromise = null
        return
      }

      // Store the resolve callback to be called after flushUpdates
      updateResolveCallback = resolve
    })
  }

  return updatePromise
}

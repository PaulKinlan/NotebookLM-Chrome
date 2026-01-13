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
 * Promise that resolves when the current flush completes
 * Used to track async flush operations
 */
let currentFlushPromise: Promise<void> | null = null

/**
 * Render callback - set by the reconciler
 * Must return a Promise to allow proper async tracking
 */
let renderCallback: ((component: ComponentInstance) => Promise<void>) | null = null

/**
 * Set the render callback (called by reconciler on init)
 */
export function setRenderCallback(callback: (component: ComponentInstance) => Promise<void>): void {
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
      // Store the flush promise so getUpdatePromise can wait for it
      currentFlushPromise = flushUpdates()
    })
  }
}

/**
 * Flush all pending updates
 * Returns a promise that resolves when all updates are complete
 */
async function flushUpdates(): Promise<void> {
  const updates = Array.from(updateQueue)
  updateQueue.clear()
  updateScheduled = false

  if (!renderCallback) {
    console.warn('Scheduler: renderCallback not set, updates will be ignored')
    currentFlushPromise = null
    return
  }

  // Await all component renders to ensure DOM updates complete
  for (const comp of updates) {
    if (!comp.isUnmounted && comp.mountedNode) {
      await renderCallback(comp)
    }
  }

  // Clear the flush promise when done
  currentFlushPromise = null
}

/**
 * Get a promise that resolves after all pending updates
 * Useful for testing
 */
export function getUpdatePromise(): Promise<void> {
  // In test environment, flush the RAF callback to trigger updates
  const flushRAF = (globalThis as { _flushRAF?: () => void })._flushRAF
  if (flushRAF) {
    flushRAF()
  }

  // If there's a flush in progress, wait for it to complete
  if (currentFlushPromise) {
    return currentFlushPromise
  }

  // No pending updates
  return Promise.resolve()
}

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
 * Set of components currently being rendered
 * Used to prevent re-entry and infinite loops
 */
export const currentlyRendering: Set<ComponentInstance> = new Set()

/**
 * Track which components have scheduled updates in the current batch
 * This provides automatic batching of multiple setState calls (like React 18+)
 */
const scheduledThisBatch: Set<ComponentInstance> = new Set()

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
 * Callback to reset render depth - set by reconciler to avoid circular import
 */
let resetRenderDepthCallback: (() => void) | null = null

/**
 * Track whether we're between flushes (i.e., ready for a new RAF cycle)
 */
let isBetweenFlushes = true

/**
 * Track components that were updated in the most recent flush
 * Used to reset their _flushUpdateCount after the flush completes
 */
const flushedComponents = new Set<ComponentInstance>()

/**
 * Set the render callback (called by reconciler on init)
 */
export function setRenderCallback(callback: (component: ComponentInstance) => Promise<void>): void {
  renderCallback = callback
}

/**
 * Set the reset render depth callback (called by reconciler on init)
 */
export function setResetRenderDepthCallback(callback: () => void): void {
  resetRenderDepthCallback = callback
}

/**
 * Mark a component as currently rendering
 * Called by renderComponent to prevent re-entry
 */
export function markRendering(component: ComponentInstance): void {
  currentlyRendering.add(component)
}

/**
 * Mark a component as done rendering
 * Called by renderComponent when render completes
 */
export function markRenderComplete(component: ComponentInstance): void {
  currentlyRendering.delete(component)
}

/**
 * Schedule a component update
 * Updates are batched using requestAnimationFrame
 */
export function scheduleUpdate(component: ComponentInstance): void {
  const componentName = component.fn.name || 'Anonymous'
  console.log(`[scheduleUpdate] Called for component "${componentName}"`)

  if (component.isUnmounted) {
    console.log(`[scheduleUpdate] Component "${componentName}" is unmounted, skipping`)
    return
  }

  // Prevent updates for components that are currently being rendered
  // This prevents infinite render loops
  if (currentlyRendering.has(component)) {
    console.log(`[scheduleUpdate] Component "${componentName}" is currently rendering, skipping (re-entry protection)`)
    return
  }

  // Clear per-flush counters at the start of a new batch (when we're between flushes
  // and a new update is being scheduled). This ensures components can update again
  // in the next RAF cycle after the previous flush completes.
  if (isBetweenFlushes) {
    isBetweenFlushes = false
    flushedComponents.clear()
    // Also clear the batch tracker
    console.log(`[scheduleUpdate] Starting new batch, clearing scheduledThisBatch (size: ${scheduledThisBatch.size})`)
    scheduledThisBatch.clear()
  }

  // If no update is currently scheduled (no pending RAF), clear any stale batch state
  // This handles the case where a previous RAF completed but scheduledThisBatch wasn't cleared
  if (!updateScheduled && scheduledThisBatch.size > 0) {
    console.log(`[scheduleUpdate] No update scheduled but scheduledThisBatch has ${scheduledThisBatch.size} components, clearing`)
    scheduledThisBatch.clear()
  }

  // Automatic batching: if this component already scheduled an update in the
  // current RAF batch, don't schedule again. This batches multiple setState
  // calls that happen synchronously (like in a useEffect or event handler).
  if (scheduledThisBatch.has(component)) {
    console.log(`[scheduleUpdate] Component "${componentName}" already in scheduledThisBatch, skipping`)
    return
  }

  // Mark as scheduled in this batch - will be cleared when RAF flush starts
  scheduledThisBatch.add(component)

  // Note: We NO LONGER skip updates if flushCount > 0.
  // The previous check prevented legitimate interactive state updates (e.g., clicking
  // a button to toggle a dropdown) when the component had already been updated once
  // in the current RAF cycle. The scheduledThisBatch check above provides sufficient
  // batching for synchronous setState calls, while allowing genuine state changes
  // triggered by user interactions to be processed immediately.

  // Debug logging to detect render loops
  const updateCount = (component as { _updateCount?: number })._updateCount || 0
  ;(component as { _updateCount?: number })._updateCount = updateCount + 1
  if (updateCount > 50) {
    console.error(`[Scheduler] Detected render loop in component "${componentName}": ${updateCount} total updates`)
    return
  }

  updateQueue.add(component)
  console.log(`[scheduleUpdate] Component "${componentName}" added to updateQueue, queue size: ${updateQueue.size}`)

  if (!updateScheduled) {
    updateScheduled = true
    console.log(`[scheduleUpdate] Scheduling RAF callback for component "${componentName}"`)

    // Use requestAnimationFrame for batching updates
    requestAnimationFrame(() => {
      console.log(`[scheduleUpdate] RAF callback executing, flushing updates`)
      // Store the flush promise so getUpdatePromise can wait for it
      currentFlushPromise = flushUpdates()
    })
  }
  else {
    console.log(`[scheduleUpdate] Update already scheduled, component "${componentName}" will be included in next flush`)
  }
}

/**
 * Flush all pending updates
 * Returns a promise that resolves when all updates are complete
 */
async function flushUpdates(): Promise<void> {
  console.log(`[flushUpdates] Starting flush, updateQueue size: ${updateQueue.size}`)

  // Clear the batch tracker - new setState calls can now schedule for the NEXT batch
  scheduledThisBatch.clear()

  // Clear the previous flush components set and populate with current batch
  flushedComponents.clear()

  // Reset global render depth at the start of each flush
  // This prevents depth from accumulating across multiple RAF cycles
  if (resetRenderDepthCallback) {
    resetRenderDepthCallback()
  }

  const updates = Array.from(updateQueue)
  updateQueue.clear()
  updateScheduled = false

  console.log(`[flushUpdates] Processing ${updates.length} component updates`)

  if (!renderCallback) {
    console.warn('Scheduler: renderCallback not set, updates will be ignored')
    currentFlushPromise = null
    isBetweenFlushes = true
    return
  }

  // Await all component renders to ensure DOM updates complete
  for (const comp of updates) {
    const compName = comp.fn.name || 'Anonymous'
    console.log(`[flushUpdates] Rendering component "${compName}"`)
    if (!comp.isUnmounted && comp.mountedNode) {
      markRendering(comp)
      try {
        await renderCallback(comp)
        console.log(`[flushUpdates] Completed rendering component "${compName}"`)
        // Track that this component was flushed - its _flushUpdateCount will be cleared in next batch
        flushedComponents.add(comp)
      }
      finally {
        markRenderComplete(comp)
      }
    }
  }

  // Mark that we're between flushes - the next scheduleUpdate will clear counters
  isBetweenFlushes = true

  console.log(`[flushUpdates] Flush complete`)

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

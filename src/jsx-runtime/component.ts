/**
 * Component Instance Tracking
 *
 * Manages component instances that persist across renders.
 * Each component instance stores its hooks, props, and DOM reference.
 */

import type { VNode } from './vnode.ts'
import { scheduleUpdate } from './scheduler.ts'

// Re-export scheduler functions for convenience
export { scheduleUpdate, getUpdatePromise } from './scheduler.ts'

/**
 * Hook storage for a single hook in a component instance
 */
export interface Hook {
  /** Hook type determines how it's processed during render */
  type: 'state' | 'effect' | 'memo' | 'callback' | 'context' | 'reducer' | 'layout' | 'external' | 'id'
  /** The current value of the hook */
  value: unknown
  /** Dependency array for memoization (effect, useMemo, useCallback) */
  deps?: unknown[]
  /** Cleanup function returned by useEffect */
  cleanup?: () => void
}

/**
 * A component instance is created once when a component first mounts
 * and persists across re-renders, storing state and hooks
 */
export interface ComponentInstance {
  /** The component function */
  fn: (props: Record<string, unknown>) => VNode | Node
  /** Current props passed to the component */
  props: Record<string, unknown>
  /** Hooks array - indexed by the order hooks are called */
  hooks: Hook[]
  /** Current hook index - resets to 0 on each render */
  hookIndex: number
  /** The VNode result from the last render */
  currentVNode: VNode | null
  /** The mounted DOM node (root of this component's rendered output) */
  mountedNode: Node | null
  /** Cleanup function to run when component unmounts */
  cleanup?: () => void
  /** Context values consumed by this component */
  context: Map<string, unknown>
  /** Parent component instance (for context propagation) */
  parent?: ComponentInstance | null
  /** Whether this component is currently unmounted */
  isUnmounted: boolean
  /** Error boundary state (for ErrorBoundary components) */
  errorState?: Error | null
  /** Whether this component is an error boundary */
  isErrorBoundary?: boolean
  /** Error boundary props (fallback, onError callback) */
  errorBoundaryProps?: {
    fallback?: (error: Error) => VNode | Node
    onError?: (error: Error, errorInfo: { componentStack?: string }) => void
  }
}

/**
 * Global current rendering component
 * Like React's internal state - set during component render
 */
let currentComponent: ComponentInstance | null = null

/**
 * Get the currently rendering component
 * Used by hooks to access their component instance
 */
export function getCurrentComponent(): ComponentInstance | null {
  return currentComponent
}

/**
 * Set the currently rendering component
 * Called by the reconciler when entering/leaving a component render
 */
export function setCurrentComponent(comp: ComponentInstance | null): void {
  currentComponent = comp
}

/**
 * Create a new component instance
 */
export function createComponentInstance(
  fn: ComponentInstance['fn'],
  props: Record<string, unknown>,
  parent?: ComponentInstance | null,
): ComponentInstance {
  return {
    fn,
    props,
    hooks: [],
    hookIndex: 0,
    currentVNode: null,
    mountedNode: null,
    context: new Map(),
    parent,
    isUnmounted: false,
  }
}

/**
 * Reset hook index for a new render
 * Must be called before running a component function
 */
export function resetHookIndex(component: ComponentInstance): void {
  component.hookIndex = 0
}

/**
 * Mark a component as unmounted
 * Prevents state updates after unmount
 */
export function unmountComponent(component: ComponentInstance): void {
  component.isUnmounted = true

  // Run all cleanup functions
  if (component.cleanup) {
    component.cleanup()
    component.cleanup = undefined
  }

  // Run hook cleanup functions in reverse order
  for (let i = component.hooks.length - 1; i >= 0; i--) {
    const hook = component.hooks[i]
    if (hook.cleanup) {
      hook.cleanup()
      hook.cleanup = undefined
    }
  }

  // External store cleanup is called by the reconciler to avoid circular dep
}

/**
 * Find the nearest error boundary ancestor of a component
 */
export function findNearestErrorBoundary(
  component: ComponentInstance,
): ComponentInstance | null {
  let current: ComponentInstance | null = component.parent ?? null
  while (current) {
    if (current.isErrorBoundary) {
      return current
    }
    current = current.parent ?? null
  }
  return null
}

/**
 * Capture an error in a component and propagate to nearest error boundary
 */
export function captureError(
  component: ComponentInstance,
  error: Error,
): boolean {
  const errorBoundary = findNearestErrorBoundary(component)

  if (errorBoundary) {
    // Set error state on the error boundary
    errorBoundary.errorState = error

    // Call the onError callback if provided
    if (errorBoundary.errorBoundaryProps?.onError) {
      errorBoundary.errorBoundaryProps.onError(error, {
        componentStack: `${component.fn.name || 'Anonymous'}`,
      })
    }

    // Trigger re-render of the error boundary
    scheduleUpdate(errorBoundary)

    return true // Error was captured
  }

  return false // No error boundary found
}

/**
 * Reset error state for a component (called after successful render)
 */
export function resetErrorState(component: ComponentInstance): void {
  if (component.isErrorBoundary && component.errorState) {
    component.errorState = null
  }
}

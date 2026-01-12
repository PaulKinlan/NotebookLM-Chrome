/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Error catching is integrated into the reconciler - when a child component
 * throws an error during rendering, it propagates up to the nearest ErrorBoundary.
 */

import { useState } from '../hooks/index.ts'
import { getCurrentComponent } from '../component.ts'

export interface ErrorBoundaryProps {
  children: Node
  fallback?: (error: Error) => Node
  fallbackClassName?: string
  onError?: (error: Error, errorInfo: { componentStack?: string }) => void
}

/**
 * ErrorInfo passed to the onError callback
 */
export interface ErrorInfo {
  /** The error that was thrown */
  error: Error
  /** Component stack (not available in this simplified implementation) */
  componentStack?: string
}

/**
 * Internal state for ErrorBoundary
 */
interface ErrorBoundaryState {
  error: Error | null
}

/**
 * ErrorBoundary Component
 *
 * Wraps children and catches any errors thrown during rendering.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error) => <div>Something went wrong: {error.message}</div>}
 *   onError={(error) => console.error('Caught error:', error)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary({
  children,
  fallback,
  fallbackClassName = 'error-boundary',
  onError: _onErrorIgnored, // Passed to reconciler via errorBoundaryProps, not used in component body
}: ErrorBoundaryProps): Node {
  // Note: onError is stored in the component instance by the reconciler
  // and called when errors are captured. We don't use it directly here.
  void _onErrorIgnored // Mark as used to satisfy linter

  const [localError, setLocalError] = useState<ErrorBoundaryState>({ error: null })

  // Get the current component instance to check for reconciler-set error
  const instance = getCurrentComponent()
  const instanceError = instance?.errorState ?? null

  // Use either the instance error (set by reconciler) or local error
  const error = instanceError ?? localError.error

  // If an error was caught, render the fallback
  if (error) {
    if (fallback) {
      return fallback(error)
    }

    // Default fallback UI with retry button
    return (
      <div className={fallbackClassName}>
        <h3>Something went wrong</h3>
        <p>{error.message}</p>
        <button
          type="button"
          onClick={() => {
            // Clear instance error state
            if (instance?.isErrorBoundary && instance.errorState) {
              instance.errorState = null
            }
            // Clear local error state
            setLocalError({ error: null })
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  // Render children normally
  return children
}

// Mark this component as an error boundary for the reconciler
;((ErrorBoundary as unknown) as { __isErrorBoundary: boolean }).__isErrorBoundary = true

/**
 * HOC to wrap a component with an error boundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   fallback: (error) => <div>Error: {error.message}</div>
 * })
 * ```
 */
export function withErrorBoundary<P extends Record<string, unknown>>(
  Component: (props: P) => Node,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>,
): (props: P) => Node {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }

  // Preserve component name for debugging (using Object.defineProperty to avoid type issues)
  const componentName = (Component as { displayName?: string, name?: string }).displayName
    || (Component as { name?: string }).name
    || 'Component'
  Object.defineProperty(WrappedComponent, 'displayName', {
    value: `withErrorBoundary(${componentName})`,
    writable: false,
  })

  return WrappedComponent
}

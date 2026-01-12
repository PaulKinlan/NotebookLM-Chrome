/**
 * Context API
 *
 * Provides a way to pass data through the component tree without
 * having to pass props down manually at every level.
 */

import type { VNode } from '../vnode.ts'
import { getCurrentComponent } from '../component.ts'

/**
 * Stack of active context values
 * Maps context ID -> array of values (stack)
 */
const contextStacks = new Map<string, unknown[]>()

/**
 * Get the current value for a context (top of stack)
 */
export function getContextValue<T>(id: string): T | undefined {
  const stack = contextStacks.get(id)
  return stack ? stack[stack.length - 1] as T : undefined
}

/**
 * Push a new context value onto the stack
 * Returns a cleanup function to pop the value
 */
export function pushContextValue(id: string, value: unknown): () => void {
  let stack = contextStacks.get(id)
  if (!stack) {
    stack = []
    contextStacks.set(id, stack)
  }
  stack.push(value)

  // Return cleanup function
  return () => {
    const currentStack = contextStacks.get(id)
    if (currentStack && currentStack.length > 0) {
      currentStack.pop()
    }
  }
}

/**
 * Context object represents a specific context
 */
export interface Context<T> {
  /** Unique identifier for this context */
  id: string
  /** Default value when no Provider is present */
  defaultValue: T
  /** Provider component factory */
  Provider: (props: { value: T, children: VNode | VNode[] | string }) => VNode
}

/**
 * Create a new context
 *
 * @param defaultValue - The default value when no Provider is used
 * @returns A Context object
 *
 * @example
 * ```tsx
 * const ThemeContext = createContext({ mode: 'light' })
 * ```
 */
export function createContext<T>(defaultValue: T): Context<T> {
  const id = `context-${crypto.randomUUID()}`

  const context: Context<T> = {
    id,
    defaultValue,
    Provider: props => ContextProvider({ context, ...props }),
  }

  return context
}

/**
 * useContext hook - read context value
 *
 * @param context - The context object to read from
 * @returns The current context value
 *
 * @example
 * ```tsx
 * const ThemeContext = createContext({ mode: 'light' })
 *
 * function Button() {
 *   const theme = useContext(ThemeContext)
 *   return <button style={{ background: theme.mode === 'dark' ? '#333' : '#fff' }}>
 *     Click me
 *   </button>
 * }
 * ```
 */
export function useContext<T>(context: Context<T>): T {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useContext can only be used in components')
  }

  // Check component's context cache first
  if (component.context.has(context.id)) {
    return component.context.get(context.id) as T
  }

  // Get current value from registry (set by Provider)
  const value = getContextValue<T>(context.id) ?? context.defaultValue

  // Cache in component for future reads
  component.context.set(context.id, value)

  return value
}

/**
 * Provider component props
 */
export interface ContextProviderProps<T> {
  context: Context<T>
  value: T
  children: VNode | VNode[] | string
}

/**
 * Provider component - makes a context value available to descendants
 *
 * This is a special internal component that manages context lifecycle.
 * It pushes the context value during render and pops it on cleanup.
 */
function ContextProviderComponent<T>({ context, value, children }: ContextProviderProps<T>): VNode {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('ContextProvider can only be used within a component')
  }

  // Push context value and get cleanup
  const popCleanup = pushContextValue(context.id, value)

  // Store cleanup in component's cleanup chain
  const existingCleanup = component.cleanup
  component.cleanup = () => {
    // Pop the context value first
    popCleanup()
    // Then run any existing cleanup
    if (existingCleanup) {
      existingCleanup()
    }
  }

  // Clear component's context cache so children will re-read the context
  component.context.delete(context.id)

  // Normalize children to array
  const childArray = Array.isArray(children) ? children : [children as VNode]

  // Create a fragment for children
  return {
    type: 'fragment',
    children: childArray,
  }
}

/**
 * Internal ContextProvider VNode creator
 * Wraps the provider component with proper context tracking
 */
export function ContextProvider<T>({ context, value, children }: ContextProviderProps<T>): VNode {
  return {
    type: 'component',
    fn: () => ContextProviderComponent({ context, value, children }),
    props: {
      context,
      value,
      children,
    } as unknown as Record<string, unknown>,
  }
}

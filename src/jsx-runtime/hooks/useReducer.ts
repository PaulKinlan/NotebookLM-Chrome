/**
 * useReducer Hook
 *
 * Manages complex state logic with reducer functions (Redux-style pattern).
 * Alternative to useState when state logic involves multiple sub-values or
 * when the next state depends on the previous one.
 */

import { getCurrentComponent } from '../component.ts'
import { scheduleUpdate } from '../scheduler.ts'

/**
 * Reducer function type
 * Takes current state and an action, returns new state
 */
export type Reducer<S, A> = (state: S, action: A) => S

/**
 * Dispatch function type
 * Accepts an action and queues a state update
 */
export type Dispatch<A> = (action: A) => void

/**
 * Hook state for storing reducer data
 */
interface ReducerHook<S, A> {
  type: 'reducer'
  /** Current state value */
  state: S
  /** The reducer function */
  reducer: Reducer<S, A>
  /** Dispatch function (stable across renders) */
  dispatch: Dispatch<A>
}

/**
 * useReducer hook options
 */
interface UseReducerOptions<S, A, I> {
  /** The reducer function */
  reducer: Reducer<S, A>
  /** Initial state value or init argument */
  initialArg: I | S
  /** Optional init function for lazy initialization */
  init?: (arg: I) => S
}

/**
 * useReducer hook - manages state with a reducer function
 *
 * @param options - Object containing reducer, initialArg, and optional init
 * @returns A tuple of [currentState, dispatch]
 *
 * @example
 * ```tsx
 * type Action = { type: 'increment' } | { type: 'decrement' } | { type: 'set'; value: number }
 *
 * function counterReducer(state: number, action: Action): number {
 *   switch (action.type) {
 *     case 'increment': return state + 1
 *     case 'decrement': return state - 1
 *     case 'set': return action.value
 *     default: return state
 *   }
 * }
 *
 * function Counter() {
 *   const [count, dispatch] = useReducer({
 *     reducer: counterReducer,
 *     initialArg: 0,
 *   })
 *   return (
 *     <div>
 *       <span>{count}</span>
 *       <button onClick={() => dispatch({ type: 'increment' })}>+</button>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With lazy initialization
 * function init(initialCount: number) {
 *   return { count: initialCount, step: 1 }
 * }
 *
 * function reducer(state, action) {
 *   switch (action.type) {
 *     case 'increment': return { ...state, count: state.count + state.step }
 *     case 'setStep': return { ...state, step: action.step }
 *     default: return state
 *   }
 * }
 *
 * function Counter({ initialCount = 0 }) {
 *   const [state, dispatch] = useReducer({
 *     reducer,
 *     initialArg: initialCount,
 *     init,
 *   })
 *   // ...
 * }
 * ```
 */
export function useReducer<S, A, I = S>(
  options: UseReducerOptions<S, A, I>,
): [S, Dispatch<A>] {
  const component = getCurrentComponent()
  if (!component) {
    throw new Error('useReducer can only be used in components')
  }

  const index = component.hookIndex++

  // Compute initial state
  const initialState: S = options.init
    ? (options.init as (arg: I) => S)(options.initialArg as I)
    : (options.initialArg as unknown as S)

  // Initialize hook if first render
  if (index >= component.hooks.length) {
    // Create stable dispatch function
    const dispatch = (action: A) => {
      const hook = component.hooks[index] as unknown as ReducerHook<S, A>
      if (!hook || hook.type !== 'reducer') {
        return
      }

      const nextState = hook.reducer(hook.state, action)

      // Only trigger update if state actually changed
      if (hook.state !== nextState) {
        hook.state = nextState
        scheduleUpdate(component)
      }
    }

    component.hooks.push({
      type: 'reducer',
      state: initialState,
      reducer: options.reducer,
      dispatch,
    } as unknown as Hook)
  }

  const hook = component.hooks[index] as unknown as ReducerHook<S, A>

  // Ensure reducer is up to date (in case it changed)
  hook.reducer = options.reducer

  return [hook.state, hook.dispatch]
}

// Import Hook type for type checking
import type { Hook } from '../component.ts'

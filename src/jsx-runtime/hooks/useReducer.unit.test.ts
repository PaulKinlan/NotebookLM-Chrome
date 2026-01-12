/**
 * Tests for useReducer hook
 */

import { describe, it, expect } from 'vitest'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useReducer', () => {
  it('should initialize with initial state and provide dispatch', async () => {
    const { useReducer } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let capturedState: number | null = null
    let capturedDispatch: ((action: unknown) => void) | null = null

    function Counter() {
      const [state, dispatch] = useReducer({
        reducer: (state: number, action: { type: 'increment' } | { type: 'decrement' }) => {
          if (action.type === 'increment') return state + 1
          if (action.type === 'decrement') return state - 1
          return state
        },
        initialArg: 0,
      })

      capturedState = state
      capturedDispatch = dispatch

      return textVNode(`Count: ${state}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Counter), container)

    expect(capturedState).toBe(0)
    expect(container.textContent).toBe('Count: 0')
    expect(capturedDispatch).not.toBeNull()
  })

  it('should update state when dispatch is called', async () => {
    const { useReducer, getUpdatePromise } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let dispatchFn: ((action: unknown) => void) | null = null

    function Counter() {
      const [count, dispatch] = useReducer({
        reducer: (state: number, action: { type: 'increment' } | { type: 'set'; value: number }) => {
          if (action.type === 'increment') return state + 1
          if (action.type === 'set') return action.value
          return state
        },
        initialArg: 0,
      })

      dispatchFn = dispatch

      return textVNode(`Count: ${count}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Counter), container)

    expect(container.textContent).toBe('Count: 0')

    dispatchFn!({ type: 'increment' })
    await getUpdatePromise()

    expect(container.textContent).toBe('Count: 1')
  })

  it('should support lazy initialization with init function', async () => {
    const { useReducer } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let capturedState: { count: number; step: number } | null = null

    function Counter() {
      const [state] = useReducer({
        reducer: (state: { count: number; step: number }, action: { type: 'increment' }) => ({
          ...state,
          count: state.count + state.step,
        }),
        initialArg: 5,
        init: (initial: number) => ({ count: initial, step: 2 }),
      })

      capturedState = state

      return textVNode(`Count: ${state.count}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Counter), container)

    expect(capturedState).toEqual({ count: 5, step: 2 })
    expect(container.textContent).toBe('Count: 5')
  })
})

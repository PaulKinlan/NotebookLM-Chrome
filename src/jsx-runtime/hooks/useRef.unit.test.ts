/**
 * Tests for useRef hook
 */

import { describe, it, expect } from 'vitest'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useRef', () => {
  it('should return a stable ref object with current property', async () => {
    const { useRef } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let capturedRef: { current: unknown } | null = null

    function Component() {
      const ref = useRef(42)
      capturedRef = ref
      return textVNode(`Value: ${ref.current}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(capturedRef).not.toBeNull()
    expect(capturedRef!.current).toBe(42)
    expect(container.textContent).toBe('Value: 42')
  })

  it('should persist ref value across re-renders', async () => {
    const { useRef, useState, getUpdatePromise } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let refValues: unknown[] = []
    let setCountFn: ((n: number) => void) | null = null

    function Component() {
      const [count, setCount] = useState(0)
      setCountFn = setCount
      const ref = useRef('initial')

      refValues.push(ref.current)

      if (count === 0) {
        ref.current = 'updated'
      }

      return textVNode(`Count: ${count}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    setCountFn!(1)
    await getUpdatePromise()

    expect(refValues[0]).toBe('initial')
    expect(refValues[1]).toBe('updated')
  })

  it('should allow mutating ref.current without triggering re-render', async () => {
    const { useRef, getUpdatePromise } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let renderCount = 0

    function Component() {
      renderCount++
      const ref = useRef(0)

      ref.current++

      return textVNode(`Value: ${ref.current}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    const initialRenders = renderCount

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(renderCount).toBe(initialRenders)
    expect(container.textContent).toBe('Value: 1')
  })
})

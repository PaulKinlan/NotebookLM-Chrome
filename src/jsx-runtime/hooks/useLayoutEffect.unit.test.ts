/**
 * Tests for useLayoutEffect hook
 */

import { describe, it, expect } from 'vitest'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useLayoutEffect', () => {
  it('should run effect synchronously before browser paint', async () => {
    const { useLayoutEffect } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let effectRun = false

    function Component() {
      useLayoutEffect(() => {
        effectRun = true
      }, [])

      return textVNode('Test')
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(effectRun).toBe(true)
  })

  it('should run cleanup function before next effect when deps change', async () => {
    const { useLayoutEffect, useState, getUpdatePromise } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let cleanupRun = false
    let setCountFn: ((n: number) => void) | null = null

    function Component() {
      const [count, setCount] = useState(0)
      setCountFn = setCount

      useLayoutEffect(() => {
        return () => {
          cleanupRun = true
        }
      }, [count])

      return textVNode(`Count: ${count}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(cleanupRun).toBe(false)

    setCountFn!(1)
    await getUpdatePromise()

    expect(cleanupRun).toBe(true)
  })

  it('should not run effect when dependencies have not changed', async () => {
    const { useLayoutEffect, useState, getUpdatePromise } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let effectRunCount = 0
    let setCountFn: ((n: number) => void) | null = null

    function Component() {
      const [count, setCount] = useState(0)
      setCountFn = setCount

      useLayoutEffect(() => {
        effectRunCount++
      }, [])

      return textVNode(`Count: ${count}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    const initialCount = effectRunCount

    setCountFn!(1)
    await getUpdatePromise()

    expect(effectRunCount).toBe(initialCount)
  })
})

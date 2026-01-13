/**
 * Tests for useState hook
 */

import { describe, it, expect } from 'vitest'
import { useState, getUpdatePromise } from './index.ts'
import { render } from '../render.ts'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useState', () => {
  it('should initialize with initial value', async () => {
    let getState: (() => number) | null = null

    function Counter() {
      const [count] = useState(0)
      const capturedCount = count
      getState = () => capturedCount
      return textVNode(`Count: ${count}`)
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(Counter), container)

    expect(container.textContent).toBe('Count: 0')
    expect(getState!()).toBe(0)
  })

  it('should update state and re-render', async () => {
    let setState: ((n: number) => void) | null = null

    function Counter() {
      const [count, setCount] = useState(0)
      setState = setCount
      return textVNode(`Count: ${count}`)
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(Counter), container)

    expect(container.textContent).toBe('Count: 0')

    setState!(1)
    await getUpdatePromise()

    expect(container.textContent).toBe('Count: 1')
  })
})

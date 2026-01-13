/**
 * Tests for useId hook
 */

import { describe, it, expect } from 'vitest'
import { useId, useState, getUpdatePromise } from './index.ts'
import { render } from '../render.ts'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useId', () => {
  it('should generate a stable ID across re-renders', async () => {
    let capturedIds: string[] = []
    let setCountFn: ((n: number) => void) | null = null

    function Component() {
      const [, setCount] = useState(0)
      setCountFn = setCount
      const id = useId()

      capturedIds.push(id)

      return textVNode(`ID: ${id}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    const firstId = capturedIds[0]

    setCountFn!(1)
    await getUpdatePromise()

    expect(capturedIds.length).toBeGreaterThan(1)
    expect(capturedIds.every(id => id === firstId)).toBe(true)
  })

  it('should generate unique IDs for multiple useId calls in same component', async () => {
    const ids: string[] = []

    function Component() {
      const id1 = useId()
      const id2 = useId()
      const id3 = useId()

      ids.push(id1, id2, id3)

      return textVNode('Has IDs')
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(new Set(ids).size).toBe(3)
  })

  it('should generate different IDs for different component instances', async () => {
    const ids: string[] = []

    function ComponentA() {
      const id = useId()
      ids.push(`A-${id}`)
      return textVNode('A')
    }

    function ComponentB() {
      const id = useId()
      ids.push(`B-${id}`)
      return textVNode('B')
    }

    const container = document.createElement('div')

    await render(componentVNode(ComponentA), container)
    container.innerHTML = ''
    await render(componentVNode(ComponentB), container)

    const idA = ids.find(i => i.startsWith('A-'))?.split('-')[1]
    const idB = ids.find(i => i.startsWith('B-'))?.split('-')[1]

    expect(idA).toBeDefined()
    expect(idB).toBeDefined()
    expect(idA).not.toBe(idB)
  })
})

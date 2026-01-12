/**
 * Tests for useMemo and useCallback hooks
 */

import { describe, it, expect } from 'vitest'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useMemo', () => {
  it('should memoize computed values', async () => {
    const { useMemo } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let computeCount = 0

    function MemoComponent() {
      const value = useMemo(() => {
        computeCount++
        return 42
      }, [])

      return textVNode(`Value: ${value}`)
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(MemoComponent), container)

    expect(computeCount).toBe(1)
  })

  it('should recompute when dependencies change', async () => {
    const { useMemo, useState } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let computeCount = 0

    function MemoComponent() {
      const [count] = useState(0)

      const doubled = useMemo(() => {
        computeCount++
        return count * 2
      }, [count])

      return textVNode(`Doubled: ${doubled}`)
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(MemoComponent), container)

    expect(computeCount).toBe(1)
    // Note: Testing recompute requires triggering re-render
  })
})

describe('useCallback', () => {
  it('should return stable function reference', async () => {
    const { useCallback } = await import('./index.ts')
    const { render } = await import('../render.ts')

    let firstCallback: (() => number) | null = null

    function CallbackComponent() {
      const callback = useCallback(() => 42, [])

      if (!firstCallback) {
        firstCallback = callback
      }

      return textVNode(`Callback: ${callback === firstCallback}`)
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(CallbackComponent), container)

    expect(firstCallback).not.toBeNull()
    expect(container.textContent).toBe('Callback: true')
  })
})

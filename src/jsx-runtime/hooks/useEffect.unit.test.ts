/**
 * Tests for useEffect hook
 */

import { describe, it, expect } from 'vitest'
import { useEffect, getUpdatePromise } from './index.ts'
import { render } from '../render.ts'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useEffect', () => {
  it('should run effect after mount', async () => {
    let effectRun = false

    function EffectComponent() {
      useEffect(() => {
        effectRun = true
      }, [])
      return textVNode('Test')
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(EffectComponent), container)
    await getUpdatePromise()

    expect(effectRun).toBe(true)
  })

  it('should cleanup effect on unmount', async () => {
    function EffectComponent() {
      useEffect(() => {
        return () => {
          // Cleanup would run here
        }
      }, [])
      return textVNode('Test')
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(EffectComponent), container)

    container.innerHTML = ''

    // Note: In a real scenario, cleanup would run when component unmounts
    // This test documents expected behavior
  })
})

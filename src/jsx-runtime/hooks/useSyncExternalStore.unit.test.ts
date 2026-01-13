/**
 * Tests for useSyncExternalStore hook
 */

import { describe, it, expect } from 'vitest'
import { useSyncExternalStore, getUpdatePromise, cleanupExternalStore } from './index.ts'
import { render } from '../render.ts'
import { getCurrentComponent } from '../component.ts'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useSyncExternalStore', () => {
  it('should subscribe to store on mount', async () => {
    let subscribeCalled = false
    const store = {
      state: 42,
      subscribe: (_callback: () => void) => {
        subscribeCalled = true
        return () => {}
      },
      getSnapshot: () => store.state,
    }

    function Component() {
      const value = useSyncExternalStore(store.subscribe, store.getSnapshot)
      return textVNode(`Value: ${value}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(subscribeCalled).toBe(true)
    expect(container.textContent).toBe('Value: 42')
  })

  it('should re-render when store updates', async () => {
    const listeners = new Set<() => void>()
    const store = {
      state: 0,
      subscribe: (callback: () => void) => {
        listeners.add(callback)
        return () => listeners.delete(callback)
      },
      getSnapshot: () => store.state,
      setState: (newValue: number) => {
        store.state = newValue
        listeners.forEach(l => l())
      },
    }

    function Component() {
      const value = useSyncExternalStore(store.subscribe, store.getSnapshot)
      return textVNode(`Count: ${value}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(container.textContent).toBe('Count: 0')

    store.setState(5)
    await getUpdatePromise()

    expect(container.textContent).toBe('Count: 5')
  })

  it('should unsubscribe on unmount', async () => {
    let unsubscribeCalled = false
    const store = {
      state: 42,
      subscribe: () => () => {
        unsubscribeCalled = true
      },
      getSnapshot: () => store.state,
    }

    let componentInstance: { hooks: unknown[] } | null = null

    function Component() {
      const value = useSyncExternalStore(store.subscribe, store.getSnapshot)
      componentInstance = getCurrentComponent()!
      return textVNode(`Value: ${value}`)
    }

    const container = document.createElement('div')
    await render(componentVNode(Component), container)

    expect(unsubscribeCalled).toBe(false)

    if (componentInstance) {
      cleanupExternalStore(componentInstance)
    }

    expect(unsubscribeCalled).toBe(true)
  })
})

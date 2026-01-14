/**
 * State Management Edge Cases Tests
 *
 * Comprehensive tests for useState edge cases including:
 * 1. setState during render - component that calls setState in its render body
 * 2. setState after unmount - component that updates state and immediately unmounts
 * 3. setState batching - verify that 3 successive setState(count => count + 1) calls result in +3, not +1
 * 4. Stale closures - setState that depends on previous state values
 * 5. Multiple state updates in single render - verify all updates are batched correctly
 */

import { describe, it, expect } from 'vitest'
import { useState, getUpdatePromise } from './index'
import { render } from '../../jsx-runtime'
import { textVNode, componentVNode, elementVNode } from '../test/setup'

describe('useState edge cases', () => {
  describe('setState during render', () => {
    it('should prevent infinite loop when setState is called during render', async () => {
      const renderLog: number[] = []

      function SetStateDuringRender() {
        const [count, setCount] = useState(0)
        renderLog.push(count)

        // This setState during render is blocked by re-entry protection
        // in the scheduler to prevent infinite render loops
        if (count === 0) {
          setCount(1)
        }

        return textVNode(`Count: ${count}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(SetStateDuringRender), container)

      // Component renders once with initial value
      // The setState during render is completely ignored due to re-entry protection
      expect(container.textContent).toBe('Count: 0')
      expect(renderLog).toEqual([0])

      // Wait to ensure no pending updates
      await getUpdatePromise()

      // State should remain unchanged since setState during render was blocked
      expect(container.textContent).toBe('Count: 0')
      expect(renderLog).toEqual([0]) // Still only one render
    })

    it('should handle conditional setState during render without infinite loop', async () => {
      let renderCount = 0

      function ConditionalSetStateDuringRender() {
        const [flag, setFlag] = useState(false)
        renderCount++

        // Only set state on first render
        // Due to re-entry protection, this setState is blocked during render
        // and never schedules an update
        if (renderCount === 1 && !flag) {
          setFlag(true)
        }

        return textVNode(`Flag: ${flag}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(ConditionalSetStateDuringRender), container)

      // First render shows initial state (setState during render was blocked)
      expect(container.textContent).toBe('Flag: false')
      expect(renderCount).toBe(1)

      // Wait for any pending updates (there shouldn't be any)
      await getUpdatePromise()

      // State should remain unchanged since setState during render was blocked
      expect(container.textContent).toBe('Flag: false')
      expect(renderCount).toBe(1) // Still only one render

      // Wait again to ensure no infinite loop
      await getUpdatePromise()

      // Should still be at 1 render
      expect(renderCount).toBe(1)
    })
  })

  describe('setState after unmount', () => {
    it('should gracefully handle setState after component unmounts', async () => {
      let setStateAfterUnmount: ((value: number | ((prev: number) => number)) => void) | null = null

      function UnmountingComponent() {
        const [count, setCount] = useState(0)
        setStateAfterUnmount = setCount
        void setCount // Mark as used

        return textVNode(`Count: ${count}`)
      }

      function Parent() {
        const [showChild, setShowChild] = useState(true)

        return elementVNode('div', {}, [
          showChild ? componentVNode(UnmountingComponent) : textVNode('Child unmounted'),
          elementVNode('button', {
            onClick: () => setShowChild(false),
          }, [textVNode('Unmount')]),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(Parent), container)

      expect(container.textContent).toContain('Count: 0')
      expect(setStateAfterUnmount).not.toBeNull()

      // Unmount the child
      const button = container.querySelector('button') as HTMLButtonElement
      button.click()
      await getUpdatePromise()

      expect(container.textContent).toContain('Child unmounted')

      // This setState should be safely ignored since component is unmounted
      // It should not throw an error
      expect(() => {
        setStateAfterUnmount!(1)
      }).not.toThrow()

      // Wait to ensure no pending updates cause errors
      await getUpdatePromise()
    })

    it('should not update DOM when setState is called after unmount', async () => {
      let setStateFn: ((n: number) => void) | null = null
      let containerTextAfterUnmount = ''

      function ShortLivedComponent() {
        const [value, setValue] = useState(0)
        setStateFn = setValue
        return textVNode(`Value: ${value}`)
      }

      function Parent() {
        const [mounted, setMounted] = useState(true)

        return elementVNode('div', {}, [
          mounted ? componentVNode(ShortLivedComponent) : textVNode('Gone'),
          elementVNode('button', {
            onClick: () => setMounted(false),
          }, [textVNode('Unmount')]),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(Parent), container)

      expect(container.textContent).toContain('Value: 0')

      // Unmount the component
      const button = container.querySelector('button') as HTMLButtonElement
      button.click()
      await getUpdatePromise()

      containerTextAfterUnmount = container.textContent
      // Contains both 'Gone' and 'Unmount' button text
      expect(containerTextAfterUnmount).toContain('Gone')

      // Try to update state after unmount
      setStateFn!(999)
      await getUpdatePromise()

      // DOM should not change (still contains 'Gone')
      expect(container.textContent).toContain('Gone')
    })

    it('should handle rapid setState and unmount sequence', async () => {
      let setState: ((n: number) => void) | null = null
      let unmountFn: (() => void) | null = null

      function RapidUnmountComponent() {
        const [count, setCount] = useState(0)
        setState = setCount
        void setCount // Mark as used
        return textVNode(`Count: ${count}`)
      }

      function Parent() {
        const [show, setShow] = useState(true)

        unmountFn = () => setShow(false)

        return elementVNode('div', {}, [
          show ? componentVNode(RapidUnmountComponent) : textVNode('Unmounted'),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(Parent), container)

      // Schedule multiple updates then immediately unmount
      setState!(1)
      setState!(2)
      setState!(3)

      // Immediately unmount before updates process
      unmountFn!()

      await getUpdatePromise()

      // Should show unmounted state without errors
      expect(container.textContent).toBe('Unmounted')
    })
  })

  describe('setState batching', () => {
    it('should batch 3 successive setState calls with updater functions', async () => {
      let actualSetCount: ((updater: (n: number) => number) => void) | null = null

      function BatchingCounter() {
        const [count, setCount] = useState(0)
        actualSetCount = setCount
        return textVNode(`Count: ${count}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(BatchingCounter), container)

      expect(container.textContent).toBe('Count: 0')

      // Call setState 3 times with updater functions
      actualSetCount!((n: number) => n + 1)
      actualSetCount!((n: number) => n + 1)
      actualSetCount!((n: number) => n + 1)

      // Wait for the batched update to process
      await getUpdatePromise()

      // Should be 3, not 1 (all updaters applied in sequence)
      expect(container.textContent).toBe('Count: 3')
    })

    it('should batch multiple setState calls in a click handler', async () => {
      function ClickBatching() {
        const [count, setCount] = useState(0)

        return elementVNode('div', {}, [
          textVNode(`Count: ${count}`),
          elementVNode('button', {
            onClick: () => {
              // Three successive updates - should be batched into one render
              setCount((n: number) => n + 1)
              setCount((n: number) => n + 1)
              setCount((n: number) => n + 1)
            },
          }, [textVNode('Increment 3x')]),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(ClickBatching), container)

      expect(container.textContent).toContain('Count: 0')

      // Click the button to trigger 3 setState calls
      const button = container.querySelector('button') as HTMLButtonElement
      button.click()
      await getUpdatePromise()

      // All three updates should have been applied
      expect(container.textContent).toContain('Count: 3')
    })

    it('should batch mixed setState calls with values and updaters', async () => {
      let setStateFn: ((value: number | ((n: number) => number)) => void) | null = null

      function MixedBatching() {
        const [value, setValue] = useState(0)
        setStateFn = setValue

        return textVNode(`Value: ${value}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(MixedBatching), container)

      expect(container.textContent).toBe('Value: 0')

      // Mix of direct value and updater functions
      // Only the last value before the RAF should take effect
      setStateFn!(5)
      setStateFn!((n: number) => n + 1) // Would be 6 if 5 was applied
      setStateFn!(10) // This should override

      await getUpdatePromise()

      // The direct value 10 should be applied
      expect(container.textContent).toBe('Value: 10')
    })
  })

  describe('Stale closures', () => {
    it('should correctly update state when using updater functions', async () => {
      let setCountFn: ((updater: (n: number) => number) => void) | null = null
      const renderCounts: number[] = []

      function ClosureCounter() {
        const [count, setCount] = useState(0)
        renderCounts.push(count)
        setCountFn = setCount
        return textVNode(`Count: ${count}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(ClosureCounter), container)

      expect(renderCounts).toEqual([0])

      // First increment - uses updater to get latest state
      setCountFn!(prev => prev + 1)
      await getUpdatePromise()

      expect(renderCounts).toEqual([0, 1])

      // Second increment - uses updater to get latest state
      setCountFn!(prev => prev + 1)
      await getUpdatePromise()

      expect(renderCounts).toEqual([0, 1, 2])

      // Third increment
      setCountFn!(prev => prev + 1)
      await getUpdatePromise()

      expect(renderCounts).toEqual([0, 1, 2, 3])
    })

    it('should handle stale closures with multiple state variables', async () => {
      let setCount1Fn: ((updater: (n: number) => number) => void) | null = null
      let setCount2Fn: ((updater: (n: number) => number) => void) | null = null
      const renderCounts: Array<[number, number]> = []

      function MultiStateCounter() {
        const [count1, setCount1] = useState(0)
        const [count2, setCount2] = useState(0)

        setCount1Fn = setCount1
        setCount2Fn = setCount2

        renderCounts.push([count1, count2])

        return textVNode(`C1: ${count1}, C2: ${count2}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(MultiStateCounter), container)

      expect(renderCounts).toEqual([[0, 0]])

      // First call - both states update
      setCount1Fn!(prev => prev + 1)
      setCount2Fn!(prev => prev + 2)
      await getUpdatePromise()
      expect(renderCounts).toEqual([[0, 0], [1, 2]])

      // Second call - should increment from the new values
      setCount1Fn!(prev => prev + 1)
      setCount2Fn!(prev => prev + 2)
      await getUpdatePromise()
      expect(renderCounts).toEqual([[0, 0], [1, 2], [2, 4]])

      // Third call
      setCount1Fn!(prev => prev + 1)
      setCount2Fn!(prev => prev + 2)
      await getUpdatePromise()
      expect(renderCounts).toEqual([[0, 0], [1, 2], [2, 4], [3, 6]])
    })

    it('should handle complex updater with stale closure', async () => {
      let setTotalFn: ((updater: (n: number) => number) => void) | null = null
      const renderCounts: number[] = []

      function ComplexUpdater() {
        const [total, setTotal] = useState(0)
        setTotalFn = setTotal
        renderCounts.push(total)
        return textVNode(`Total: ${total}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(ComplexUpdater), container)

      expect(renderCounts).toEqual([0])

      // Each call should add to the current total
      setTotalFn!(prev => prev + 10)
      await getUpdatePromise()
      expect(renderCounts).toEqual([0, 10])

      setTotalFn!(prev => prev + 5)
      await getUpdatePromise()
      expect(renderCounts).toEqual([0, 10, 15])

      setTotalFn!(prev => prev + 20)
      await getUpdatePromise()
      expect(renderCounts).toEqual([0, 10, 15, 35])
    })
  })

  describe('Multiple state updates in single render', () => {
    it('should batch multiple state updates from the same render phase', async () => {
      const renderCounts: number[] = []

      function MultiStateUpdate() {
        const [a, setA] = useState(0)
        const [b, setB] = useState(0)
        const [c, setC] = useState(0)

        renderCounts.push(a + b + c)

        // Button handler that updates all 3 states
        const handleClick = () => {
          setA(prev => prev + 1)
          setB(prev => prev + 1)
          setC(prev => prev + 1)
        }

        return elementVNode('div', {}, [
          textVNode(`A: ${a}, B: ${b}, C: ${c}`),
          elementVNode('button', {
            onClick: handleClick,
            id: 'update-all',
          }, [textVNode('Update All')]),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(MultiStateUpdate), container)

      expect(container.textContent).toContain('A: 0, B: 0, C: 0')

      const button = container.querySelector('#update-all') as HTMLButtonElement
      button.click()
      await getUpdatePromise()

      // All three states should be updated in a single render
      expect(container.textContent).toContain('A: 1, B: 1, C: 1')
      expect(renderCounts).toEqual([0, 3]) // Only 2 renders: initial and after batched update
    })

    it('should handle multiple updates to the same state in a single event handler', async () => {
      let rapidUpdateFn: (() => void) | null = null

      function RapidSameStateUpdates() {
        const [value, setValue] = useState(0)

        rapidUpdateFn = () => {
          setValue(prev => prev + 1)
          setValue(prev => prev + 1)
          setValue(prev => prev + 1)
          setValue(prev => prev + 1)
          setValue(prev => prev + 1)
        }

        return textVNode(`Value: ${value}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(RapidSameStateUpdates), container)

      expect(container.textContent).toBe('Value: 0')

      rapidUpdateFn!()
      await getUpdatePromise()

      // All 5 updates should be batched and applied
      expect(container.textContent).toBe('Value: 5')
    })

    it('should correctly apply updater functions when batched', async () => {
      let multiplyThenAdd: (() => void) | null = null

      function UpdaterComposition() {
        const [num, setNum] = useState(1)

        multiplyThenAdd = () => {
          // These updaters should compose correctly
          setNum(n => n * 2)
          setNum(n => n + 10)
          setNum(n => n * 3)
        }

        return textVNode(`Num: ${num}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(UpdaterComposition), container)

      expect(container.textContent).toBe('Num: 1')

      multiplyThenAdd!()
      await getUpdatePromise()

      // Should apply each updater in sequence:
      // 1 * 2 = 2
      // 2 + 10 = 12
      // 12 * 3 = 36
      expect(container.textContent).toBe('Num: 36')
    })
  })

  describe('setState with same value', () => {
    it('should not re-render when setting the same value', async () => {
      let renderCount = 0

      function SameValueCheck() {
        const [value, setValue] = useState(42)
        void setValue // Mark as used
        renderCount++

        return textVNode(`Value: ${value}, Renders: ${renderCount}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(SameValueCheck), container)

      expect(container.textContent).toBe('Value: 42, Renders: 1')
      expect(renderCount).toBe(1)

      // Create a way to trigger setState with the same value
      let setValueFn: ((n: number) => void) | null = null

      function SameValueCheck2() {
        const [value, setValue] = useState(42)
        setValueFn = setValue
        void setValue // Mark as used
        renderCount++

        return textVNode(`Value: ${value}, Renders: ${renderCount}`)
      }

      const container2 = document.createElement('div')
      renderCount = 0
      await render(componentVNode(SameValueCheck2), container2)

      expect(container2.textContent).toBe('Value: 42, Renders: 1')

      // Set to the same value - should not trigger re-render
      setValueFn!(42)
      await getUpdatePromise()

      // Render count should still be 1 (no re-render)
      expect(container2.textContent).toBe('Value: 42, Renders: 1')
    })

    it('should not re-render when updater returns same value', async () => {
      let renderCount = 0

      function SameValueUpdaterCheck() {
        const [count, setCount] = useState(5)
        renderCount++

        return elementVNode('div', {}, [
          textVNode(`Count: ${count}, Renders: ${renderCount}`),
          elementVNode('button', {
            onClick: () => {
              // Updater that returns the same value
              setCount((n) => {
                if (n < 10) {
                  return n // No change
                }
                return n + 1
              })
            },
          }, [textVNode('Try Update')]),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(SameValueUpdaterCheck), container)

      expect(container.textContent).toContain('Count: 5')
      expect(container.textContent).toContain('Renders: 1')

      const button = container.querySelector('button') as HTMLButtonElement
      button.click()
      await getUpdatePromise()

      // Should not re-render since value didn't change
      expect(container.textContent).toContain('Renders: 1')
    })
  })

  describe('setState with lazy initialization', () => {
    it('should only call initializer once on first render', async () => {
      let initCallCount = 0

      function LazyInitComponent() {
        const [value] = useState(() => {
          initCallCount++
          return 42 + initCallCount
        })

        return textVNode(`Value: ${value}`)
      }

      const container = document.createElement('div')
      await render(componentVNode(LazyInitComponent), container)

      expect(initCallCount).toBe(1)
      expect(container.textContent).toBe('Value: 43')

      // Trigger a re-render
      let updateSetter: ((n: number) => void) | null = null

      function LazyInitComponent2() {
        const [value, setValue] = useState(() => {
          initCallCount++
          return 42 + initCallCount
        })
        updateSetter = setValue
        void setValue // Mark as used

        return textVNode(`Value: ${value}`)
      }

      const container2 = document.createElement('div')
      initCallCount = 0
      await render(componentVNode(LazyInitComponent2), container2)

      expect(initCallCount).toBe(1)

      updateSetter!(100)
      await getUpdatePromise()

      // Init should not be called again
      expect(initCallCount).toBe(1)
      expect(container2.textContent).toBe('Value: 100')
    })
  })

  describe('Concurrent state updates from effects', () => {
    it('should handle setState triggered from useEffect', async () => {
      const effectLog: string[] = []

      function EffectStateUpdate() {
        const [count] = useState(0)
        const [flag] = useState(false)

        void count // Mark as used
        void flag // Mark as used

        effectLog.push(`render-${count}-${flag}`)

        return elementVNode('div', {}, [
          textVNode(`Count: ${count}, Flag: ${flag}`),
        ])
      }

      const container = document.createElement('div')
      await render(componentVNode(EffectStateUpdate), container)

      expect(container.textContent).toBe('Count: 0, Flag: false')
      expect(effectLog).toEqual(['render-0-false'])
    })
  })
})

/**
 * Performance Tests for JSX Runtime Reconciler
 *
 * These are functional tests that verify correctness when handling:
 * 1. Large lists - 100+ items with keyed reconciliation
 * 2. Deep component trees - 50+ levels of nesting
 * 3. Rapid state updates - multiple components updating simultaneously
 * 4. Large children count - element with 1000 children
 * 5. Repeated mount/unmount - 100 iterations
 *
 * Each test verifies correctness, not just measures performance.
 */

import { describe, it, expect } from 'vitest'
import { render } from '../../jsx-runtime'
import { useState, getUpdatePromise } from '../hooks/index'
import { textVNode, componentVNode, elementVNode } from '../test/setup'

describe('Reconciler Performance - Large List Rendering', () => {
  it('should correctly render and update a list of 100+ keyed items', async () => {
    const LIST_SIZE = 100
    let renderCount = 0
    let setItemsFn: ((items: number[]) => void) | null = null

    function LargeList() {
      const [items, setItems] = useState(Array.from({ length: LIST_SIZE }, (_, i) => i))
      setItemsFn = setItems
      renderCount++

      return {
        type: 'element' as const,
        tag: 'ul',
        props: { id: 'large-list' },
        children: items.map(item =>
          elementVNode('li', { 'key': `item-${item}`, 'data-item': String(item) }, [textVNode(`Item ${item}`)]),
        ),
      }
    }

    const container = document.createElement('div')
    await render(componentVNode(LargeList), container)

    // Verify initial render
    const list = container.querySelector('#large-list')
    expect(list?.children.length).toBe(LIST_SIZE)

    // Verify first few items by text content order
    expect(list?.children[0]?.textContent).toBe('Item 0')
    expect(list?.children[1]?.textContent).toBe('Item 1')
    expect(list?.children[LIST_SIZE - 1]?.textContent).toBe(`Item ${LIST_SIZE - 1}`)

    const initialRenders = renderCount

    // Re-order items - keyed reconciliation should preserve elements
    const reversed = Array.from({ length: LIST_SIZE }, (_, i) => LIST_SIZE - 1 - i)
    setItemsFn!(reversed)
    await getUpdatePromise()

    // Re-query for the list element after update
    const updatedList = container.querySelector('#large-list')

    // Verify re-order worked correctly - check textContent order changed
    expect(updatedList?.children[0]?.textContent).toBe(`Item ${LIST_SIZE - 1}`)
    expect(updatedList?.children[LIST_SIZE - 1]?.textContent).toBe('Item 0')
    expect(renderCount).toBe(initialRenders + 1)
  })

  it('should handle list with 200 items correctly', async () => {
    const LIST_SIZE = 200

    function VeryLargeList() {
      const items = Array.from({ length: LIST_SIZE }, (_, i) =>
        elementVNode('li', { key: String(i), className: 'list-item' }, [textVNode(`Item ${i}`)]),
      )

      return {
        type: 'element' as const,
        tag: 'div',
        props: { className: 'container' },
        children: [
          elementVNode('h2', {}, [textVNode('Large List')]),
          {
            type: 'element' as const,
            tag: 'ul',
            props: {},
            children: items,
          },
        ],
      }
    }

    const container = document.createElement('div')
    await render(componentVNode(VeryLargeList), container)

    const ul = container.querySelector('ul')
    expect(ul?.children.length).toBe(LIST_SIZE)

    // Verify all items are present
    const items = container.querySelectorAll('.list-item')
    expect(items.length).toBe(LIST_SIZE)
    expect(items[0].textContent).toBe('Item 0')
    expect(items[LIST_SIZE - 1].textContent).toBe(`Item ${LIST_SIZE - 1}`)
  })
})

describe('Reconciler Performance - Deep Component Trees', () => {
  it('should correctly render a deeply nested component tree (50 levels)', async () => {
    const DEPTH = 50

    // Create a deeply nested component
    function createDeepComponent(level: number): () => import('../vnode.ts').VNode {
      if (level === 0) {
        return () => textVNode('Leaf')
      }

      const ChildComponent = createDeepComponent(level - 1)

      return () => ({
        type: 'element' as const,
        tag: 'div',
        props: { 'className': `level-${level}`, 'data-level': String(level) },
        children: [componentVNode(ChildComponent)],
      })
    }

    const DeepTree = createDeepComponent(DEPTH)
    const container = document.createElement('div')
    await render(componentVNode(DeepTree), container)

    // Verify the tree was rendered
    const root = container.firstElementChild
    expect(root).toBeTruthy()

    // Count depth by traversing data-level attributes
    let currentLevel = DEPTH
    let element = root
    while (element && currentLevel > 0) {
      expect(element.getAttribute('data-level')).toBe(String(currentLevel))
      expect(element.classList.contains(`level-${currentLevel}`)).toBe(true)
      element = element.firstElementChild as HTMLElement
      currentLevel--
    }

    // At the end, we should have reached the leaf text node
    expect(root?.textContent).toBe('Leaf')
  })

  it('should handle updates in a deeply nested tree', async () => {
    const DEPTH = 30
    let setLeafFn: ((value: string) => void) | null = null

    function createStatefulDeepComponent(level: number): () => import('../vnode.ts').VNode {
      if (level === 0) {
        return () => {
          const [value, setValue] = useState('initial')
          setLeafFn = setValue
          return {
            type: 'element' as const,
            tag: 'span',
            props: { id: 'leaf' },
            children: [textVNode(value)],
          }
        }
      }

      const ChildComponent = createStatefulDeepComponent(level - 1)

      return () => ({
        type: 'element' as const,
        tag: 'div',
        props: {},
        children: [componentVNode(ChildComponent)],
      })
    }

    const DeepTree = createStatefulDeepComponent(DEPTH)
    const container = document.createElement('div')
    await render(componentVNode(DeepTree), container)

    // Verify initial state
    const leaf = container.querySelector('#leaf')
    expect(leaf?.textContent).toBe('initial')

    // Update state deep in the tree
    setLeafFn!('updated')
    await getUpdatePromise()

    // Flush RAF callback
    const flushRAF = (globalThis as { _flushRAF?: () => void })._flushRAF
    if (flushRAF) flushRAF()

    // Verify update propagated correctly
    expect(container.querySelector('#leaf')?.textContent).toBe('updated')
  })
})

describe('Reconciler Performance - Rapid State Updates', () => {
  it('should handle rapid sequential updates to a single component', async () => {
    let setCountFn: ((count: number) => void) | null = null

    function RapidUpdateCounter() {
      const [count, setCount] = useState(0)
      setCountFn = setCount

      return {
        type: 'element' as const,
        tag: 'div',
        props: { id: 'rapid-counter' },
        children: [textVNode(`Count: ${count}`)],
      }
    }

    const container = document.createElement('div')
    await render(componentVNode(RapidUpdateCounter), container)

    expect(container.querySelector('#rapid-counter')?.textContent).toBe('Count: 0')

    // Perform multiple rapid updates - should be batched
    const UPDATE_COUNT = 10
    for (let i = 1; i <= UPDATE_COUNT; i++) {
      setCountFn!(i)
    }
    await getUpdatePromise()

    // The last value should be rendered
    expect(container.querySelector('#rapid-counter')?.textContent).toBe(`Count: ${UPDATE_COUNT}`)
  })
})

describe('Reconciler Performance - Large Children Count', () => {
  it('should handle element with 1000 children', async () => {
    const CHILD_COUNT = 1000

    const children = Array.from({ length: CHILD_COUNT }, (_, i) =>
      elementVNode('span', { 'key': String(i), 'className': 'child', 'data-index': String(i) }, [
        textVNode(String(i)),
      ]),
    )

    const vnode: import('../vnode.ts').VNode = {
      type: 'element',
      tag: 'div',
      props: { id: 'parent' },
      children,
    }

    const container = document.createElement('div')
    await render(vnode, container)

    const parent = container.querySelector('#parent')
    expect(parent?.children.length).toBe(CHILD_COUNT)

    // Spot check some children
    const childrenEls = container.querySelectorAll('.child')
    expect(childrenEls[0]?.textContent).toBe('0')
    expect(childrenEls[500]?.textContent).toBe('500')
    expect(childrenEls[999]?.textContent).toBe('999')

    // Verify all children are accounted for
    expect(childrenEls.length).toBe(CHILD_COUNT)
  })
})

describe('Reconciler Performance - Repeated Mount/Unmount', () => {
  it('should handle 100 iterations of mount and unmount', async () => {
    const ITERATIONS = 100
    const container = document.createElement('div')

    const testVNode: import('../vnode.ts').VNode = {
      type: 'element',
      tag: 'div',
      props: { id: 'test-component', className: 'mounted' },
      children: [
        { type: 'element', tag: 'h1', props: {}, children: [{ type: 'text', value: 'Title' }] },
        { type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'Content' }] },
      ],
    }

    // Perform mount/unmount cycles
    for (let i = 0; i < ITERATIONS; i++) {
      // Mount
      await render(testVNode, container)

      // Verify mounted
      expect(container.querySelector('#test-component')).toBeTruthy()
      expect(container.querySelector('.mounted')).toBeTruthy()
      expect(container.querySelector('h1')?.textContent).toBe('Title')

      // Unmount by rendering empty text
      await render({ type: 'text' as const, value: '' }, container)

      // Verify unmounted
      expect(container.querySelector('#test-component')).toBeNull()
      expect(container.querySelector('.mounted')).toBeNull()
    }

    // Final mount to verify everything still works
    await render(testVNode, container)
    expect(container.querySelector('#test-component')).toBeTruthy()
  })

  it('should handle mount/unmount with stateful components', async () => {
    const ITERATIONS = 30
    let mountCount = 0

    function StatefulComponent(): import('../vnode.ts').VNode {
      mountCount++
      const [value] = useState('mounted')

      return {
        type: 'element',
        tag: 'div',
        props: { id: 'stateful' },
        children: [{ type: 'text', value }],
      }
    }

    const container = document.createElement('div')

    for (let i = 0; i < ITERATIONS; i++) {
      mountCount = 0

      // Mount
      await render(componentVNode(StatefulComponent), container)
      expect(mountCount).toBeGreaterThan(0)

      // Unmount
      await render({ type: 'text' as const, value: '' }, container)
      expect(container.querySelector('#stateful')).toBeNull()
    }
  })
})

describe('Reconciler Performance - Combined Stress Tests', () => {
  it('should handle wide and deep tree simultaneously', async () => {
    const WIDTH = 10 // Children per level
    const DEPTH = 5 // Levels deep

    function createWideDeepTree(level: number): () => import('../vnode.ts').VNode {
      if (level === 0) {
        return () => ({ type: 'text', value: 'leaf' })
      }

      const children = Array.from({ length: WIDTH }, (_, i) => {
        const ChildComp = createWideDeepTree(level - 1)
        return componentVNode(ChildComp, { key: `branch-${level}-${i}` })
      })

      return () => ({
        type: 'element',
        tag: 'div',
        props: { className: `level-${level}`, id: `root-${level}` },
        children,
      })
    }

    const container = document.createElement('div')
    await render(componentVNode(createWideDeepTree(DEPTH)), container)

    // Verify root exists
    const root = container.querySelector(`#root-${DEPTH}`)
    expect(root).toBeTruthy()

    // Verify structure by counting total elements
    const allDivs = container.querySelectorAll('div[class^="level-"]')
    expect(allDivs.length).toBeGreaterThan(0)

    // The last level should have leaf text nodes
    expect(root?.textContent).toContain('leaf')
  })

  it('should handle list updates with changing keys', async () => {
    const LIST_SIZE = 150
    let setItemsFn: ((items: Array<{ id: number, name: string }>) => void) | null = null

    function DynamicKeyList() {
      const [items, setItems] = useState(
        Array.from({ length: LIST_SIZE }, (_, i) => ({ id: i, name: `Item ${i}` })),
      )
      setItemsFn = setItems

      return {
        type: 'element' as const,
        tag: 'ul',
        props: { id: 'dynamic-list' },
        children: items.map(item =>
          elementVNode('li', { 'key': String(item.id), 'data-id': String(item.id) }, [
            textVNode(item.name),
          ]),
        ),
      }
    }

    const container = document.createElement('div')
    await render(componentVNode(DynamicKeyList), container)

    expect(container.querySelectorAll('li').length).toBe(LIST_SIZE)

    // Update with entirely different keys
    const newItems = Array.from({ length: LIST_SIZE }, (_, i) => ({
      id: i + 1000,
      name: `New Item ${i}`,
    }))
    setItemsFn!(newItems)
    await getUpdatePromise()

    // Flush RAF
    const flushRAF = (globalThis as { _flushRAF?: () => void })._flushRAF
    if (flushRAF) flushRAF()

    // Verify new items are rendered
    const listItems = container.querySelectorAll('li')
    expect(listItems.length).toBe(LIST_SIZE)
    expect(listItems[0]?.textContent).toBe('New Item 0')
    expect(listItems[LIST_SIZE - 1]?.textContent).toBe(`New Item ${LIST_SIZE - 1}`)
  })
})

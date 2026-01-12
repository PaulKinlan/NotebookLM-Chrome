/**
 * Tests for VNode reconciliation and key-based diffing
 */

import { describe, it, expect } from 'vitest'
import { textVNode, componentVNode, elementVNode } from './test/setup.ts'

describe('Key-Based Reconciliation', () => {
  it('should preserve keyed elements during re-order', async () => {
    const { render } = await import('./render.ts')
    const { useState, getUpdatePromise } = await import('./hooks/index.ts')

    let renderCount = 0
    let setItemsFn: ((items: string[]) => void) | null = null

    function List() {
      const [items, setItems] = useState(['a', 'b', 'c'])
      setItemsFn = setItems

      renderCount++

      return {
        type: 'element' as const,
        tag: 'ul',
        props: {},
        children: items.map(item =>
          elementVNode('li', { key: item }, [textVNode(item)]),
        ),
      }
    }

    const container = document.createElement('div')
    await render(componentVNode(List), container)

    const initialRenders = renderCount
    expect(container.textContent).toBe('abc')

    setItemsFn!(['c', 'a', 'b'])
    await getUpdatePromise()

    expect(container.textContent).toBe('cab')
    expect(renderCount).toBe(initialRenders + 1)
  })

  it('should add and remove elements by key', async () => {
    const { render } = await import('./render.ts')
    const { useState, getUpdatePromise } = await import('./hooks/index.ts')

    let setItemsFn: ((items: string[]) => void) | null = null

    function List() {
      const [items, setItems] = useState(['a', 'b', 'c'])
      setItemsFn = setItems

      return {
        type: 'element' as const,
        tag: 'ul',
        props: {},
        children: items.map(item =>
          elementVNode('li', { key: item }, [textVNode(item)]),
        ),
      }
    }

    const container = document.createElement('div')
    await render(componentVNode(List), container)

    expect(container.textContent).toBe('abc')

    setItemsFn!(['a', 'c', 'd'])
    await getUpdatePromise()

    expect(container.textContent).toBe('acd')
  })
})

describe('VNode Reconciliation', () => {
  it('should mount text nodes', async () => {
    const { renderToDOM } = await import('./render.ts')

    const vnode = textVNode('Hello World')
    const node = await renderToDOM(vnode)

    expect(node.nodeType).toBe(globalThis.Node.TEXT_NODE)
    expect(node.textContent).toBe('Hello World')
  })

  it('should mount element nodes with props', async () => {
    const { renderToDOM } = await import('./render.ts')
    type VNode = import('./vnode.ts').VNode

    const vnode: VNode = {
      type: 'element',
      tag: 'button',
      props: {
        className: 'btn',
        id: 'my-button',
        onClick: () => console.log('clicked'),
      },
      children: [textVNode('Click me')],
    }

    const node = await renderToDOM(vnode)

    expect(node.nodeType).toBe(globalThis.Node.ELEMENT_NODE)
    expect((node as Element).tagName).toBe('BUTTON')
    expect((node as Element).id).toBe('my-button')
    expect((node as Element).className).toBe('btn')
  })

  it('should mount fragments', async () => {
    const { render } = await import('./render.ts')
    type VNode = import('./vnode.ts').VNode

    const vnode: VNode = {
      type: 'fragment',
      children: [
        textVNode('Hello '),
        textVNode('World'),
      ],
    }

    const container = document.createElement('div')
    await render(vnode, container)

    expect(container.childNodes.length).toBe(2)
    expect(container.textContent).toBe('Hello World')
  })
})

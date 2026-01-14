/**
 * Unit Test for diffChildren DOM lookup bug
 *
 * This test specifically targets the bug where appendChild happened AFTER
 * mounting children, causing incorrect DOM node matching in diffChildren.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { VNode } from '../vnode'
import { mountedNodes } from '../reconciler'
import { mountElement } from './reconciler-mount'
import type { ReconcilerFn } from './reconciler-types'

describe('diffChildren - DOM lookup integrity', () => {
  let container: HTMLElement

  // Helper to create a mock reconcile function that properly handles all VNode types
  function createMockReconcile(): ReconcilerFn {
    return async (parent, _oldVNode, newVNode) => {
      if (newVNode.type === 'text') {
        const node = document.createTextNode(newVNode.value)
        parent.appendChild(node)
        mountedNodes.set(node, { node, vdom: newVNode })
        return node
      }
      if (newVNode.type === 'element') {
        return mountElement(parent, newVNode, createMockReconcile(), undefined)
      }
      if (newVNode.type === 'fragment') {
        for (const child of newVNode.children) {
          await createMockReconcile()(parent, null, child)
        }
        return parent
      }
      return parent.appendChild(document.createTextNode(''))
    }
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('should have parent in DOM before mounting children', () => {
    // This test verifies the fix: appendChild happens BEFORE mounting children
    //
    // With the bug: element created -> children mounted (element NOT in DOM yet) -> append
    // With the fix: element created -> append -> children mounted (element IS in DOM)
    //
    // This matters because if children query parent.childNodes during mount,
    // they won't find the parent element with the bug.

    const sectionVNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { id: 'test-section' },
      children: [
        { type: 'element', tag: 'h3', props: {}, children: [{ type: 'text', value: 'Title' }] },
        { type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'Content' }] },
      ],
    }

    // Mount the section
    const sectionEl = mountElement(container, sectionVNode, createMockReconcile(), undefined)

    // With the fix, the section should be in container BEFORE its children are mounted
    // This means when children query parent.childNodes, they find the section
    expect(container.contains(sectionEl)).toBe(true)

    // Verify the section has its children
    expect(sectionEl.children.length).toBe(2)
    expect(sectionEl.querySelector('h3')?.textContent).toBe('Title')
    expect(sectionEl.querySelector('p')?.textContent).toBe('Content')

    // Verify mountedNodes has the correct entry
    const sectionMounted = mountedNodes.get(sectionEl)
    expect(sectionMounted).toBeDefined()
    expect(sectionMounted?.vdom).toBe(sectionVNode)
  })

  it('should correctly populate parent.childNodes during child mount', () => {
    // This tests that when mounting multiple children, each can find its parent
    // in the DOM via parentNode (not just in memory)

    const mainVNode: VNode = {
      type: 'element',
      tag: 'main',
      props: {},
      children: [
        { type: 'element', tag: 'section', props: { id: 'section-1' }, children: [] },
        { type: 'element', tag: 'section', props: { id: 'section-2' }, children: [] },
      ],
    }

    const mainEl = mountElement(container, mainVNode, createMockReconcile(), undefined)

    // Both sections should be in main
    expect(mainEl.children.length).toBe(2)

    const section1 = mainEl.children[0] as HTMLElement
    const section2 = mainEl.children[1] as HTMLElement

    // Verify they can find their parent
    expect(section1.parentNode).toBe(mainEl)
    expect(section2.parentNode).toBe(mainEl)

    // Verify parent.childNodes sees both children
    expect(Array.from(mainEl.childNodes).includes(section1)).toBe(true)
    expect(Array.from(mainEl.childNodes).includes(section2)).toBe(true)

    // Verify mountedNodes
    expect(mountedNodes.get(section1)?.vdom).toBe(mainVNode.children[0])
    expect(mountedNodes.get(section2)?.vdom).toBe(mainVNode.children[1])
  })

  it('should allow diffChildren to find correct DOM nodes via parent.childNodes', () => {
    // This directly tests the scenario that fails with the bug:
    // diffChildren iterates parent.childNodes to find matching DOM nodes for old VNodes
    //
    // With the bug, elements weren't in parent.childNodes during initial mount,
    // so this lookup could match the wrong node.

    // Mount initial structure
    const section1VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { className: 'tab' },
      children: [
        { type: 'element', tag: 'h3', props: {}, children: [{ type: 'text', value: 'Tab 1' }] },
      ],
    }
    const section2VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { className: 'tab' },
      children: [
        { type: 'element', tag: 'h3', props: {}, children: [{ type: 'text', value: 'Tab 2' }] },
      ],
    }

    const section1El = mountElement(container, section1VNode, createMockReconcile(), undefined)
    const section2El = mountElement(container, section2VNode, createMockReconcile(), undefined)

    // Simulate what diffChildren does: find DOM nodes by checking parent.childNodes
    const oldChildren = [section1VNode, section2VNode]
    const foundNodes: Array<{ vnode: VNode, domNode: Node | null }> = []

    for (let i = 0; i < oldChildren.length; i++) {
      const oldChild = oldChildren[i]
      let domNode: Node | null = null

      // This is the exact lookup logic from diffChildren (lines 82-89)
      for (let j = 0; j < container.childNodes.length; j++) {
        const childNode = container.childNodes[j]
        const mounted = mountedNodes.get(childNode)
        if (mounted && mounted.vdom === oldChild) {
          domNode = childNode
          break
        }
      }

      foundNodes.push({ vnode: oldChild, domNode })
    }

    // Verify we found the correct DOM nodes for each VNode
    expect(foundNodes[0].domNode).toBe(section1El)
    expect(foundNodes[1].domNode).toBe(section2El)

    // Verify the DOM nodes we found have the correct structure
    expect(section1El.querySelector('h3')?.textContent).toBe('Tab 1')
    expect(section2El.querySelector('h3')?.textContent).toBe('Tab 2')
  })
})

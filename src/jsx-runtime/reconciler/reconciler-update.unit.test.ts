/**
 * Unit Test for updateElement DOM lookup bug
 *
 * This test targets the bug where updateElement's element lookup
 * can match the wrong DOM element when there are multiple elements
 * with the same tag and no keys.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { VNode } from '../vnode'
import { mountedNodes } from '../reconciler'
import { mountElement } from './reconciler-mount'
import { updateElement } from './reconciler-update'
import type { ReconcilerFn } from './reconciler-types'

describe('updateElement - DOM lookup integrity', () => {
  let container: HTMLElement

  // Helper to create a mock reconcile function
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

  it('should correctly match elements by VNode reference', async () => {
    // This test verifies that updateElement can find the correct DOM element
    // when there are multiple elements with the same tag.

    // Mount two sections with different content
    const section1VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { id: 'section-1' },
      children: [
        { type: 'text', value: 'Section 1 content' },
      ],
    }

    const section2VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { id: 'section-2' },
      children: [
        { type: 'text', value: 'Section 2 content' },
      ],
    }

    const section1El = mountElement(container, section1VNode, createMockReconcile(), undefined)
    mountElement(container, section2VNode, createMockReconcile(), undefined)

    // Verify both sections are in the DOM
    expect(container.children.length).toBe(2)
    expect(section1El.id).toBe('section-1')

    // Now update section1 with new content (same VNode reference)
    const updatedSection1VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { id: 'section-1', className: 'updated' },
      children: [
        { type: 'text', value: 'Updated content' },
      ],
    }

    // Call updateElement - it should find section1El by VNode reference
    const result = await updateElement(container, section1VNode, updatedSection1VNode, createMockReconcile()) as HTMLElement

    // The result should be section1El, not section2
    expect(result).toBe(section1El)
    expect(result.id).toBe('section-1')
    expect(result.className).toBe('updated')

    // Section 2 should be unchanged
    const section2El = container.children[1] as HTMLElement
    expect(section2El.id).toBe('section-2')
    expect(section2El.className).toBe('')
  })

  it('should use VNode reference matching, not position-based', async () => {
    // This test verifies that the lookup uses VNode reference matching
    // from mountedNodes, not just position-based fallback.

    const section1VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { className: 'first' },
      children: [{ type: 'text', value: 'First' }],
    }

    const section2VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { className: 'second' },
      children: [{ type: 'text', value: 'Second' }],
    }

    const section1El = mountElement(container, section1VNode, createMockReconcile(), undefined)
    const section2El = mountElement(container, section2VNode, createMockReconcile(), undefined)

    // Verify mountedNodes has correct VNode references
    const mounted1 = mountedNodes.get(section1El)
    const mounted2 = mountedNodes.get(section2El)

    expect(mounted1?.vdom).toBe(section1VNode)
    expect(mounted2?.vdom).toBe(section2VNode)

    // Update section1 using the original VNode reference
    const updatedSection1VNode: VNode = {
      type: 'element',
      tag: 'section',
      props: { className: 'first-updated' },
      children: [{ type: 'text', value: 'First updated' }],
    }

    const result = await updateElement(container, section1VNode, updatedSection1VNode, createMockReconcile()) as HTMLElement

    // Should match section1 by VNode reference, not by position
    expect(result).toBe(section1El)
    expect(result.className).toBe('first-updated')

    // section2 should be completely unchanged
    expect(section2El.className).toBe('second')
  })
})

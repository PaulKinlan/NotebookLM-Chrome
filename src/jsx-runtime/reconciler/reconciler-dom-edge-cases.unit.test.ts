/**
 * Unit Test for JSX Runtime DOM Edge Cases
 *
 * This test suite covers edge cases in DOM manipulation during reconciliation:
 * 1. Select element value timing - dynamic options with value changes between renders
 * 2. Nested SVG namespace - SVG inside foreignObject, verify namespace propagation
 * 3. Incorrect ordering verification - complex DOM structures with nested components
 * 4. Duplicate node prevention - verify DOM nodes aren't duplicated during reconciliation
 * 5. Text node updates - verify text content is correctly updated
 * 6. Attribute updates - verify className, id, and other attributes update correctly
 */

import { describe, it, expect } from 'vitest'
import { jsx, render } from '../../jsx-runtime'
import { mountedNodes } from '../reconciler'

// Create a simple test container
function createTestContainer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

function cleanupTestContainer(container: HTMLElement) {
  document.body.removeChild(container)
}

describe('JSX Runtime - DOM Edge Cases', () => {
  describe('Select element value timing', () => {
    it('should correctly set value when options are dynamically added', async () => {
      const container = createTestContainer()

      // Initial render with empty select
      const initialVNode = jsx('select', { id: 'test-select', value: 'option-2', children: [
        jsx('option', { value: 'option-1', children: 'Option 1' }),
        jsx('option', { value: 'option-2', children: 'Option 2' }),
        jsx('option', { value: 'option-3', children: 'Option 3' }),
      ] })

      await render(initialVNode, container)

      const select = container.querySelector('#test-select') as HTMLSelectElement
      expect(select).toBeDefined()
      expect(select.value).toBe('option-2')
      expect(select.selectedIndex).toBe(1)

      cleanupTestContainer(container)
    })

    it('should update value when options change between renders', async () => {
      const container = createTestContainer()

      // Initial render with first set of options
      const initialVNode = jsx('select', { id: 'test-select', value: 'a', children: [
        jsx('option', { value: 'a', children: 'A' }),
        jsx('option', { value: 'b', children: 'B' }),
      ] })

      await render(initialVNode, container)

      let select = container.querySelector('#test-select') as HTMLSelectElement
      expect(select.value).toBe('a')

      // Re-render with different options and value
      const updatedVNode = jsx('select', { id: 'test-select', value: 'x', children: [
        jsx('option', { value: 'x', children: 'X' }),
        jsx('option', { value: 'y', children: 'Y' }),
        jsx('option', { value: 'z', children: 'Z' }),
      ] })

      await render(updatedVNode, container)

      select = container.querySelector('#test-select') as HTMLSelectElement
      expect(select.value).toBe('x')
      expect(select.options.length).toBe(3)

      cleanupTestContainer(container)
    })

    it('should handle select with value that does not match any option', async () => {
      const container = createTestContainer()

      // Select with value that doesn't exist in options
      const vnode = jsx('select', { id: 'test-select', value: 'non-existent', children: [
        jsx('option', { value: 'a', children: 'A' }),
        jsx('option', { value: 'b', children: 'B' }),
      ] })

      await render(vnode, container)

      const select = container.querySelector('#test-select') as HTMLSelectElement
      expect(select).toBeDefined()
      // When value doesn't match any option, browsers reset to empty string
      expect(select.value).toBe('')

      cleanupTestContainer(container)
    })

    it('should preserve select value when updating unrelated props', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('select', { id: 'test-select', className: 'initial', value: 'b', children: [
        jsx('option', { value: 'a', children: 'A' }),
        jsx('option', { value: 'b', children: 'B' }),
      ] })

      await render(initialVNode, container)

      const select = container.querySelector('#test-select') as HTMLSelectElement
      expect(select.value).toBe('b')

      // Simulate user changing the value
      select.value = 'a'

      // Update className only - value should remain
      const updatedVNode = jsx('select', { id: 'test-select', className: 'updated', value: 'b', children: [
        jsx('option', { value: 'a', children: 'A' }),
        jsx('option', { value: 'b', children: 'B' }),
      ] })

      await render(updatedVNode, container)

      const updatedSelect = container.querySelector('#test-select') as HTMLSelectElement
      expect(updatedSelect.className).toBe('updated')
      // Value should be set back to 'b' from vnode props
      expect(updatedSelect.value).toBe('b')

      cleanupTestContainer(container)
    })
  })

  describe('Nested SVG namespace', () => {
    it('should correctly create SVG elements with proper namespace', async () => {
      const container = createTestContainer()

      const svgVNode = jsx('svg', { width: '100', height: '100', children: [
        jsx('circle', { cx: '50', cy: '50', r: '40', fill: 'red' }),
        jsx('rect', { x: '10', y: '10', width: '30', height: '30', fill: 'blue' }),
      ] })

      await render(svgVNode, container)

      const svg = container.querySelector('svg') as SVGSVGElement
      expect(svg).toBeDefined()
      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')

      const circle = svg.querySelector('circle') as SVGCircleElement
      expect(circle).toBeDefined()
      expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(circle.getAttribute('cx')).toBe('50')

      const rect = svg.querySelector('rect') as SVGRectElement
      expect(rect).toBeDefined()
      expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg')

      cleanupTestContainer(container)
    })

    it('should handle nested SVGs with proper namespace propagation', async () => {
      const container = createTestContainer()

      const svgVNode = jsx('svg', { width: '200', height: '200', children: [
        jsx('g', { id: 'group-1', children: [
          jsx('circle', { cx: '50', cy: '50', r: '20', fill: 'red' }),
        ] }),
        jsx('svg', { x: '100', y: '100', width: '80', height: '80', children: [
          jsx('circle', { cx: '40', cy: '40', r: '30', fill: 'blue' }),
        ] }),
      ] })

      await render(svgVNode, container)

      const outerSvg = container.firstElementChild as SVGSVGElement
      expect(outerSvg.namespaceURI).toBe('http://www.w3.org/2000/svg')

      const group = outerSvg.querySelector('g') as SVGGElement
      expect(group.namespaceURI).toBe('http://www.w3.org/2000/svg')

      const innerSvg = outerSvg.querySelector('svg') as SVGSVGElement
      expect(innerSvg.namespaceURI).toBe('http://www.w3.org/2000/svg')

      const innerCircle = innerSvg.querySelector('circle') as SVGCircleElement
      expect(innerCircle.namespaceURI).toBe('http://www.w3.org/2000/svg')

      cleanupTestContainer(container)
    })

    it('should handle foreignObject on initial render', async () => {
      const container = createTestContainer()

      const svgVNode = jsx('svg', { width: '300', height: '200', children: [
        jsx('foreignObject', { x: '20', y: '20', width: '260', height: '160', children: [
          jsx('div', { style: { background: 'lightblue', padding: '10px' }, children: [
            jsx('h3', { children: 'HTML Content inside SVG' }),
            jsx('p', { children: 'This paragraph is in the foreignObject' }),
          ] }),
        ] }),
      ] })

      await render(svgVNode, container)

      const svg = container.querySelector('svg') as SVGSVGElement
      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')

      const foreignObject = svg.querySelector('foreignObject')
      expect(foreignObject).toBeDefined()
      expect(foreignObject?.namespaceURI).toBe('http://www.w3.org/2000/svg')

      const div = foreignObject?.querySelector('div')
      expect(div).toBeDefined()

      const h3 = foreignObject?.querySelector('h3')
      expect(h3?.textContent).toBe('HTML Content inside SVG')

      cleanupTestContainer(container)
    })

    it('should handle SVG path elements with complex attributes', async () => {
      const container = createTestContainer()

      const svgVNode = jsx('svg', { width: '100', height: '100', viewBox: '0 0 100 100', children: [
        jsx('path', { d: 'M 10 10 L 90 90', stroke: 'black', strokeWidth: '2' }),
      ] })

      await render(svgVNode, container)

      const path = container.querySelector('path') as SVGPathElement
      expect(path).toBeDefined()
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.getAttribute('d')).toBe('M 10 10 L 90 90')
      expect(path.getAttribute('stroke')).toBe('black')
      expect(path.getAttribute('strokeWidth')).toBe('2')

      cleanupTestContainer(container)
    })
  })

  describe('Incorrect ordering verification', () => {
    it('should maintain correct child order in complex nested structures', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'root', children: [
        jsx('section', { id: 'first', children: [
          jsx('span', { id: 'first-1', className: 'a', children: 'A' }),
          jsx('span', { id: 'first-2', className: 'b', children: 'B' }),
          jsx('span', { id: 'first-3', className: 'c', children: 'C' }),
        ] }),
        jsx('section', { id: 'second', children: [
          jsx('span', { id: 'second-1', className: 'x', children: 'X' }),
          jsx('span', { id: 'second-2', className: 'y', children: 'Y' }),
        ] }),
        jsx('section', { id: 'third', children: [
          jsx('span', { id: 'third-1', className: '1', children: '1' }),
        ] }),
      ] })

      await render(vnode, container)

      const root = container.querySelector('#root') as HTMLElement
      const children = Array.from(root.children)

      expect(children.length).toBe(3)
      expect(children[0].id).toBe('first')
      expect(children[1].id).toBe('second')
      expect(children[2].id).toBe('third')

      // Check order within first section
      const first = root.querySelector('#first') as HTMLElement
      const firstChildren = Array.from(first.children)
      expect(firstChildren[0].id).toBe('first-1')
      expect(firstChildren[1].id).toBe('first-2')
      expect(firstChildren[2].id).toBe('first-3')

      cleanupTestContainer(container)
    })

    it('should maintain order when re-rendering with same structure', async () => {
      const container = createTestContainer()

      function App() {
        return jsx('main', { children: [
          jsx('div', { id: 'item-1', children: 'First' }),
          jsx('div', { id: 'item-2', children: 'Second' }),
          jsx('div', { id: 'item-3', children: 'Third' }),
        ] })
      }

      await render(jsx(App, {}), container)

      const main = container.querySelector('main') as HTMLElement
      const firstOrder = Array.from(main.children).map(c => c.id)

      await render(jsx(App, {}), container)

      const secondOrder = Array.from(main.children).map(c => c.id)

      expect(firstOrder).toEqual(['item-1', 'item-2', 'item-3'])
      expect(secondOrder).toEqual(['item-1', 'item-2', 'item-3'])

      cleanupTestContainer(container)
    })

    it('should correctly reorder children when their order changes', async () => {
      const container = createTestContainer()

      // Initial order: 1, 2, 3
      const initialVNode = jsx('div', { id: 'container', children: [
        jsx('div', { key: '1', children: 'One' }),
        jsx('div', { key: '2', children: 'Two' }),
        jsx('div', { key: '3', children: 'Three' }),
      ] })

      await render(initialVNode, container)

      // Reversed order: 3, 2, 1
      const reorderedVNode = jsx('div', { id: 'container', children: [
        jsx('div', { key: '3', children: 'Three' }),
        jsx('div', { key: '2', children: 'Two' }),
        jsx('div', { key: '1', children: 'One' }),
      ] })

      await render(reorderedVNode, container)

      const containerEl = container.querySelector('#container') as HTMLElement
      const textContent = containerEl.textContent

      // Order should be Three, Two, One
      expect(textContent).toBe('ThreeTwoOne')

      cleanupTestContainer(container)
    })
  })

  describe('Duplicate node prevention', () => {
    it('should not duplicate DOM nodes during reconciliation', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'parent', children: [
        jsx('span', { id: 'child', children: 'Only child' }),
      ] })

      await render(vnode, container)

      // Count all elements with id='child' in entire document
      const allChildElements = document.querySelectorAll('#child')
      expect(allChildElements.length).toBe(1)

      // Re-render and verify still only one
      await render(vnode, container)

      const allChildElementsAfter = document.querySelectorAll('#child')
      expect(allChildElementsAfter.length).toBe(1)

      cleanupTestContainer(container)
    })

    it('should not duplicate nodes when updating nested components', async () => {
      const container = createTestContainer()

      function ChildComponent(props: Record<string, unknown>) {
        const id = props.id as string
        return jsx('div', { id: id, className: 'child', children: `Child ${id}` })
      }

      function ParentComponent() {
        return jsx('div', { id: 'parent', children: [
          jsx(ChildComponent, { id: 'child-1' }),
          jsx(ChildComponent, { id: 'child-2' }),
        ] })
      }

      await render(jsx(ParentComponent, {}), container)

      const child1Elements = document.querySelectorAll('#child-1')
      const child2Elements = document.querySelectorAll('#child-2')

      expect(child1Elements.length).toBe(1)
      expect(child2Elements.length).toBe(1)

      // Re-render
      await render(jsx(ParentComponent, {}), container)

      const child1ElementsAfter = document.querySelectorAll('#child-1')
      const child2ElementsAfter = document.querySelectorAll('#child-2')

      expect(child1ElementsAfter.length).toBe(1)
      expect(child2ElementsAfter.length).toBe(1)

      cleanupTestContainer(container)
    })

    it('should correctly replace nodes when type changes', async () => {
      const container = createTestContainer()

      // Render with a div
      const initialVNode = jsx('div', { id: 'element', children: 'Div content' })

      await render(initialVNode, container)

      const div = container.querySelector('#element')
      expect(div?.tagName).toBe('DIV')

      // Re-render with a span (same id, different tag)
      const updatedVNode = jsx('span', { id: 'element', children: 'Span content' })

      await render(updatedVNode, container)

      const span = container.querySelector('#element')
      expect(span?.tagName).toBe('SPAN')
      expect(span?.textContent).toBe('Span content')

      // Should only have one element with that id
      const allElements = document.querySelectorAll('#element')
      expect(allElements.length).toBe(1)

      cleanupTestContainer(container)
    })
  })

  describe('Text node tests', () => {
    it('should correctly render text content', async () => {
      const container = createTestContainer()

      const vnode = jsx('p', { id: 'text-para', children: 'Sample text' })

      await render(vnode, container)

      const para = container.querySelector('#text-para') as HTMLElement
      expect(para.textContent).toBe('Sample text')
      expect(para.childNodes.length).toBe(1) // Only text node

      cleanupTestContainer(container)
    })

    it('should handle mixed text and element children correctly', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'mixed', children: [
        'Text before',
        jsx('span', { children: 'element' }),
        'Text after',
      ] })

      await render(vnode, container)

      const div = container.querySelector('#mixed') as HTMLElement
      expect(div.childNodes.length).toBe(3)
      expect(div.childNodes[0].textContent).toBe('Text before')
      expect(div.childNodes[1].nodeName).toBe('SPAN')
      expect(div.childNodes[2].textContent).toBe('Text after')

      cleanupTestContainer(container)
    })

    it('should render text content on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'text-test', children: 'Just text' })

      await render(vnode, container)

      const div = container.querySelector('#text-test') as HTMLElement
      expect(div.textContent).toBe('Just text')

      cleanupTestContainer(container)
    })

    it('should render element with text on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'element-test', children: [
        jsx('span', { children: 'Wrapped in span' }),
      ] })

      await render(vnode, container)

      const div = container.querySelector('#element-test') as HTMLElement
      expect(div.textContent).toBe('Wrapped in span')
      expect(div.firstElementChild?.tagName).toBe('SPAN')

      cleanupTestContainer(container)
    })

    it('should handle empty text on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('p', { id: 'empty-test', children: '' })

      await render(vnode, container)

      const para = container.querySelector('#empty-test') as HTMLElement
      expect(para.textContent).toBe('')

      cleanupTestContainer(container)
    })

    it('should handle whitespace-only text nodes on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'whitespace', children: [
        '   ',
        jsx('span', { children: 'content' }),
        '   ',
      ] })

      await render(vnode, container)

      const div = container.querySelector('#whitespace') as HTMLElement
      expect(div.childNodes.length).toBe(3)
      // Text nodes with whitespace should be preserved
      expect(div.childNodes[0].textContent).toBe('   ')
      expect(div.childNodes[2].textContent).toBe('   ')

      cleanupTestContainer(container)
    })
  })

  describe('Attribute tests', () => {
    it('should correctly set className attribute on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'class-test', className: 'my-class another-class', children: 'Content' })

      await render(vnode, container)

      const div = container.querySelector('#class-test') as HTMLElement
      expect(div.className).toBe('my-class another-class')

      cleanupTestContainer(container)
    })

    it('should correctly set id attribute on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { id: 'test-id', className: 'test', children: 'Content' })

      await render(vnode, container)

      const div = container.querySelector('#test-id') as HTMLElement
      expect(div.id).toBe('test-id')

      cleanupTestContainer(container)
    })

    it('should correctly set data attributes on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', { 'id': 'data-test', 'data-value': 'test-value', 'children': 'Content' })

      await render(vnode, container)

      const div = container.querySelector('#data-test') as HTMLElement
      expect(div.getAttribute('data-value')).toBe('test-value')

      cleanupTestContainer(container)
    })

    it('should correctly set aria attributes on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('button', { 'id': 'aria-test', 'aria-label': 'Button label', 'children': 'Click' })

      await render(vnode, container)

      const button = container.querySelector('#aria-test') as HTMLElement
      expect(button.getAttribute('aria-label')).toBe('Button label')

      cleanupTestContainer(container)
    })

    it('should correctly set style attribute as object on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', {
        id: 'style-test',
        style: { color: 'red', fontSize: '14px', fontWeight: 'bold' },
        children: 'Styled content',
      })

      await render(vnode, container)

      const div = container.querySelector('#style-test') as HTMLElement
      expect(div.style.color).toBe('red')
      expect(div.style.fontSize).toBe('14px')
      expect(div.style.fontWeight).toBe('bold')

      cleanupTestContainer(container)
    })

    it('should correctly set attributes on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('div', {
        'id': 'attr-test',
        'data-custom': 'value',
        'title': 'tooltip',
        'className': 'my-class',
        'children': 'Content',
      })

      await render(vnode, container)

      const div = container.querySelector('#attr-test') as HTMLElement
      expect(div.getAttribute('data-custom')).toBe('value')
      expect(div.getAttribute('title')).toBe('tooltip')
      expect(div.className).toBe('my-class')

      cleanupTestContainer(container)
    })

    it('should correctly set boolean attributes on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('input', { id: 'bool-test', type: 'checkbox', checked: true, disabled: false })

      await render(vnode, container)

      const input = container.querySelector('#bool-test') as HTMLInputElement
      expect(input.checked).toBe(true)
      expect(input.disabled).toBe(false)

      cleanupTestContainer(container)
    })

    it('should correctly set multiple attributes on initial render', async () => {
      const container = createTestContainer()

      const vnode = jsx('button', {
        'id': 'multi-test',
        'className': 'btn primary',
        'disabled': false,
        'data-action': 'click',
        'children': 'Click me',
      })

      await render(vnode, container)

      const button = container.querySelector('#multi-test') as HTMLButtonElement
      expect(button.className).toBe('btn primary')
      expect(button.disabled).toBe(false)
      expect(button.getAttribute('data-action')).toBe('click')

      cleanupTestContainer(container)
    })
  })

  describe('Attribute updates during reconciliation - BUG EXPOSURE TESTS', () => {
    it('should correctly update className attribute during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with one className
      const initialVNode = jsx('div', { id: 'class-update-test', className: 'initial-class', children: 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#class-update-test') as HTMLElement
      expect(div.className).toBe('initial-class')

      // Re-render with different className
      const updatedVNode = jsx('div', { id: 'class-update-test', className: 'updated-class', children: 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#class-update-test') as HTMLElement
      // BUG: className doesn't update during reconciliation
      expect(updatedDiv.className).toBe('updated-class')

      cleanupTestContainer(container)
    })

    it('should remove className when set to null during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with className
      const initialVNode = jsx('div', { id: 'class-remove-test', className: 'my-class', children: 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#class-remove-test') as HTMLElement
      expect(div.className).toBe('my-class')

      // Re-render with className set to null
      const updatedVNode = jsx('div', { id: 'class-remove-test', className: null, children: 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#class-remove-test') as HTMLElement
      // BUG: className isn't removed when set to null
      expect(updatedDiv.className).toBe('')

      cleanupTestContainer(container)
    })

    it('should correctly update id attribute during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with one id
      const initialVNode = jsx('div', { id: 'old-id', className: 'test', children: 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#old-id') as HTMLElement
      expect(div.id).toBe('old-id')

      // Re-render with different id
      const updatedVNode = jsx('div', { id: 'new-id', className: 'test', children: 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#new-id') as HTMLElement
      expect(updatedDiv.id).toBe('new-id')
      // Old id should not exist
      expect(container.querySelector('#old-id')).toBeNull()

      cleanupTestContainer(container)
    })

    it('should correctly update data attributes during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('div', { 'id': 'data-update-test', 'data-value': 'old-value', 'children': 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#data-update-test') as HTMLElement
      expect(div.getAttribute('data-value')).toBe('old-value')

      // Re-render with different data attribute value
      const updatedVNode = jsx('div', { 'id': 'data-update-test', 'data-value': 'new-value', 'children': 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#data-update-test') as HTMLElement
      expect(updatedDiv.getAttribute('data-value')).toBe('new-value')

      cleanupTestContainer(container)
    })

    it('should remove data attribute when set to null during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with data attribute
      const initialVNode = jsx('div', { 'id': 'data-remove-test', 'data-value': 'test-value', 'children': 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#data-remove-test') as HTMLElement
      expect(div.getAttribute('data-value')).toBe('test-value')

      // Re-render with data attribute set to null
      const updatedVNode = jsx('div', { 'id': 'data-remove-test', 'data-value': null, 'children': 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#data-remove-test') as HTMLElement
      // BUG: attributes aren't removed when set to null
      expect(updatedDiv.getAttribute('data-value')).toBeNull()

      cleanupTestContainer(container)
    })

    it('should remove data attribute when set to undefined during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with data attribute
      const initialVNode = jsx('div', { 'id': 'data-undefined-test', 'data-value': 'test-value', 'children': 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#data-undefined-test') as HTMLElement
      expect(div.getAttribute('data-value')).toBe('test-value')

      // Re-render with data attribute set to undefined
      const updatedVNode = jsx('div', { 'id': 'data-undefined-test', 'data-value': undefined, 'children': 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#data-undefined-test') as HTMLElement
      // BUG: attributes aren't removed when set to undefined
      expect(updatedDiv.getAttribute('data-value')).toBeNull()

      cleanupTestContainer(container)
    })

    it('should correctly update aria attributes during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('button', { 'id': 'aria-update-test', 'aria-label': 'Old label', 'children': 'Click' })
      await render(initialVNode, container)

      const button = container.querySelector('#aria-update-test') as HTMLElement
      expect(button.getAttribute('aria-label')).toBe('Old label')

      // Re-render with different aria-label
      const updatedVNode = jsx('button', { 'id': 'aria-update-test', 'aria-label': 'New label', 'children': 'Click' })
      await render(updatedVNode, container)

      const updatedButton = container.querySelector('#aria-update-test') as HTMLElement
      expect(updatedButton.getAttribute('aria-label')).toBe('New label')

      cleanupTestContainer(container)
    })

    it('should correctly update style object during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with one style
      const initialVNode = jsx('div', {
        id: 'style-update-test',
        style: { color: 'red', fontSize: '14px' },
        children: 'Styled content',
      })
      await render(initialVNode, container)

      const div = container.querySelector('#style-update-test') as HTMLElement
      expect(div.style.color).toBe('red')
      expect(div.style.fontSize).toBe('14px')

      // Re-render with different styles
      const updatedVNode = jsx('div', {
        id: 'style-update-test',
        style: { color: 'blue', fontWeight: 'bold' },
        children: 'Styled content',
      })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#style-update-test') as HTMLElement
      expect(updatedDiv.style.color).toBe('blue')
      expect(updatedDiv.style.fontWeight).toBe('bold')
      // Old style should be removed
      expect(updatedDiv.style.fontSize).toBe('')

      cleanupTestContainer(container)
    })

    it('should clear all styles when style set to null during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with styles
      const initialVNode = jsx('div', {
        id: 'style-clear-test',
        style: { color: 'red', fontSize: '14px' },
        children: 'Styled content',
      })
      await render(initialVNode, container)

      const div = container.querySelector('#style-clear-test') as HTMLElement
      expect(div.style.color).toBe('red')

      // Re-render with style set to null
      const updatedVNode = jsx('div', {
        id: 'style-clear-test',
        style: null,
        children: 'Styled content',
      })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#style-clear-test') as HTMLElement
      expect(updatedDiv.style.cssText).toBe('')

      cleanupTestContainer(container)
    })

    it('should correctly update title attribute during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('div', { id: 'title-update-test', title: 'Old tooltip', children: 'Content' })
      await render(initialVNode, container)

      const div = container.querySelector('#title-update-test') as HTMLElement
      expect(div.getAttribute('title')).toBe('Old tooltip')

      // Re-render with different title
      const updatedVNode = jsx('div', { id: 'title-update-test', title: 'New tooltip', children: 'Content' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#title-update-test') as HTMLElement
      expect(updatedDiv.getAttribute('title')).toBe('New tooltip')

      cleanupTestContainer(container)
    })
  })

  describe('Boolean attribute updates during reconciliation - BUG EXPOSURE TESTS', () => {
    it('should correctly update checked attribute during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with checked=true
      const initialVNode = jsx('input', { id: 'checked-update-test', type: 'checkbox', checked: true })
      await render(initialVNode, container)

      const input = container.querySelector('#checked-update-test') as HTMLInputElement
      expect(input.checked).toBe(true)

      // Re-render with checked=false
      const updatedVNode = jsx('input', { id: 'checked-update-test', type: 'checkbox', checked: false })
      await render(updatedVNode, container)

      const updatedInput = container.querySelector('#checked-update-test') as HTMLInputElement
      // BUG: checked attribute doesn't update during reconciliation
      expect(updatedInput.checked).toBe(false)

      cleanupTestContainer(container)
    })

    it('should correctly update disabled attribute during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with disabled=false
      const initialVNode = jsx('button', { id: 'disabled-update-test', disabled: false, children: 'Click' })
      await render(initialVNode, container)

      const button = container.querySelector('#disabled-update-test') as HTMLButtonElement
      expect(button.disabled).toBe(false)

      // Re-render with disabled=true
      const updatedVNode = jsx('button', { id: 'disabled-update-test', disabled: true, children: 'Click' })
      await render(updatedVNode, container)

      const updatedButton = container.querySelector('#disabled-update-test') as HTMLButtonElement
      // BUG: disabled attribute doesn't update during reconciliation
      expect(updatedButton.disabled).toBe(true)

      cleanupTestContainer(container)
    })

    it('should correctly update readonly attribute during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render with readonly=false
      const initialVNode = jsx('input', { id: 'readonly-update-test', type: 'text', readOnly: false })
      await render(initialVNode, container)

      const input = container.querySelector('#readonly-update-test') as HTMLInputElement
      expect(input.readOnly).toBe(false)

      // Re-render with readonly=true
      const updatedVNode = jsx('input', { id: 'readonly-update-test', type: 'text', readOnly: true })
      await render(updatedVNode, container)

      const updatedInput = container.querySelector('#readonly-update-test') as HTMLInputElement
      expect(updatedInput.readOnly).toBe(true)

      cleanupTestContainer(container)
    })

    it('should correctly update multiple boolean attributes during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('input', {
        id: 'multi-bool-test',
        type: 'checkbox',
        checked: true,
        disabled: true,
        required: false,
      })
      await render(initialVNode, container)

      const input = container.querySelector('#multi-bool-test') as HTMLInputElement
      expect(input.checked).toBe(true)
      expect(input.disabled).toBe(true)
      expect(input.required).toBe(false)

      // Re-render with all booleans flipped
      const updatedVNode = jsx('input', {
        id: 'multi-bool-test',
        type: 'checkbox',
        checked: false,
        disabled: false,
        required: true,
      })
      await render(updatedVNode, container)

      const updatedInput = container.querySelector('#multi-bool-test') as HTMLInputElement
      expect(updatedInput.checked).toBe(false)
      expect(updatedInput.disabled).toBe(false)
      expect(updatedInput.required).toBe(true)

      cleanupTestContainer(container)
    })
  })

  describe('Text node updates during reconciliation - BUG EXPOSURE TESTS', () => {
    it('should correctly update text content during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('p', { id: 'text-update-test', children: 'Initial text' })
      await render(initialVNode, container)

      const para = container.querySelector('#text-update-test') as HTMLElement
      expect(para.textContent).toBe('Initial text')

      // Re-render with different text
      const updatedVNode = jsx('p', { id: 'text-update-test', children: 'Updated text' })
      await render(updatedVNode, container)

      const updatedPara = container.querySelector('#text-update-test') as HTMLElement
      // BUG: text content doesn't update during reconciliation
      expect(updatedPara.textContent).toBe('Updated text')

      cleanupTestContainer(container)
    })

    it('should correctly update text when switching from text to element', async () => {
      const container = createTestContainer()

      // Initial render with text
      const initialVNode = jsx('div', { id: 'switch-test', children: 'Just text' })
      await render(initialVNode, container)

      const div = container.querySelector('#switch-test') as HTMLElement
      expect(div.textContent).toBe('Just text')

      // Re-render with element
      const updatedVNode = jsx('div', { id: 'switch-test', children: [
        jsx('span', { children: 'Wrapped in span' }),
      ] })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#switch-test') as HTMLElement
      expect(updatedDiv.textContent).toBe('Wrapped in span')
      expect(updatedDiv.firstElementChild?.tagName).toBe('SPAN')

      cleanupTestContainer(container)
    })

    it('should correctly update text when switching from element to text', async () => {
      const container = createTestContainer()

      // Initial render with element
      const initialVNode = jsx('div', { id: 'switch-back-test', children: [
        jsx('span', { children: 'Wrapped in span' }),
      ] })
      await render(initialVNode, container)

      const div = container.querySelector('#switch-back-test') as HTMLElement
      expect(div.firstElementChild?.tagName).toBe('SPAN')

      // Re-render with just text
      const updatedVNode = jsx('div', { id: 'switch-back-test', children: 'Just text now' })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#switch-back-test') as HTMLElement
      expect(updatedDiv.textContent).toBe('Just text now')
      expect(updatedDiv.firstElementChild).toBeNull()

      cleanupTestContainer(container)
    })

    it('should correctly update empty text to non-empty text', async () => {
      const container = createTestContainer()

      // Initial render with empty text
      const initialVNode = jsx('p', { id: 'empty-to-filled-test', children: '' })
      await render(initialVNode, container)

      const para = container.querySelector('#empty-to-filled-test') as HTMLElement
      expect(para.textContent).toBe('')

      // Re-render with non-empty text
      const updatedVNode = jsx('p', { id: 'empty-to-filled-test', children: 'Now has content' })
      await render(updatedVNode, container)

      const updatedPara = container.querySelector('#empty-to-filled-test') as HTMLElement
      expect(updatedPara.textContent).toBe('Now has content')

      cleanupTestContainer(container)
    })

    it('should correctly update mixed children during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('div', { id: 'mixed-update-test', children: [
        'Text before',
        jsx('span', { id: 'first-span', children: 'first' }),
        'Text middle',
        jsx('span', { id: 'second-span', children: 'second' }),
        'Text after',
      ] })
      await render(initialVNode, container)

      const div = container.querySelector('#mixed-update-test') as HTMLElement
      expect(div.childNodes.length).toBe(5)

      // Re-render with updated mixed children
      const updatedVNode = jsx('div', { id: 'mixed-update-test', children: [
        'Updated before',
        jsx('span', { id: 'first-span', children: 'updated first' }),
        'Updated middle',
        jsx('span', { id: 'second-span', children: 'updated second' }),
        'Updated after',
      ] })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#mixed-update-test') as HTMLElement
      expect(updatedDiv.childNodes.length).toBe(5)
      expect(updatedDiv.childNodes[0].textContent).toBe('Updated before')
      expect(updatedDiv.childNodes[2].textContent).toBe('Updated middle')
      expect(updatedDiv.childNodes[4].textContent).toBe('Updated after')

      cleanupTestContainer(container)
    })
  })

  describe('foreignObject namespace during reconciliation - BUG EXPOSURE TESTS', () => {
    it('should correctly update foreignObject content during reconciliation', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('svg', { width: '300', height: '200', children: [
        jsx('foreignObject', { id: 'foreign-test', x: '20', y: '20', width: '260', height: '160', children: [
          jsx('div', { id: 'foreign-div', children: 'Initial content' }),
        ] }),
      ] })
      await render(initialVNode, container)

      const div = container.querySelector('#foreign-div') as HTMLElement
      expect(div.textContent).toBe('Initial content')
      // Verify the div is in HTML namespace, not SVG namespace
      expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml')

      // Re-render with different content
      const updatedVNode = jsx('svg', { width: '300', height: '200', children: [
        jsx('foreignObject', { id: 'foreign-test', x: '20', y: '20', width: '260', height: '160', children: [
          jsx('div', { id: 'foreign-div', children: 'Updated content' }),
        ] }),
      ] })
      await render(updatedVNode, container)

      const updatedDiv = container.querySelector('#foreign-div') as HTMLElement
      expect(updatedDiv.textContent).toBe('Updated content')
      // BUG: Nested HTML elements in foreignObject may not maintain correct namespace
      expect(updatedDiv.namespaceURI).toBe('http://www.w3.org/1999/xhtml')

      cleanupTestContainer(container)
    })

    it('should correctly namespace nested elements in updated foreignObject', async () => {
      const container = createTestContainer()

      // Initial render
      const initialVNode = jsx('svg', { width: '300', height: '200', children: [
        jsx('foreignObject', { id: 'foreign-ns-test', children: [
          jsx('div', { children: [
            jsx('h3', { children: 'Title' }),
            jsx('p', { children: 'Paragraph' }),
          ] }),
        ] }),
      ] })
      await render(initialVNode, container)

      const h3 = container.querySelector('h3') as HTMLElement
      const p = container.querySelector('p') as HTMLElement

      expect(h3.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
      expect(p.namespaceURI).toBe('http://www.w3.org/1999/xhtml')

      // Re-render with additional nested element
      const updatedVNode = jsx('svg', { width: '300', height: '200', children: [
        jsx('foreignObject', { id: 'foreign-ns-test', children: [
          jsx('div', { children: [
            jsx('h3', { children: 'Updated Title' }),
            jsx('p', { children: 'Updated Paragraph' }),
            jsx('span', { children: 'New span' }),
          ] }),
        ] }),
      ] })
      await render(updatedVNode, container)

      const updatedH3 = container.querySelector('h3') as HTMLElement
      const updatedP = container.querySelector('p') as HTMLElement
      const span = container.querySelector('span') as HTMLElement

      expect(updatedH3.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
      expect(updatedP.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
      expect(span.namespaceURI).toBe('http://www.w3.org/1999/xhtml')

      cleanupTestContainer(container)
    })
  })

  describe('mountedNodes integrity after edge cases', () => {
    it('should maintain correct mountedNodes after select value update', async () => {
      const container = createTestContainer()

      const vnode = jsx('select', { id: 'mounted-test', value: 'b', children: [
        jsx('option', { value: 'a', children: 'A' }),
        jsx('option', { value: 'b', children: 'B' }),
      ] })

      await render(vnode, container)

      const select = container.querySelector('#mounted-test') as HTMLSelectElement
      const mounted = mountedNodes.get(select)

      expect(mounted).toBeDefined()
      expect(mounted?.node).toBe(select)
      expect(mounted?.vdom.type).toBe('element')

      cleanupTestContainer(container)
    })

    it('should maintain correct mountedNodes after nested SVG render', async () => {
      const container = createTestContainer()

      const vnode = jsx('svg', { width: '100', height: '100', children: [
        jsx('circle', { id: 'svg-circle', cx: '50', cy: '50', r: '40', fill: 'red' }),
      ] })

      await render(vnode, container)

      const circle = container.querySelector('#svg-circle') as SVGCircleElement
      const mounted = mountedNodes.get(circle)

      expect(mounted).toBeDefined()
      expect(mounted?.node).toBe(circle)

      cleanupTestContainer(container)
    })
  })
})

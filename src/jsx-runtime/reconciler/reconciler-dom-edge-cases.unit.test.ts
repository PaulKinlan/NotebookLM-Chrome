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

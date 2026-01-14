/**
 * Unit Test for JSX Runtime DOM Corruption Bug
 *
 * This test reproduces the issue where children from one component
 * appear inside another component's elements.
 */

import { describe, it, expect } from 'vitest'
import { jsx, render } from '../../jsx-runtime'

// Create a simple test container
function createTestContainer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

function cleanupTestContainer(container: HTMLElement) {
  document.body.removeChild(container)
}

describe('JSX Runtime - DOM Corruption Bug', () => {
  it('should keep children in correct components', async () => {
    const container = createTestContainer()

    // Simulate the App component structure:
    // <main>
    //   <section id="tab-add"><h3>Add Tab Header</h3><div>Add Content</div></section>
    //   <section id="tab-settings"><h3>Settings Header</h3><div>Settings Content</div></section>
    // </main>

    // Note: In the JSX transform, children are passed in the props object
    const appVNode = jsx('main', { className: 'content', children: [
      jsx('section', { id: 'tab-add', className: 'tab-content active', children: [
        jsx('h3', { className: 'section-title', children: 'Import Options' }),
        jsx('div', { className: 'import-options', children: 'Import Options Content' }),
      ] }),
      jsx('section', { id: 'tab-settings', className: 'tab-content', children: [
        jsx('h3', { className: 'section-title', children: 'Settings Header' }),
        jsx('div', { className: 'settings-content', children: [
          jsx('label', { className: 'checkbox-label', children: [
            jsx('input', { type: 'checkbox', id: 'perm-tabs' }),
            jsx('span', { children: 'Tabs - View all open tabs' }),
          ] }),
        ] }),
      ] }),
    ] })

    await render(appVNode, container)

    // Debug: Check the DOM structure
    const main = container.querySelector('main')
    const addTab = container.querySelector('#tab-add')
    const settingsTab = container.querySelector('#tab-settings')
    const addH3 = addTab?.querySelector('h3.section-title')

    console.log('[TEST] main children:', main?.children.length)
    console.log('[TEST] addTab.innerHTML:', addTab?.innerHTML.slice(0, 500))
    console.log('[TEST] settingsTab.innerHTML:', settingsTab?.innerHTML.slice(0, 500))
    console.log('[TEST] addH3 childNodes:', Array.from(addH3?.childNodes || []).map(n => ({
      nodeType: n.nodeType,
      nodeName: n.nodeName,
      textContent: n.textContent?.slice(0, 50),
    })))

    // Verify structure
    expect(main?.children.length).toBe(2) // Should have 2 sections

    // The Add tab's h3 should only contain the text "Import Options"
    expect(addH3?.childNodes.length).toBe(1) // Only text node
    expect(addH3?.textContent).toBe('Import Options')

    // The Add tab should NOT contain the checkbox from Settings
    const addTabCheckbox = addTab?.querySelector('input[type="checkbox"]')
    expect(addTabCheckbox).toBeNull()

    cleanupTestContainer(container)
  })

  it('should correctly mount nested components', async () => {
    const container = createTestContainer()

    // Test with function components (simulating tab components)
    function AddTab() {
      return jsx('section', { id: 'tab-add', children: [
        jsx('h3', { className: 'section-title', children: 'Add Tab' }),
        jsx('div', { className: 'content', children: 'Add Content' }),
      ] })
    }

    function SettingsTab() {
      return jsx('section', { id: 'tab-settings', children: [
        jsx('h3', { className: 'section-title', children: 'Settings Tab' }),
        jsx('label', { className: 'checkbox-label', children: [
          jsx('input', { type: 'checkbox', id: 'test-check' }),
          'Checkbox Label',
        ] }),
      ] })
    }

    const appVNode = jsx('main', { children: [
      jsx(AddTab, {}),
      jsx(SettingsTab, {}),
    ] })

    await render(appVNode, container)

    const addTab = container.querySelector('#tab-add')
    const addH3 = addTab?.querySelector('h3')

    // The Add tab's h3 should only contain "Add Tab" text
    expect(addH3?.childNodes.length).toBe(1)
    expect(addH3?.textContent).toBe('Add Tab')

    // Settings checkbox should not be in Add tab
    const addTabCheckbox = addTab?.querySelector('input[type="checkbox"]')
    expect(addTabCheckbox).toBeNull()

    cleanupTestContainer(container)
  })

  it('should correctly handle re-render with same structure', async () => {
    const container = createTestContainer()

    // Simulate tab switching by re-rendering the same structure
    function App() {
      return jsx('main', { className: 'content', children: [
        jsx('section', { id: 'tab-add', className: 'tab-content active', children: [
          jsx('h3', { className: 'section-title', children: 'Import Options' }),
          jsx('div', { className: 'import-options', children: 'Import Options Content' }),
        ] }),
        jsx('section', { id: 'tab-settings', className: 'tab-content', children: [
          jsx('h3', { className: 'section-title', children: 'Settings Header' }),
          jsx('div', { className: 'settings-content', children: [
            jsx('label', { className: 'checkbox-label', children: [
              jsx('input', { type: 'checkbox', id: 'perm-tabs' }),
              jsx('span', { children: 'Tabs - View all open tabs' }),
            ] }),
          ] }),
        ] }),
      ] })
    }

    // Initial render
    await render(jsx(App, {}), container)

    let addTab = container.querySelector('#tab-add')
    let addH3 = addTab?.querySelector('h3.section-title')

    console.log('[TEST - RECONCILE] After initial render:')
    console.log('[TEST - RECONCILE] addH3 childNodes:', Array.from(addH3?.childNodes || []).map(n => n.textContent))

    // Re-render (simulating tab switch - component updates with same structure)
    await render(jsx(App, {}), container)

    addTab = container.querySelector('#tab-add')
    addH3 = addTab?.querySelector('h3.section-title')

    console.log('[TEST - RECONCILE] After re-render:')
    console.log('[TEST - RECONCILE] addH3 childNodes:', Array.from(addH3?.childNodes || []).map(n => n.textContent))

    // The Add tab's h3 should still only contain "Import Options" text
    expect(addH3?.childNodes.length).toBe(1)
    expect(addH3?.textContent).toBe('Import Options')

    // The Add tab should NOT contain the checkbox from Settings
    const addTabCheckbox = addTab?.querySelector('input[type="checkbox"]')
    expect(addTabCheckbox).toBeNull()

    cleanupTestContainer(container)
  })
})

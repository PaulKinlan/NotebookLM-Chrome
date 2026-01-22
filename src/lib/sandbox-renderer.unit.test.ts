/**
 * Unit tests for SandboxRenderer setTheme method
 *
 * Tests the theme management functionality including:
 * - setTheme: Sends theme to sandbox via postMessage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock chrome.runtime.getURL
vi.stubGlobal('chrome', {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
})

describe('SandboxRenderer', () => {
  let mockPostMessage: ReturnType<typeof vi.fn>
  let mockIframe: HTMLIFrameElement
  let mockContainer: HTMLElement
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock postMessage
    mockPostMessage = vi.fn()

    // Save original createElement
    originalCreateElement = document.createElement.bind(document)

    // Create mock iframe with contentWindow using original createElement
    mockIframe = originalCreateElement('iframe')
    Object.defineProperty(mockIframe, 'contentWindow', {
      value: {
        postMessage: mockPostMessage,
      },
      writable: true,
      configurable: true,
    })

    // Mock sandbox property with add method
    Object.defineProperty(mockIframe, 'sandbox', {
      value: {
        add: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    // Create mock container
    mockContainer = originalCreateElement('div')

    // Mock document.createElement to return our mock iframe
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'iframe') {
        return mockIframe
      }
      return originalCreateElement(tagName)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setTheme', () => {
    it('sends SET_THEME message with light theme', async () => {
      const { SandboxRenderer } = await import('./sandbox-renderer')
      const renderer = new SandboxRenderer(mockContainer)

      renderer.setTheme('light')

      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'SET_THEME', theme: 'light' },
        '*',
      )
    })

    it('sends SET_THEME message with dark theme', async () => {
      const { SandboxRenderer } = await import('./sandbox-renderer')
      const renderer = new SandboxRenderer(mockContainer)

      renderer.setTheme('dark')

      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'SET_THEME', theme: 'dark' },
        '*',
      )
    })

    it('sends SET_THEME message with null for system preference', async () => {
      const { SandboxRenderer } = await import('./sandbox-renderer')
      const renderer = new SandboxRenderer(mockContainer)

      renderer.setTheme(null)

      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'SET_THEME', theme: null },
        '*',
      )
    })

    it('does not throw when iframe contentWindow is null', async () => {
      const { SandboxRenderer } = await import('./sandbox-renderer')
      const renderer = new SandboxRenderer(mockContainer)

      // Simulate iframe being destroyed
      Object.defineProperty(mockIframe, 'contentWindow', {
        value: null,
        writable: true,
      })

      // Should not throw
      expect(() => renderer.setTheme('light')).not.toThrow()
    })

    it('can be called multiple times with different themes', async () => {
      const { SandboxRenderer } = await import('./sandbox-renderer')
      const renderer = new SandboxRenderer(mockContainer)

      renderer.setTheme('light')
      renderer.setTheme('dark')
      renderer.setTheme(null)

      expect(mockPostMessage).toHaveBeenCalledTimes(3)
      expect(mockPostMessage).toHaveBeenNthCalledWith(1, { type: 'SET_THEME', theme: 'light' }, '*')
      expect(mockPostMessage).toHaveBeenNthCalledWith(2, { type: 'SET_THEME', theme: 'dark' }, '*')
      expect(mockPostMessage).toHaveBeenNthCalledWith(3, { type: 'SET_THEME', theme: null }, '*')
    })
  })
})

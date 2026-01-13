/**
 * Unit tests for theme module
 *
 * Tests the theme management functions including:
 * - getUISettings: Retrieves UI settings with defaults
 * - saveUISettings: Persists UI settings to storage
 * - getThemePreference/setThemePreference: Theme preference management
 * - resolveTheme: Resolves 'system' preference to actual theme
 * - applyTheme: Applies theme to DOM via data-theme attribute
 * - initializeTheme: Initializes theme on app startup
 * - onSystemThemeChange: Subscribes to system theme changes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock matchMedia state
let mockIsDark = true
const matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = []

// Mock document element
const mockDocumentElement = {
  setAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  getAttribute: vi.fn(() => null),
}

// Mock addEventListener/removeEventListener for matchMedia
const mockMediaQueryAddEventListener = vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
  matchMediaListeners.push(handler)
})
const mockMediaQueryRemoveEventListener = vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
  const index = matchMediaListeners.indexOf(handler)
  if (index > -1) {
    matchMediaListeners.splice(index, 1)
  }
})

// Mock matchMedia - returns a consistent object that the assertions can check
const mockMatchMedia = vi.fn(() => ({
  matches: mockIsDark,
  addEventListener: mockMediaQueryAddEventListener,
  removeEventListener: mockMediaQueryRemoveEventListener,
}))

// Mock storage - use a module-level variable that the mock functions can access
let mockStorageData: Record<string, unknown> = {}

// Helper to reset storage (for test cleanup)
function resetMockStorage() {
  // Clear all properties from the existing object instead of creating a new one
  for (const key in mockStorageData) {
    delete mockStorageData[key]
  }
}

// Mock modules BEFORE importing theme (using factory function to avoid hoisting issues)
vi.mock('./storage.ts', () => {
  return {
    storage: {
      getSetting: <T>(key: string): Promise<T | null> => {
        const value = mockStorageData[key]
        return Promise.resolve((value !== undefined ? value : null) as T | null)
      },
      setSetting: <T>(key: string, value: T): Promise<void> => {
        mockStorageData[key] = value
        return Promise.resolve(undefined)
      },
    },
  }
})

// Mock document and window globals
vi.stubGlobal('document', { documentElement: mockDocumentElement })
vi.stubGlobal('window', { matchMedia: mockMatchMedia })

// Now import modules after mocks are set up
import * as theme from './theme.ts'

describe('theme', () => {
  beforeEach(() => {
    // Clear mock storage for each test
    resetMockStorage()

    // Clear individual mock call counts
    mockDocumentElement.setAttribute.mockClear()
    mockDocumentElement.removeAttribute.mockClear()
    mockDocumentElement.getAttribute.mockClear()
    mockMatchMedia.mockClear()
    mockMediaQueryAddEventListener.mockClear()
    mockMediaQueryRemoveEventListener.mockClear()

    // Reset matchMedia to dark (default)
    mockIsDark = true
    matchMediaListeners.length = 0
  })

  afterEach(() => {
    matchMediaListeners.length = 0
  })

  describe('getUISettings', () => {
    it('returns default settings when no settings exist', async () => {
      const result = await theme.getUISettings()

      expect(result).toEqual({
        themePreference: 'system',
      })
    })

    it('returns saved settings when they exist', async () => {
      const customSettings = {
        themePreference: 'dark' as const,
      }

      await theme.saveUISettings(customSettings)
      const result = await theme.getUISettings()

      expect(result).toEqual(customSettings)
    })
  })

  describe('saveUISettings', () => {
    it('persists settings to storage', async () => {
      const uiSettings = {
        themePreference: 'light' as const,
      }

      await theme.saveUISettings(uiSettings)
      const retrieved = await theme.getUISettings()

      expect(retrieved).toEqual(uiSettings)
    })

    it('overwrites existing settings', async () => {
      const initialSettings = {
        themePreference: 'light' as const,
      }

      const updatedSettings = {
        themePreference: 'dark' as const,
      }

      await theme.saveUISettings(initialSettings)
      await theme.saveUISettings(updatedSettings)
      const retrieved = await theme.getUISettings()

      expect(retrieved).toEqual(updatedSettings)
    })
  })

  describe('getThemePreference', () => {
    it('returns system as default preference', async () => {
      const result = await theme.getThemePreference()

      expect(result).toBe('system')
    })

    it('returns saved theme preference', async () => {
      await theme.saveUISettings({ themePreference: 'dark' })

      const result = await theme.getThemePreference()

      expect(result).toBe('dark')
    })
  })

  describe('setThemePreference', () => {
    it('sets theme preference to light', async () => {
      await theme.setThemePreference('light')

      const result = await theme.getThemePreference()
      expect(result).toBe('light')
    })

    it('sets theme preference to dark', async () => {
      await theme.setThemePreference('dark')

      const result = await theme.getThemePreference()
      expect(result).toBe('dark')
    })

    it('sets theme preference to system', async () => {
      await theme.setThemePreference('light')
      await theme.setThemePreference('system')

      const result = await theme.getThemePreference()
      expect(result).toBe('system')
    })

    it('persists preference changes', async () => {
      await theme.setThemePreference('dark')

      // Verify it persisted by checking storage directly
      const settings = await theme.getUISettings()
      expect(settings.themePreference).toBe('dark')
    })
  })

  describe('resolveTheme', () => {
    it('returns light when preference is light', () => {
      const result = theme.resolveTheme('light')

      expect(result).toBe('light')
    })

    it('returns dark when preference is dark', () => {
      const result = theme.resolveTheme('dark')

      expect(result).toBe('dark')
    })

    it('returns dark when system preference is dark', () => {
      // mockIsDark is true (dark)
      const result = theme.resolveTheme('system')

      expect(result).toBe('dark')
    })

    it('returns light when system preference is light', () => {
      mockIsDark = false
      const result = theme.resolveTheme('system')

      expect(result).toBe('light')

      // Reset back to dark for other tests
      mockIsDark = true
    })
  })

  describe('applyTheme', () => {
    it('sets data-theme attribute to light', () => {
      theme.applyTheme('light')

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('sets data-theme attribute to dark', () => {
      theme.applyTheme('dark')

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('removes data-theme attribute when null', () => {
      theme.applyTheme(null)

      expect(mockDocumentElement.removeAttribute).toHaveBeenCalledWith('data-theme')
    })
  })

  describe('initializeTheme', () => {
    beforeEach(() => {
      // Ensure clean state for these tests - reset any set preference to system (default)
      delete mockStorageData.uiSettings
    })

    it('applies null theme for system preference (lets CSS handle it)', async () => {
      // Default preference is 'system'
      const result = await theme.initializeTheme()

      expect(mockDocumentElement.removeAttribute).toHaveBeenCalledWith('data-theme')
      expect(result).toBe('dark') // Because mockIsDark is true
    })

    it('applies light theme for light preference', async () => {
      // Set light preference via the theme API (not direct storage manipulation)
      await theme.setThemePreference('light')

      // Clear the mock calls to only track what initializeTheme does
      mockDocumentElement.setAttribute.mockClear()
      mockDocumentElement.removeAttribute.mockClear()

      const result = await theme.initializeTheme()

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light')
      expect(result).toBe('light')
    })

    it('applies dark theme for dark preference', async () => {
      // Set dark preference via the theme API (not direct storage manipulation)
      await theme.setThemePreference('dark')

      // Clear the mock calls to only track what initializeTheme does
      mockDocumentElement.setAttribute.mockClear()
      mockDocumentElement.removeAttribute.mockClear()

      const result = await theme.initializeTheme()

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
      expect(result).toBe('dark')
    })

    it('returns resolved theme based on system preference', async () => {
      // System preference is dark (mockIsDark = true)
      const result = await theme.initializeTheme()

      expect(result).toBe('dark')
    })
  })

  describe('onSystemThemeChange', () => {
    it('adds event listener to matchMedia', () => {
      theme.onSystemThemeChange(() => {})

      expect(mockMediaQueryAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('returns cleanup function that removes listener', () => {
      const callback = vi.fn()
      const cleanup = theme.onSystemThemeChange(callback)

      cleanup()

      expect(mockMediaQueryRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('calls callback with true when system changes to dark', () => {
      const callback = vi.fn()
      theme.onSystemThemeChange(callback)

      // Trigger a change event
      matchMediaListeners.forEach(listener => listener({ matches: true } as MediaQueryListEvent))

      expect(callback).toHaveBeenCalledWith(true)
    })

    it('calls callback with false when system changes to light', () => {
      const callback = vi.fn()
      theme.onSystemThemeChange(callback)

      // Trigger a change event
      matchMediaListeners.forEach(listener => listener({ matches: false } as MediaQueryListEvent))

      expect(callback).toHaveBeenCalledWith(false)
    })

    it('does not call callback after cleanup', () => {
      const callback = vi.fn()
      const cleanup = theme.onSystemThemeChange(callback)

      cleanup()

      // Manually call the trigger to verify callback isn't called
      matchMediaListeners.forEach(listener => listener({ matches: true } as MediaQueryListEvent))

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      // Ensure clean state for integration tests
      delete mockStorageData.uiSettings
    })

    it('handles complete theme workflow', async () => {
      // Start with default (system preference)
      let preference = await theme.getThemePreference()
      expect(preference).toBe('system')

      // Initialize theme
      let resolved = await theme.initializeTheme()
      expect(resolved).toBe('dark') // Because mock system is dark

      // Switch to light
      await theme.setThemePreference('light')
      preference = await theme.getThemePreference()
      expect(preference).toBe('light')

      // Resolve should return light regardless of system
      expect(theme.resolveTheme('light')).toBe('light')

      // Switch to dark
      await theme.setThemePreference('dark')
      expect(theme.resolveTheme('dark')).toBe('dark')

      // Switch back to system
      await theme.setThemePreference('system')
      expect(theme.resolveTheme('system')).toBe('dark') // System is dark
    })

    it('maintains preference consistency across operations', async () => {
      // Set up light preference
      await theme.setThemePreference('light')

      // Verify it persists through getUISettings
      const settings = await theme.getUISettings()
      expect(settings.themePreference).toBe('light')

      // Verify through getThemePreference
      expect(await theme.getThemePreference()).toBe('light')

      // Update via saveUISettings
      await theme.saveUISettings({ themePreference: 'dark' })

      // Both should reflect the change
      expect(await theme.getThemePreference()).toBe('dark')
      const newSettings = await theme.getUISettings()
      expect(newSettings.themePreference).toBe('dark')
    })
  })
})

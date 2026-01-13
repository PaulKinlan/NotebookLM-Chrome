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

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Global mock storage that will be cleared in beforeEach
declare global {
  var __mockThemeStorage: Record<string, unknown>
}
globalThis.__mockThemeStorage = globalThis.__mockThemeStorage ?? {}

// Helper to clear the mock storage
const clearMockStorage = () => {
  globalThis.__mockThemeStorage = {}
}

// Type guard to check if value is of type T
function isType<T>(value: unknown): value is T {
  return value !== undefined
}

// Mock the storage module before importing theme
vi.mock('./storage.ts', () => ({
  storage: {
    getSetting: vi.fn(<T>(key: string): Promise<T | null> => {
      const value = globalThis.__mockThemeStorage[key]
      return Promise.resolve(isType<T>(value) ? value : null)
    }),
    setSetting: vi.fn(<T>(key: string, value: T): Promise<void> => {
      globalThis.__mockThemeStorage[key] = value
      return Promise.resolve(undefined)
    }),
  },
}))

// Mock matchMedia for system theme detection
const createMockMatchMedia = (matches: boolean) => {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  return {
    matches,
    addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.push(handler)
      }
    }),
    removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        const index = listeners.indexOf(handler)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }),
    // Helper to trigger change events in tests
    _triggerChange: (newMatches: boolean) => {
      listeners.forEach(listener => listener({ matches: newMatches } as MediaQueryListEvent))
    },
    _listeners: listeners,
  }
}

// Type for the theme module
type ThemeModule = typeof import('./theme.ts')

describe('theme', () => {
  let theme: ThemeModule
  let mockMatchMedia: ReturnType<typeof createMockMatchMedia>
  let mockSetAttribute: ReturnType<typeof vi.fn>
  let mockRemoveAttribute: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    // Clear the mock storage data before each test
    clearMockStorage()
    vi.clearAllMocks()

    // Reset modules to ensure fresh imports with mocks applied
    vi.resetModules()

    // Set up mock matchMedia (default to dark system preference)
    mockMatchMedia = createMockMatchMedia(true)
    vi.stubGlobal('matchMedia', vi.fn(() => mockMatchMedia))

    // Set up mock document - store references to mock functions
    mockSetAttribute = vi.fn()
    mockRemoveAttribute = vi.fn()
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute: mockSetAttribute,
        removeAttribute: mockRemoveAttribute,
        getAttribute: vi.fn(() => null),
      },
    })

    // Re-import the theme module
    theme = await import('./theme.ts')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
      // mockMatchMedia already set to matches: true (dark)
      const result = theme.resolveTheme('system')

      expect(result).toBe('dark')
    })

    it('returns light when system preference is light', async () => {
      // Reset modules and set up light system preference
      vi.resetModules()
      mockMatchMedia = createMockMatchMedia(false)
      vi.stubGlobal('matchMedia', vi.fn(() => mockMatchMedia))

      theme = await import('./theme.ts')

      const result = theme.resolveTheme('system')

      expect(result).toBe('light')
    })
  })

  describe('applyTheme', () => {
    it('sets data-theme attribute to light', () => {
      theme.applyTheme('light')

      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('sets data-theme attribute to dark', () => {
      theme.applyTheme('dark')

      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('removes data-theme attribute when null', () => {
      theme.applyTheme(null)

      expect(mockRemoveAttribute).toHaveBeenCalledWith('data-theme')
    })
  })

  describe('initializeTheme', () => {
    it('applies null theme for system preference (lets CSS handle it)', async () => {
      // Default preference is 'system'
      const result = await theme.initializeTheme()

      expect(mockRemoveAttribute).toHaveBeenCalledWith('data-theme')
      expect(result).toBe('dark') // Because mockMatchMedia.matches is true
    })

    it('applies light theme for light preference', async () => {
      await theme.setThemePreference('light')

      // Need to re-import to pick up the saved preference
      vi.resetModules()
      mockMatchMedia = createMockMatchMedia(true)
      vi.stubGlobal('matchMedia', vi.fn(() => mockMatchMedia))
      mockSetAttribute = vi.fn()
      mockRemoveAttribute = vi.fn()
      vi.stubGlobal('document', {
        documentElement: {
          setAttribute: mockSetAttribute,
          removeAttribute: mockRemoveAttribute,
          getAttribute: vi.fn(() => null),
        },
      })
      theme = await import('./theme.ts')

      const result = await theme.initializeTheme()

      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'light')
      expect(result).toBe('light')
    })

    it('applies dark theme for dark preference', async () => {
      await theme.setThemePreference('dark')

      // Need to re-import to pick up the saved preference
      vi.resetModules()
      mockMatchMedia = createMockMatchMedia(false) // System is light
      vi.stubGlobal('matchMedia', vi.fn(() => mockMatchMedia))
      mockSetAttribute = vi.fn()
      mockRemoveAttribute = vi.fn()
      vi.stubGlobal('document', {
        documentElement: {
          setAttribute: mockSetAttribute,
          removeAttribute: mockRemoveAttribute,
          getAttribute: vi.fn(() => null),
        },
      })
      theme = await import('./theme.ts')

      const result = await theme.initializeTheme()

      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark')
      expect(result).toBe('dark')
    })

    it('returns resolved theme based on system preference', async () => {
      // System preference is dark (mockMatchMedia.matches = true)
      const result = await theme.initializeTheme()

      expect(result).toBe('dark')
    })
  })

  describe('onSystemThemeChange', () => {
    it('adds event listener to matchMedia', () => {
      theme.onSystemThemeChange(() => {})

      expect(mockMatchMedia.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('returns cleanup function that removes listener', () => {
      const callback = vi.fn()
      const cleanup = theme.onSystemThemeChange(callback)

      cleanup()

      expect(mockMatchMedia.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('calls callback with true when system changes to dark', () => {
      const callback = vi.fn()
      theme.onSystemThemeChange(callback)

      // Trigger a change event
      mockMatchMedia._triggerChange(true)

      expect(callback).toHaveBeenCalledWith(true)
    })

    it('calls callback with false when system changes to light', () => {
      const callback = vi.fn()
      theme.onSystemThemeChange(callback)

      // Trigger a change event
      mockMatchMedia._triggerChange(false)

      expect(callback).toHaveBeenCalledWith(false)
    })

    it('does not call callback after cleanup', () => {
      const callback = vi.fn()
      const cleanup = theme.onSystemThemeChange(callback)

      cleanup()

      // Manually call the trigger to verify callback isn't called
      // This verifies the listener was actually removed
      mockMatchMedia._triggerChange(true)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('integration scenarios', () => {
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

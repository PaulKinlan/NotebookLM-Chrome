/**
 * Unit tests for useTheme module
 *
 * Tests the theme state management module including:
 * - initTheme: Initializes theme system on app startup
 * - isInitialized: Checks if theme system is initialized
 * - onThemeInitialized: Registers callbacks for initialization completion
 * - getPreference: Gets current theme preference
 * - getResolvedTheme: Gets resolved theme (light/dark)
 * - setPreference: Sets theme preference
 * - onThemeChange: Subscribes to theme changes
 * - useTheme: Hook-like interface for components
 * - ThemeProvider: No-op wrapper for vanilla JS
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import type { ThemePreference, ResolvedTheme } from '../../types/index.ts'

// Mock the theme library module
const mockGetThemePreference = vi.fn<() => Promise<ThemePreference>>()
const mockSaveThemePreference = vi.fn<(pref: ThemePreference) => Promise<void>>()
const mockResolveTheme = vi.fn<(pref: ThemePreference) => ResolvedTheme>()
const mockApplyTheme = vi.fn<(theme: ResolvedTheme | null) => void>()
const mockOnSystemThemeChange = vi.fn<(cb: (isDark: boolean) => void) => () => void>()

vi.mock('../../lib/theme.ts', () => ({
  getThemePreference: (): Promise<ThemePreference> => mockGetThemePreference(),
  setThemePreference: (pref: ThemePreference): Promise<void> => mockSaveThemePreference(pref),
  resolveTheme: (pref: ThemePreference): ResolvedTheme => mockResolveTheme(pref),
  applyTheme: (theme: ResolvedTheme | null): void => mockApplyTheme(theme),
  onSystemThemeChange: (cb: (isDark: boolean) => void): (() => void) => mockOnSystemThemeChange(cb),
}))

// Type for the useTheme module
type UseThemeModule = typeof import('./useTheme.tsx')

describe('useTheme', () => {
  let useThemeModule: UseThemeModule
  let systemThemeCallback: ((isDark: boolean) => void) | null = null

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Set up default mock behaviors
    mockGetThemePreference.mockResolvedValue('system')
    mockSaveThemePreference.mockResolvedValue(undefined)
    mockResolveTheme.mockImplementation((pref: ThemePreference): ResolvedTheme => {
      if (pref === 'system') return 'dark'
      return pref
    })
    mockApplyTheme.mockReturnValue(undefined)
    mockOnSystemThemeChange.mockImplementation((cb: (isDark: boolean) => void) => {
      systemThemeCallback = cb
      return () => {
        systemThemeCallback = null
      }
    })

    // Re-import the module fresh
    useThemeModule = await import('./useTheme.tsx')
  })

  afterEach(() => {
    systemThemeCallback = null
  })

  describe('initTheme', () => {
    it('initializes theme from stored preference', async () => {
      mockGetThemePreference.mockResolvedValue('dark')

      await useThemeModule.initTheme()

      expect(mockGetThemePreference).toHaveBeenCalled()
      expect(mockResolveTheme).toHaveBeenCalledWith('dark')
    })

    it('applies theme to DOM for explicit preference', async () => {
      mockGetThemePreference.mockResolvedValue('light')
      mockResolveTheme.mockReturnValue('light')

      await useThemeModule.initTheme()

      expect(mockApplyTheme).toHaveBeenCalledWith('light')
    })

    it('applies null for system preference (lets CSS handle it)', async () => {
      mockGetThemePreference.mockResolvedValue('system')

      await useThemeModule.initTheme()

      expect(mockApplyTheme).toHaveBeenCalledWith(null)
    })

    it('sets up system theme change listener', async () => {
      await useThemeModule.initTheme()

      expect(mockOnSystemThemeChange).toHaveBeenCalled()
    })

    it('only initializes once', async () => {
      await useThemeModule.initTheme()
      await useThemeModule.initTheme()
      await useThemeModule.initTheme()

      expect(mockGetThemePreference).toHaveBeenCalledTimes(1)
    })

    it('notifies init callbacks after initialization', async () => {
      const callback = vi.fn()
      useThemeModule.onThemeInitialized(callback)

      await useThemeModule.initTheme()

      expect(callback).toHaveBeenCalledWith('system')
    })
  })

  describe('isInitialized', () => {
    it('returns false before initTheme is called', () => {
      expect(useThemeModule.isInitialized()).toBe(false)
    })

    it('returns true after initTheme completes', async () => {
      await useThemeModule.initTheme()

      expect(useThemeModule.isInitialized()).toBe(true)
    })
  })

  describe('onThemeInitialized', () => {
    it('calls callback immediately if already initialized', async () => {
      await useThemeModule.initTheme()

      const callback = vi.fn()
      useThemeModule.onThemeInitialized(callback)

      expect(callback).toHaveBeenCalledWith('system')
    })

    it('queues callback if not yet initialized', async () => {
      const callback = vi.fn()
      useThemeModule.onThemeInitialized(callback)

      expect(callback).not.toHaveBeenCalled()

      await useThemeModule.initTheme()

      expect(callback).toHaveBeenCalledWith('system')
    })

    it('returns cleanup function', async () => {
      const callback = vi.fn()
      const cleanup = useThemeModule.onThemeInitialized(callback)

      cleanup()
      await useThemeModule.initTheme()

      // Callback should not have been called because we cleaned up
      expect(callback).not.toHaveBeenCalled()
    })

    it('returns no-op cleanup when already initialized', async () => {
      await useThemeModule.initTheme()

      const callback = vi.fn()
      const cleanup = useThemeModule.onThemeInitialized(callback)

      // Should return a no-op cleanup
      expect(cleanup).toBeInstanceOf(Function)
      cleanup() // Should not throw
    })
  })

  describe('getPreference', () => {
    it('returns system as default before initialization', () => {
      const result = useThemeModule.getPreference()

      expect(result).toBe('system')
    })

    it('returns stored preference after initialization', async () => {
      mockGetThemePreference.mockResolvedValue('dark')

      await useThemeModule.initTheme()

      expect(useThemeModule.getPreference()).toBe('dark')
    })
  })

  describe('getResolvedTheme', () => {
    it('returns dark as default before initialization', () => {
      const result = useThemeModule.getResolvedTheme()

      expect(result).toBe('dark')
    })

    it('returns resolved theme after initialization', async () => {
      mockGetThemePreference.mockResolvedValue('light')
      mockResolveTheme.mockReturnValue('light')

      await useThemeModule.initTheme()

      expect(useThemeModule.getResolvedTheme()).toBe('light')
    })
  })

  describe('setPreference', () => {
    it('updates current preference', async () => {
      await useThemeModule.initTheme()
      await useThemeModule.setPreference('dark')

      expect(useThemeModule.getPreference()).toBe('dark')
    })

    it('resolves and updates resolved theme', async () => {
      mockResolveTheme.mockImplementation((pref: ThemePreference): ResolvedTheme => pref === 'light' ? 'light' : 'dark')

      await useThemeModule.initTheme()
      await useThemeModule.setPreference('light')

      expect(useThemeModule.getResolvedTheme()).toBe('light')
    })

    it('applies null to DOM for system preference', async () => {
      await useThemeModule.initTheme()
      mockApplyTheme.mockClear()

      await useThemeModule.setPreference('system')

      expect(mockApplyTheme).toHaveBeenCalledWith(null)
    })

    it('applies explicit theme to DOM for light/dark', async () => {
      await useThemeModule.initTheme()
      mockApplyTheme.mockClear()

      await useThemeModule.setPreference('light')

      expect(mockApplyTheme).toHaveBeenCalledWith('light')
    })

    it('saves preference to storage', async () => {
      await useThemeModule.initTheme()

      await useThemeModule.setPreference('dark')

      expect(mockSaveThemePreference).toHaveBeenCalledWith('dark')
    })

    it('notifies listeners of preference change', async () => {
      await useThemeModule.initTheme()

      const callback = vi.fn()
      useThemeModule.onThemeChange(callback)

      await useThemeModule.setPreference('light')

      expect(callback).toHaveBeenCalledWith('light', expect.any(String))
    })
  })

  describe('onThemeChange', () => {
    it('adds listener that is called on preference change', async () => {
      await useThemeModule.initTheme()

      const callback = vi.fn()
      useThemeModule.onThemeChange(callback)

      await useThemeModule.setPreference('dark')

      expect(callback).toHaveBeenCalledWith('dark', expect.any(String))
    })

    it('returns cleanup function that removes listener', async () => {
      await useThemeModule.initTheme()

      const callback = vi.fn()
      const cleanup = useThemeModule.onThemeChange(callback)

      cleanup()

      await useThemeModule.setPreference('light')

      expect(callback).not.toHaveBeenCalled()
    })

    it('receives both preference and resolved theme', async () => {
      mockResolveTheme.mockReturnValue('dark')

      await useThemeModule.initTheme()

      const callback = vi.fn()
      useThemeModule.onThemeChange(callback)

      await useThemeModule.setPreference('dark')

      expect(callback).toHaveBeenCalledWith('dark', 'dark')
    })

    it('can have multiple listeners', async () => {
      await useThemeModule.initTheme()

      const callback1 = vi.fn()
      const callback2 = vi.fn()
      useThemeModule.onThemeChange(callback1)
      useThemeModule.onThemeChange(callback2)

      await useThemeModule.setPreference('light')

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('system theme change handling', () => {
    it('updates resolved theme when system changes and preference is system', async () => {
      mockGetThemePreference.mockResolvedValue('system')
      mockResolveTheme.mockReturnValue('dark')

      await useThemeModule.initTheme()
      expect(useThemeModule.getResolvedTheme()).toBe('dark')

      // Simulate system theme change to light
      if (systemThemeCallback) {
        systemThemeCallback(false) // isDark = false means light
      }

      expect(useThemeModule.getResolvedTheme()).toBe('light')
    })

    it('notifies listeners when system theme changes', async () => {
      mockGetThemePreference.mockResolvedValue('system')

      await useThemeModule.initTheme()

      const callback = vi.fn()
      useThemeModule.onThemeChange(callback)

      // Simulate system theme change
      if (systemThemeCallback) {
        systemThemeCallback(true) // isDark = true
      }

      expect(callback).toHaveBeenCalled()
    })

    it('does not update resolved theme when preference is explicit', async () => {
      mockGetThemePreference.mockResolvedValue('light')
      mockResolveTheme.mockReturnValue('light')

      await useThemeModule.initTheme()
      await useThemeModule.setPreference('light')

      const callback = vi.fn()
      useThemeModule.onThemeChange(callback)
      callback.mockClear() // Clear from setPreference call

      // Simulate system theme change - should be ignored because preference is explicit
      if (systemThemeCallback) {
        systemThemeCallback(true)
      }

      expect(callback).not.toHaveBeenCalled()
      expect(useThemeModule.getResolvedTheme()).toBe('light')
    })
  })

  describe('useTheme', () => {
    it('returns hook-like interface', async () => {
      await useThemeModule.initTheme()

      const result = useThemeModule.useTheme()

      expect(typeof result.preference).toBe('string')
      expect(typeof result.resolvedTheme).toBe('string')
      expect(typeof result.setPreference).toBe('function')
      expect(result.isLoading).toBe(false)
    })

    it('returns isLoading true before initialization', () => {
      const result = useThemeModule.useTheme()

      expect(result.isLoading).toBe(true)
    })

    it('returns isLoading false after initialization', async () => {
      await useThemeModule.initTheme()

      const result = useThemeModule.useTheme()

      expect(result.isLoading).toBe(false)
    })

    it('returns current preference', async () => {
      mockGetThemePreference.mockResolvedValue('dark')
      mockResolveTheme.mockReturnValue('dark')

      await useThemeModule.initTheme()

      const result = useThemeModule.useTheme()

      expect(result.preference).toBe('dark')
    })

    it('returns current resolved theme', async () => {
      mockGetThemePreference.mockResolvedValue('system')
      mockResolveTheme.mockReturnValue('light')

      await useThemeModule.initTheme()

      const result = useThemeModule.useTheme()

      expect(result.resolvedTheme).toBe('light')
    })
  })

  describe('ThemeProvider', () => {
    it('returns children unchanged (no-op wrapper)', () => {
      const mockChild = { nodeType: 1, nodeName: 'DIV' } as unknown as Node

      const result = useThemeModule.ThemeProvider({ children: mockChild })

      expect(result).toBe(mockChild)
    })
  })

  describe('integration scenarios', () => {
    it('handles complete theme lifecycle', async () => {
      // Before initialization
      expect(useThemeModule.isInitialized()).toBe(false)
      expect(useThemeModule.useTheme().isLoading).toBe(true)

      // Set up init callback
      const initCallback = vi.fn()
      useThemeModule.onThemeInitialized(initCallback)

      // Initialize
      await useThemeModule.initTheme()

      // After initialization
      expect(useThemeModule.isInitialized()).toBe(true)
      expect(initCallback).toHaveBeenCalledWith('system')
      expect(useThemeModule.useTheme().isLoading).toBe(false)

      // Set up change listener
      const changeCallback = vi.fn()
      const cleanup = useThemeModule.onThemeChange(changeCallback)

      // Change preference
      await useThemeModule.setPreference('dark')
      expect(changeCallback).toHaveBeenCalledWith('dark', expect.any(String))
      expect(useThemeModule.getPreference()).toBe('dark')

      // Cleanup listener
      cleanup()
      changeCallback.mockClear()

      // Change again - listener should not be called
      await useThemeModule.setPreference('light')
      expect(changeCallback).not.toHaveBeenCalled()
    })

    it('handles system preference changes correctly', async () => {
      mockGetThemePreference.mockResolvedValue('system')

      await useThemeModule.initTheme()

      const callback = vi.fn()
      useThemeModule.onThemeChange(callback)

      // Simulate multiple system theme changes
      if (systemThemeCallback) {
        systemThemeCallback(false) // Light
        expect(useThemeModule.getResolvedTheme()).toBe('light')

        systemThemeCallback(true) // Dark
        expect(useThemeModule.getResolvedTheme()).toBe('dark')
      }

      expect(callback).toHaveBeenCalledTimes(2)
    })
  })
})

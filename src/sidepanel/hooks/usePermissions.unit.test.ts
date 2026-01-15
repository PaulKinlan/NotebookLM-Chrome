/**
 * Unit tests for usePermissions hook
 *
 * Tests the permissions management hook including:
 * - Permission state initialization (all false)
 * - Permission checking via hasPermission
 * - Permission refresh updates state
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/preact'

// Import hook after global chrome mock is set up in src/test/setup.ts
import { usePermissions } from './usePermissions'

// Type for the mocked chrome.permissions.contains function
type MockedContainsFn = {
  mockImplementation: (impl: any) => void
  mockResolvedValue: (value: boolean) => void
}

// Type for the global chrome mock
type ChromeMock = typeof globalThis.chrome & {
  permissions: {
    contains: MockedContainsFn
  }
}

describe('usePermissions', () => {
  let chromeMock: ChromeMock

  beforeEach(() => {
    vi.clearAllMocks()

    // Get reference to global chrome mock
    chromeMock = globalThis.chrome as ChromeMock

    // Reset to default: no permissions granted
    chromeMock.permissions.contains.mockImplementation(
      async () => {
        // All permissions default to false
        return false
      },
    )
  })

  describe('initial state', () => {
    it('initializes with all permissions set to false', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.permissions).toEqual({
        tabs: false,
        bookmarks: false,
        history: false,
        tabGroups: false,
      })
    })
  })

  describe('hasPermission', () => {
    it('returns false for tabs permission when not granted', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasPermission('tabs')).toBe(false)
    })

    it('returns false for bookmarks permission when not granted', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasPermission('bookmarks')).toBe(false)
    })

    it('returns false for history permission when not granted', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasPermission('history')).toBe(false)
    })

    it('returns false for tabGroups permission when not granted', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasPermission('tabGroups')).toBe(false)
    })

    it('returns true for tabs permission when granted', async () => {
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          return permissions.includes('tabs')
        },
      )

      const { result } = renderHook(() => usePermissions())

      // Refresh to get updated permissions
      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.hasPermission('tabs')).toBe(true)
    })

    it('returns true for multiple permissions when granted', async () => {
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          // Grant tabs and bookmarks
          return permissions.includes('tabs') || permissions.includes('bookmarks')
        },
      )

      const { result } = renderHook(() => usePermissions())

      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.hasPermission('tabs')).toBe(true)
      expect(result.current.hasPermission('bookmarks')).toBe(true)
      expect(result.current.hasPermission('history')).toBe(false)
      expect(result.current.hasPermission('tabGroups')).toBe(false)
    })
  })

  describe('refreshPermissions', () => {
    it('updates permissions state after refresh', async () => {
      // Initially all false
      const { result } = renderHook(() => usePermissions())

      expect(result.current.permissions.tabs).toBe(false)

      // Mock tabs permission granted
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          return permissions.includes('tabs')
        },
      )

      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.permissions.tabs).toBe(true)
    })

    it('calls chrome.permissions.contains for each permission type', async () => {
      const { result } = renderHook(() => usePermissions())

      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(chromeMock.permissions.contains).toHaveBeenCalledTimes(4)
      expect(chromeMock.permissions.contains).toHaveBeenCalledWith({
        permissions: ['tabs'],
      })
      expect(chromeMock.permissions.contains).toHaveBeenCalledWith({
        permissions: ['tabGroups'],
      })
      expect(chromeMock.permissions.contains).toHaveBeenCalledWith({
        permissions: ['bookmarks'],
      })
      expect(chromeMock.permissions.contains).toHaveBeenCalledWith({
        permissions: ['history'],
      })
    })

    it('updates all permissions to true when all are granted', async () => {
      chromeMock.permissions.contains.mockResolvedValue(true)

      const { result } = renderHook(() => usePermissions())

      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.permissions).toEqual({
        tabs: true,
        bookmarks: true,
        history: true,
        tabGroups: true,
      })
    })

    it('handles partial permission grants', async () => {
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          // Only grant tabs and history
          return permissions.includes('tabs') || permissions.includes('history')
        },
      )

      const { result } = renderHook(() => usePermissions())

      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.permissions).toEqual({
        tabs: true,
        bookmarks: false,
        history: true,
        tabGroups: false,
      })
    })

    it('handles permission changes on multiple refreshes', async () => {
      let callCount = 0
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          callCount++
          // First call: no permissions
          if (callCount <= 4) return false
          // Second call: tabs granted
          return permissions.includes('tabs')
        },
      )

      const { result } = renderHook(() => usePermissions())

      // Initial refresh - no permissions
      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.permissions.tabs).toBe(false)

      // Second refresh - tabs granted
      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.permissions.tabs).toBe(true)
    })

    it('preserves permission callback reference across re-renders', () => {
      const { result, rerender } = renderHook(() => usePermissions())

      const initialCallback = result.current.hasPermission
      const initialRefresh = result.current.refreshPermissions

      rerender()

      // Callbacks should remain stable (useCallback)
      expect(result.current.hasPermission).toBe(initialCallback)
      expect(result.current.refreshPermissions).toBe(initialRefresh)
    })
  })

  describe('permission state consistency', () => {
    it('hasPermission reflects current permissions state', async () => {
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          return permissions.includes('bookmarks')
        },
      )

      const { result } = renderHook(() => usePermissions())

      // Before refresh - all false
      expect(result.current.hasPermission('bookmarks')).toBe(false)

      // After refresh - bookmarks true
      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.hasPermission('bookmarks')).toBe(true)
      expect(result.current.permissions.bookmarks).toBe(true)
    })

    it('permissions object updates trigger hasPermission to return new values', async () => {
      chromeMock.permissions.contains.mockImplementation(
        async ({ permissions }: { permissions: string[] }) => {
          return permissions.includes('history')
        },
      )

      const { result } = renderHook(() => usePermissions())

      expect(result.current.hasPermission('history')).toBe(false)

      await act(async () => {
        await result.current.refreshPermissions()
      })

      expect(result.current.hasPermission('history')).toBe(true)
    })
  })
})

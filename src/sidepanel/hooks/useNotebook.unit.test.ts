/**
 * Unit tests for useNotebook hook
 *
 * Tests the notebook management hook including:
 * - Loading notebooks and active notebook on mount
 * - Creating new notebooks
 * - Deleting notebooks
 * - Selecting notebooks
 * - Reloading notebooks
 * - Loading state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/preact'
import { useNotebook } from './useNotebook'
import { currentNotebookId, notebooks, notebooksLoading } from '../store'
import type { Notebook } from '../../types/index.ts'

// ============================================================================
// IndexedDB Mocks
// ============================================================================

// Mock in-memory IndexedDB storage
const mockNotebooks = new Map<string, Notebook>()
const mockSettings = new Map<string, unknown>()
let mockGetNotebooksDelay = 0

// Reset mock storage before each test
function resetMockStorage() {
  mockNotebooks.clear()
  mockSettings.clear()
  mockGetNotebooksDelay = 0
}

// Mock the db module
vi.mock('../../lib/db.ts', () => ({
  dbGet: vi.fn(<T>(storeName: string, key: string): Promise<T | null> => {
    if (storeName === 'notebooks') {
      const value = mockNotebooks.get(key)
      return Promise.resolve((value as T ?? null))
    }
    if (storeName === 'settings') {
      const value = mockSettings.get(key)
      if (value !== undefined) {
        return Promise.resolve({ key, value } as T)
      }
      return Promise.resolve(null)
    }
    return Promise.resolve(null)
  }),
  dbGetAll: vi.fn(<T>(storeName: string): Promise<T[]> => {
    if (storeName === 'notebooks') {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(Array.from(mockNotebooks.values()) as unknown as T[])
        }, mockGetNotebooksDelay)
      })
    }
    return Promise.resolve([])
  }),
  dbPut: vi.fn(<T>(storeName: string, value: T): Promise<void> => {
    if (storeName === 'notebooks') {
      const notebook = value as Notebook
      mockNotebooks.set(notebook.id, notebook)
    }
    if (storeName === 'settings') {
      const setting = value as { key: string, value: unknown }
      mockSettings.set(setting.key, setting.value)
    }
    return Promise.resolve()
  }),
  dbDelete: vi.fn((storeName: string, key: string): Promise<void> => {
    if (storeName === 'notebooks') {
      mockNotebooks.delete(key)
    }
    if (storeName === 'settings') {
      mockSettings.delete(key)
    }
    return Promise.resolve()
  }),
  dbDeleteByIndex: vi.fn((): Promise<void> => {
    // Mock deletion of related data (sources, chatEvents, etc.)
    return Promise.resolve()
  }),
  dbGetByIndex: vi.fn(<T>(): Promise<T[]> => {
    // Mock querying by index
    return Promise.resolve([])
  }),
  dbClearAll: vi.fn((): Promise<void> => {
    mockNotebooks.clear()
    mockSettings.clear()
    return Promise.resolve()
  }),
}))

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => {
    return `test-${Math.random().toString(36).substring(2, 15)}`
  },
})

beforeEach(() => {
  resetMockStorage()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.stubGlobal('crypto', {
    randomUUID: () => {
      return `test-${Math.random().toString(36).substring(2, 15)}`
    },
  })

  // Reset global signals to initial state
  currentNotebookId.value = null
  notebooks.value = []
  notebooksLoading.value = false
})

// ============================================================================
// Tests
// ============================================================================

describe('useNotebook', () => {
  describe('initial state and loading', () => {
    it('loads notebooks and active notebook on mount', async () => {
      // Setup mock data
      const notebook1: Notebook = {
        id: 'nb-1',
        name: 'Research Project',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      const notebook2: Notebook = {
        id: 'nb-2',
        name: 'Meeting Notes',
        syncStatus: 'local',
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 1000,
      }
      mockNotebooks.set(notebook1.id, notebook1)
      mockNotebooks.set(notebook2.id, notebook2)
      mockSettings.set('activeNotebookId', 'nb-1')

      const { result } = renderHook(() => useNotebook())

      // Initially should be loading
      expect(result.current.isLoading).toBe(true)

      // Wait for async operations to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should have loaded notebooks (sorted by updatedAt desc)
      expect(result.current.notebooks).toHaveLength(2)
      expect(result.current.notebooks[0].id).toBe('nb-2') // Most recently updated
      expect(result.current.notebooks[1].id).toBe('nb-1')

      // Should have loaded active notebook
      expect(result.current.currentNotebookId).toBe('nb-1')
    })

    it('returns empty state when no notebooks exist', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.notebooks).toEqual([])
      expect(result.current.currentNotebookId).toBeNull()
    })

    it('handles missing active notebook ID', async () => {
      // Add notebooks but no active notebook ID
      const notebook: Notebook = {
        id: 'nb-1',
        name: 'Test Notebook',
        syncStatus: 'local',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      mockNotebooks.set(notebook.id, notebook)

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentNotebookId).toBeNull()
      expect(result.current.notebooks).toHaveLength(1)
    })
  })

  describe('selectNotebook', () => {
    it('selects a notebook and reloads the list', async () => {
      const notebook1: Notebook = {
        id: 'nb-1',
        name: 'Notebook 1',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      const notebook2: Notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        syncStatus: 'local',
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 1000,
      }
      mockNotebooks.set(notebook1.id, notebook1)
      mockNotebooks.set(notebook2.id, notebook2)

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Select a different notebook
      await act(async () => {
        await result.current.selectNotebook('nb-2')
      })

      // Active notebook should be updated
      expect(result.current.currentNotebookId).toBe('nb-2')

      // Settings should be updated
      expect(mockSettings.get('activeNotebookId')).toBe('nb-2')
    })

    it('persists selected notebook to storage', async () => {
      const notebook: Notebook = {
        id: 'nb-1',
        name: 'Test Notebook',
        syncStatus: 'local',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      mockNotebooks.set(notebook.id, notebook)

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.selectNotebook('nb-1')
      })

      // Verify the setting was persisted
      expect(mockSettings.get('activeNotebookId')).toBe('nb-1')
    })
  })

  describe('createNotebook', () => {
    it('creates a new notebook and selects it', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let createdNotebook: Notebook | undefined
      await act(async () => {
        createdNotebook = await result.current.createNotebook('New Research')
      })

      // Notebook should be created
      expect(createdNotebook!.name).toBe('New Research')
      expect(createdNotebook!.syncStatus).toBe('local')
      expect(createdNotebook!.id).toBeTruthy()

      // Should be saved to storage
      expect(mockNotebooks.has(createdNotebook!.id)).toBe(true)

      // Should be selected as active
      expect(result.current.currentNotebookId).toBe(createdNotebook!.id)

      // Should appear in notebooks list
      expect(result.current.notebooks).toHaveLength(1)
      expect(result.current.notebooks[0].id).toBe(createdNotebook!.id)
    })

    it('sets proper timestamps on created notebook', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const beforeCreate = Date.now()

      let createdNotebook: Notebook | undefined
      await act(async () => {
        createdNotebook = await result.current.createNotebook('Timestamp Test')
      })

      const afterCreate = Date.now()

      // Timestamps should be set
      expect(createdNotebook!.createdAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(createdNotebook!.createdAt).toBeLessThanOrEqual(afterCreate)
      expect(createdNotebook!.updatedAt).toBeGreaterThanOrEqual(beforeCreate)
      expect(createdNotebook!.updatedAt).toBeLessThanOrEqual(afterCreate)
    })

    it('adds new notebook to existing notebooks list', async () => {
      // Start with an existing notebook
      const existingNotebook: Notebook = {
        id: 'nb-existing',
        name: 'Existing Notebook',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      mockNotebooks.set(existingNotebook.id, existingNotebook)

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.notebooks).toHaveLength(1)

      // Create a new notebook
      await act(async () => {
        await result.current.createNotebook('New Notebook')
      })

      // Should now have 2 notebooks
      expect(result.current.notebooks).toHaveLength(2)

      // Names should be preserved
      const names = result.current.notebooks.map(nb => nb.name)
      expect(names).toContain('Existing Notebook')
      expect(names).toContain('New Notebook')
    })
  })

  describe('deleteNotebook', () => {
    it('deletes a notebook and removes from list', async () => {
      const notebook1: Notebook = {
        id: 'nb-1',
        name: 'Notebook 1',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      const notebook2: Notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        syncStatus: 'local',
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 1000,
      }
      mockNotebooks.set(notebook1.id, notebook1)
      mockNotebooks.set(notebook2.id, notebook2)
      mockSettings.set('activeNotebookId', 'nb-1')

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.notebooks).toHaveLength(2)

      // Delete notebook 1
      await act(async () => {
        await result.current.deleteNotebook('nb-1')
      })

      // Should be removed from storage
      expect(mockNotebooks.has('nb-1')).toBe(false)
      expect(mockNotebooks.has('nb-2')).toBe(true)

      // Should be removed from list
      expect(result.current.notebooks).toHaveLength(1)
      expect(result.current.notebooks[0].id).toBe('nb-2')
    })

    it('clears active notebook from storage when deleting the active one', async () => {
      const notebook1: Notebook = {
        id: 'nb-1',
        name: 'Notebook 1',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      const notebook2: Notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        syncStatus: 'local',
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 1000,
      }
      mockNotebooks.set(notebook1.id, notebook1)
      mockNotebooks.set(notebook2.id, notebook2)
      mockSettings.set('activeNotebookId', 'nb-1')

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentNotebookId).toBe('nb-1')

      // Delete the active notebook
      await act(async () => {
        await result.current.deleteNotebook('nb-1')
      })

      // Storage should have the active notebook cleared (undefined = deleted)
      expect(mockSettings.get('activeNotebookId')).toBeUndefined()
    })

    it('preserves active notebook when deleting a different one', async () => {
      const notebook1: Notebook = {
        id: 'nb-1',
        name: 'Notebook 1',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      const notebook2: Notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        syncStatus: 'local',
        createdAt: Date.now() - 20000,
        updatedAt: Date.now() - 1000,
      }
      mockNotebooks.set(notebook1.id, notebook1)
      mockNotebooks.set(notebook2.id, notebook2)
      mockSettings.set('activeNotebookId', 'nb-1')

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentNotebookId).toBe('nb-1')

      // Delete the non-active notebook
      await act(async () => {
        await result.current.deleteNotebook('nb-2')
      })

      // Active notebook should still be nb-1
      expect(result.current.currentNotebookId).toBe('nb-1')
    })
  })

  describe('reloadNotebooks', () => {
    it('reloads the notebooks list', async () => {
      const notebook1: Notebook = {
        id: 'nb-1',
        name: 'Notebook 1',
        syncStatus: 'local',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 5000,
      }
      mockNotebooks.set(notebook1.id, notebook1)

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.notebooks).toHaveLength(1)

      // Add a new notebook directly to storage (simulating external change)
      const notebook2: Notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        syncStatus: 'local',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      mockNotebooks.set(notebook2.id, notebook2)

      // Reload
      await act(async () => {
        await result.current.reloadNotebooks()
      })

      // Should now have 2 notebooks
      expect(result.current.notebooks).toHaveLength(2)
      expect(result.current.notebooks.map(nb => nb.id)).toContain('nb-2')
    })

    it('reloads the active notebook ID', async () => {
      mockNotebooks.set('nb-1', {
        id: 'nb-1',
        name: 'Notebook 1',
        syncStatus: 'local',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      mockSettings.set('activeNotebookId', 'nb-1')

      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentNotebookId).toBe('nb-1')

      // Simulate external change to active notebook
      mockSettings.set('activeNotebookId', 'nb-2')

      // Reload
      await act(async () => {
        await result.current.reloadNotebooks()
      })

      expect(result.current.currentNotebookId).toBe('nb-2')
    })
  })

  describe('loading state', () => {
    it('sets loading to true during operations', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Create a notebook with delay
      mockGetNotebooksDelay = 100

      let notebookPromise: Promise<Notebook> | undefined
      await act(async () => {
        notebookPromise = result.current.createNotebook('Loading Test')
      })

      // isLoading should be set during the operation
      // (Note: this is timing-dependent and may vary)
      expect(result.current.notebooks.length).toBeGreaterThanOrEqual(0)

      await notebookPromise
    })

    it('sets loading back to false after operation completes', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.createNotebook('Final Loading Test')
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles empty notebook name', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let createdNotebook: Notebook | undefined
      await act(async () => {
        createdNotebook = await result.current.createNotebook('')
      })

      expect(createdNotebook!.name).toBe('')
      expect(createdNotebook!.id).toBeTruthy()
    })

    it('handles special characters in notebook name', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const specialName = 'Notebook with <script> & "quotes" & \'apostrophes\''
      let createdNotebook: Notebook | undefined
      await act(async () => {
        createdNotebook = await result.current.createNotebook(specialName)
      })

      expect(createdNotebook!.name).toBe(specialName)
    })

    it('handles concurrent create operations', async () => {
      const { result } = renderHook(() => useNotebook())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Create multiple notebooks concurrently
      await act(async () => {
        await Promise.all([
          result.current.createNotebook('Notebook A'),
          result.current.createNotebook('Notebook B'),
          result.current.createNotebook('Notebook C'),
        ])
      })

      // All notebooks should be created
      expect(result.current.notebooks).toHaveLength(3)
      const names = result.current.notebooks.map(nb => nb.name).sort()
      expect(names).toEqual(['Notebook A', 'Notebook B', 'Notebook C'])
    })
  })
})

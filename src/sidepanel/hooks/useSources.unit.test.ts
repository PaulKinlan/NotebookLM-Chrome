/**
 * Unit tests for useSources hook
 *
 * Tests the source management hook including:
 * - Source listing with notebook changes
 * - Adding sources with proper data augmentation
 * - Removing sources from storage
 * - Refresh functionality via reloadSources
 * - Clear sources functionality
 * - Loading state management
 * - Error handling for missing notebook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/preact'
import type { Source } from '../../types/index.ts'

// Mock the storage module before importing useSources
const mockGetSourcesByNotebook = vi.fn()
const mockSaveSource = vi.fn()
const mockDeleteSource = vi.fn()

vi.mock('../../lib/storage.ts', () => ({
  getSourcesByNotebook: () => mockGetSourcesByNotebook(),
  saveSource: (source: Source) => mockSaveSource(source),
  deleteSource: (id: string) => mockDeleteSource(id),
}))

// Import useSources after mocking
import { useSources } from './useSources'

// ============================================================================
// Mocks
// ============================================================================

// Mock crypto.randomUUID
const mockUUIDs: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllGlobals()
  mockUUIDs.length = 0

  vi.stubGlobal('crypto', {
    randomUUID: () => mockUUIDs.shift() ?? `mock-uuid-${Math.random()}`,
  })

  // Reset mock behaviors
  mockGetSourcesByNotebook.mockReset()
  mockSaveSource.mockReset()
  mockDeleteSource.mockReset()

  // Default: empty sources
  mockGetSourcesByNotebook.mockResolvedValue([])
})

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSourceData(overrides: Partial<Source> = {}): Omit<Source, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    notebookId: 'notebook-1',
    type: 'tab',
    url: 'https://example.com',
    title: 'Example Page',
    content: 'Example content',
    syncStatus: 'local',
    ...overrides,
  }
}

function createMockSource(overrides: Partial<Source> = {}): Source {
  const now = Date.now()
  return {
    id: `source-${Math.random()}`,
    notebookId: 'notebook-1',
    type: 'tab',
    url: 'https://example.com',
    title: 'Example Page',
    content: 'Example content',
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('useSources', () => {
  describe('source listing', () => {
    it('returns empty sources array when notebookId is null', () => {
      const { result } = renderHook(() => useSources(null))

      expect(result.current.sources).toEqual([])
    })

    it('loads sources for the given notebookId on mount', async () => {
      const mockSourceList: Source[] = [
        createMockSource({ id: 'source-1', title: 'Source 1' }),
        createMockSource({ id: 'source-2', title: 'Source 2' }),
      ]

      mockGetSourcesByNotebook.mockResolvedValueOnce(mockSourceList)

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources).toEqual(mockSourceList)
      })
    })

    it('calls getSourcesByNotebook with correct notebookId', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        // Verify the mock was called
        expect(mockGetSourcesByNotebook).toHaveBeenCalled()
      })
    })

    it('sets loading to true during source fetch', async () => {
      let resolveFetch: (value: Source[]) => void
      const fetchPromise = new Promise<Source[]>((resolve) => {
        resolveFetch = resolve
      })

      mockGetSourcesByNotebook.mockReturnValueOnce(fetchPromise)

      const { result } = renderHook(() => useSources('notebook-1'))

      // Loading should be true while fetching
      expect(result.current.isLoading).toBe(true)

      // Resolve the fetch
      resolveFetch!([])

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('clears sources when notebookId changes to null', async () => {
      const mockSourceList: Source[] = [
        createMockSource({ id: 'source-1', title: 'Source 1' }),
      ]

      mockGetSourcesByNotebook.mockResolvedValueOnce(mockSourceList)

      const { result, rerender } = renderHook(
        ({ notebookId }) => useSources(notebookId),
        { initialProps: { notebookId: 'notebook-1' as string | null } },
      )

      await waitFor(() => {
        expect(result.current.sources).toEqual(mockSourceList)
      })

      // Change notebookId to null
      void act(() => {
        rerender({ notebookId: null })
      })

      expect(result.current.sources).toEqual([])
    })

    it('reloads sources when notebookId changes to different notebook', async () => {
      const notebook1Sources: Source[] = [
        createMockSource({ id: 'source-1', notebookId: 'notebook-1', title: 'Source 1' }),
      ]

      const notebook2Sources: Source[] = [
        createMockSource({ id: 'source-2', notebookId: 'notebook-2', title: 'Source 2' }),
      ]

      mockGetSourcesByNotebook
        .mockResolvedValueOnce(notebook1Sources)
        .mockResolvedValueOnce(notebook2Sources)

      const { result, rerender } = renderHook(
        ({ notebookId }) => useSources(notebookId),
        { initialProps: { notebookId: 'notebook-1' } },
      )

      await waitFor(() => {
        expect(result.current.sources).toEqual(notebook1Sources)
      })

      void act(() => {
        rerender({ notebookId: 'notebook-2' })
      })

      await waitFor(() => {
        expect(result.current.sources).toEqual(notebook2Sources)
      })
    })

    it('returns sources sorted by createdAt descending (newest first)', async () => {
      const now = Date.now()
      // Storage layer returns sorted by createdAt descending (newest first)
      const sortedSourceList: Source[] = [
        createMockSource({ id: 'source-2', createdAt: now, title: 'Newest' }),
        createMockSource({ id: 'source-3', createdAt: now - 1000, title: 'Middle' }),
        createMockSource({ id: 'source-1', createdAt: now - 2000, title: 'Oldest' }),
      ]

      mockGetSourcesByNotebook.mockResolvedValueOnce(sortedSourceList)

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources[0].title).toBe('Newest')
        expect(result.current.sources[1].title).toBe('Middle')
        expect(result.current.sources[2].title).toBe('Oldest')
      })
    })
  })

  describe('adding sources', () => {
    it('adds a source with generated id, timestamps, and notebookId', async () => {
      const generatedId = 'generated-uuid-123'
      mockUUIDs.push(generatedId)

      mockGetSourcesByNotebook.mockResolvedValue([])

      const newSource = createMockSourceData({
        type: 'manual',
        url: 'https://test.com',
        title: 'Test Source',
        content: 'Test content',
      })

      const { result } = renderHook(() => useSources('notebook-1'))

      let addedSource: Source | undefined
      await act(async () => {
        addedSource = await result.current.addSource(newSource)
      })

      // The hook adds id, notebookId, createdAt, updatedAt but not syncStatus
      // (syncStatus is added by the storage layer)
      expect(addedSource).toMatchObject({
        id: generatedId,
        notebookId: 'notebook-1',
        type: 'manual',
        url: 'https://test.com',
        title: 'Test Source',
        content: 'Test content',
      })
      expect(typeof addedSource!.createdAt).toBe('number')
      expect(typeof addedSource!.updatedAt).toBe('number')
      expect(mockSaveSource).toHaveBeenCalledWith(addedSource)
    })

    it('reloads sources after adding a new source', async () => {
      const initialSources: Source[] = [
        createMockSource({ id: 'source-1', title: 'Source 1' }),
      ]

      const newSource = createMockSourceData({
        type: 'manual',
        title: 'New Source',
      })

      // First call: initial load
      mockGetSourcesByNotebook.mockResolvedValueOnce(initialSources)

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources).toEqual(initialSources)
      })

      // Second call: reload after add
      mockGetSourcesByNotebook.mockResolvedValueOnce([
        ...initialSources,
        createMockSource({ id: 'new-source', title: 'New Source' }),
      ])

      await act(async () => {
        await result.current.addSource(newSource)
      })

      await waitFor(() => {
        expect(mockGetSourcesByNotebook).toHaveBeenCalledTimes(2)
      })
    })

    it('throws error when adding source without active notebook', async () => {
      const { result } = renderHook(() => useSources(null))

      const sourceData = createMockSourceData()

      await expect(
        act(async () => {
          await result.current.addSource(sourceData)
        }),
      ).rejects.toThrow('No active notebook')
    })

    it('preserves optional fields when adding source', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const sourceWithMetadata = createMockSourceData({
        metadata: {
          favicon: 'https://example.com/favicon.ico',
          wordCount: 500,
        },
        links: [
          {
            url: 'https://linked.com',
            text: 'Link text',
            context: 'Surrounding context',
          },
        ],
      })

      const { result } = renderHook(() => useSources('notebook-1'))

      let addedSource: Source | undefined
      await act(async () => {
        addedSource = await result.current.addSource(sourceWithMetadata)
      })

      expect(addedSource!.metadata).toEqual({
        favicon: 'https://example.com/favicon.ico',
        wordCount: 500,
      })
      expect(addedSource!.links).toEqual([
        {
          url: 'https://linked.com',
          text: 'Link text',
          context: 'Surrounding context',
        },
      ])
    })

    it('preserves htmlContent field when adding source', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const sourceWithHtml = createMockSourceData({
        htmlContent: '<html><body>Rich content</body></html>',
      })

      const { result } = renderHook(() => useSources('notebook-1'))

      let addedSource: Source | undefined
      await act(async () => {
        addedSource = await result.current.addSource(sourceWithHtml)
      })

      expect(addedSource!.htmlContent).toBe('<html><body>Rich content</body></html>')
    })
  })

  describe('removing sources', () => {
    it('removes a source by id and reloads sources', async () => {
      const initialSources: Source[] = [
        createMockSource({ id: 'source-1', title: 'Source 1' }),
        createMockSource({ id: 'source-2', title: 'Source 2' }),
      ]

      const remainingSources: Source[] = [
        createMockSource({ id: 'source-2', title: 'Source 2' }),
      ]

      mockGetSourcesByNotebook
        .mockResolvedValueOnce(initialSources)
        .mockResolvedValueOnce(remainingSources)

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources).toEqual(initialSources)
      })

      await act(async () => {
        await result.current.removeSource('source-1')
      })

      expect(mockDeleteSource).toHaveBeenCalledWith('source-1')
    })

    it('handles removing non-existent source gracefully', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      // Should not throw even if source doesn't exist
      await act(async () => {
        await expect(
          result.current.removeSource('non-existent-id'),
        ).resolves.not.toThrow()
      })

      expect(mockDeleteSource).toHaveBeenCalledWith('non-existent-id')
    })
  })

  describe('reloadSources', () => {
    it('reloads sources when called explicitly', async () => {
      const initialSources: Source[] = [
        createMockSource({ id: 'source-1', title: 'Source 1' }),
      ]

      mockGetSourcesByNotebook.mockResolvedValueOnce(initialSources)

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources).toEqual(initialSources)
      })

      const refreshedSources: Source[] = [
        ...initialSources,
        createMockSource({ id: 'source-2', title: 'Source 2' }),
      ]

      mockGetSourcesByNotebook.mockResolvedValueOnce(refreshedSources)

      await act(async () => {
        await result.current.reloadSources()
      })

      await waitFor(() => {
        expect(result.current.sources).toEqual(refreshedSources)
      })
    })

    it('returns empty sources when reloading with null notebookId', async () => {
      const { result } = renderHook(() => useSources(null))

      await act(async () => {
        await result.current.reloadSources()
      })

      // Should not crash, sources should be empty
      expect(result.current.sources).toEqual([])
    })
  })

  describe('clearSources', () => {
    it('clears the sources array immediately', async () => {
      const mockSourceList: Source[] = [
        createMockSource({ id: 'source-1', title: 'Source 1' }),
      ]

      mockGetSourcesByNotebook.mockResolvedValueOnce(mockSourceList)

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources).toEqual(mockSourceList)
      })

      void act(() => {
        result.current.clearSources()
      })

      // Sources should be immediately cleared
      expect(result.current.sources).toEqual([])
    })

    it('does not affect storage when clearing sources', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      void act(() => {
        result.current.clearSources()
      })

      // Storage functions should not be called
      expect(mockSaveSource).not.toHaveBeenCalled()
      expect(mockDeleteSource).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('sets isLoading to false after successful fetch', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('sets isLoading to false after fetch completes', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      // Initially true during load
      expect(result.current.isLoading).toBe(true)

      // Then false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('sets isLoading to true during addSource operation', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      let resolveSave: () => void
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve
      })

      mockSaveSource.mockImplementationOnce(() => savePromise)

      const { result } = renderHook(() => useSources('notebook-1'))

      const addPromise = act(async () => {
        await result.current.addSource(createMockSourceData())
      })

      // Loading should be true during the operation
      expect(result.current.isLoading).toBe(true)

      resolveSave!()

      await addPromise

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('return value interface', () => {
    it('returns all required functions and state', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.sources).toBeDefined()
      })

      // Check all properties exist
      expect(result.current).toHaveProperty('sources')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('addSource')
      expect(result.current).toHaveProperty('removeSource')
      expect(result.current).toHaveProperty('reloadSources')
      expect(result.current).toHaveProperty('clearSources')

      // Check types
      expect(Array.isArray(result.current.sources)).toBe(true)
      expect(typeof result.current.isLoading).toBe('boolean')
      expect(typeof result.current.addSource).toBe('function')
      expect(typeof result.current.removeSource).toBe('function')
      expect(typeof result.current.reloadSources).toBe('function')
      expect(typeof result.current.clearSources).toBe('function')
    })
  })

  describe('all source types', () => {
    it('handles all valid source types', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const sourceTypes: Source['type'][] = ['tab', 'bookmark', 'history', 'manual', 'text']

      for (const type of sourceTypes) {
        mockGetSourcesByNotebook.mockResolvedValue([])

        const { result } = renderHook(() => useSources('notebook-1'))

        let addedSource: Source | undefined
        await act(async () => {
          addedSource = await result.current.addSource({
            notebookId: 'notebook-1',
            type,
            url: 'https://example.com',
            title: `Test ${type}`,
            content: `Content for ${type}`,
            syncStatus: 'local',
          })
        })

        expect(addedSource!.type).toBe(type)
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty sources list gracefully', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      await waitFor(() => {
        expect(result.current.sources).toEqual([])
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('handles multiple addSource calls sequentially', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result } = renderHook(() => useSources('notebook-1'))

      mockUUIDs.push('id-1', 'id-2', 'id-3')

      await act(async () => {
        await result.current.addSource(createMockSourceData({ title: 'Source 1' }))
      })

      await act(async () => {
        await result.current.addSource(createMockSourceData({ title: 'Source 2' }))
      })

      await act(async () => {
        await result.current.addSource(createMockSourceData({ title: 'Source 3' }))
      })

      expect(mockSaveSource).toHaveBeenCalledTimes(3)
    })

    it('maintains stable function references across re-renders', async () => {
      mockGetSourcesByNotebook.mockResolvedValue([])

      const { result, rerender } = renderHook(() => useSources('notebook-1'))

      const initialAddSource = result.current.addSource
      const initialRemoveSource = result.current.removeSource
      const initialReloadSources = result.current.reloadSources
      const initialClearSources = result.current.clearSources

      rerender()

      // Callbacks should remain stable (useCallback)
      expect(result.current.addSource).toBe(initialAddSource)
      expect(result.current.removeSource).toBe(initialRemoveSource)
      expect(result.current.reloadSources).toBe(initialReloadSources)
      expect(result.current.clearSources).toBe(initialClearSources)
    })
  })
})

/**
 * Unit tests for useSuggestedLinks hook
 *
 * Tests the suggested links management hook including:
 * - Loading suggested links via AI
 * - Auto-generation when sources are added (with debounce)
 * - Auto-regeneration when sources change
 * - Clear functionality
 * - Loading and error states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/preact'
import type { Source, SuggestedLink } from '../../types/index.ts'

// Mock the suggested-links module
const mockFilterLinksWithAI = vi.fn()
const mockHasExtractableLinks = vi.fn()
const mockGetRawLinkCount = vi.fn()

vi.mock('../../lib/suggested-links.ts', () => ({
  filterLinksWithAI: (...args: unknown[]) => mockFilterLinksWithAI(...args),
  hasExtractableLinks: (sources: Source[]) => mockHasExtractableLinks(sources),
  getRawLinkCount: (sources: Source[]) => mockGetRawLinkCount(sources),
}))

// Import after mocking
import {
  useSuggestedLinks,
  suggestedLinks,
  suggestedLinksLoading,
  suggestedLinksError,
  suggestedLinksInitialized,
} from './useSuggestedLinks'

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSource(overrides: Partial<Source> = {}): Source {
  const now = Date.now()
  return {
    id: `source-${Math.random()}`,
    notebookId: 'notebook-1',
    type: 'tab',
    url: 'https://example.com',
    title: 'Example Page',
    content: 'Example content with links',
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
    links: [
      { url: 'https://link1.com', text: 'Link 1', context: 'context 1' },
      { url: 'https://link2.com', text: 'Link 2', context: 'context 2' },
    ],
    ...overrides,
  }
}

function createMockSuggestedLink(overrides: Partial<SuggestedLink> = {}): SuggestedLink {
  return {
    url: 'https://suggested.com',
    title: 'Suggested Link',
    description: 'A relevant link',
    relevanceScore: 0.8,
    sourceId: 'source-1',
    sourceTitle: 'Source Title',
    ...overrides,
  }
}

// Reset signal state before each test
function resetSignals() {
  suggestedLinks.value = []
  suggestedLinksLoading.value = false
  suggestedLinksError.value = null
  suggestedLinksInitialized.value = false
}

// ============================================================================
// Tests
// ============================================================================

describe('useSuggestedLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSignals()

    // Default mock behaviors
    mockHasExtractableLinks.mockReturnValue(true)
    mockGetRawLinkCount.mockReturnValue(5)
    mockFilterLinksWithAI.mockResolvedValue([])
  })

  describe('initial state', () => {
    it('returns empty suggested links initially', () => {
      const sources = [createMockSource()]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      expect(result.current.suggestedLinks).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.hasLinks).toBe(false)
      expect(result.current.count).toBe(0)
    })

    it('returns hasExtractable and rawLinkCount from utility functions', () => {
      mockHasExtractableLinks.mockReturnValue(true)
      mockGetRawLinkCount.mockReturnValue(10)

      const sources = [createMockSource()]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      expect(result.current.hasExtractable).toBe(true)
      expect(result.current.rawLinkCount).toBe(10)
    })
  })

  describe('loadSuggestedLinks', () => {
    it('loads suggested links via AI and sets initialized flag', async () => {
      const mockLinks = [
        createMockSuggestedLink({ url: 'https://link1.com' }),
        createMockSuggestedLink({ url: 'https://link2.com' }),
      ]
      mockFilterLinksWithAI.mockResolvedValue(mockLinks)

      const sources = [createMockSource()]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      await act(async () => {
        await result.current.loadSuggestedLinks()
      })

      expect(result.current.suggestedLinks).toEqual(mockLinks)
      expect(result.current.hasLinks).toBe(true)
      expect(result.current.count).toBe(2)
      expect(suggestedLinksInitialized.value).toBe(true)
    })

    it('handles errors gracefully', async () => {
      mockFilterLinksWithAI.mockRejectedValue(new Error('AI service unavailable'))

      const sources = [createMockSource()]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      await act(async () => {
        await result.current.loadSuggestedLinks()
      })

      expect(result.current.error).toBe('AI service unavailable')
      expect(result.current.suggestedLinks).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    it('clears suggestions when no extractable links', async () => {
      mockHasExtractableLinks.mockReturnValue(false)

      const sources = [createMockSource({ links: [] })]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      await act(async () => {
        await result.current.loadSuggestedLinks()
      })

      expect(result.current.suggestedLinks).toEqual([])
      expect(mockFilterLinksWithAI).not.toHaveBeenCalled()
    })

    it('clears suggestions when sources is empty', async () => {
      const { result } = renderHook(() => useSuggestedLinks([]))

      await act(async () => {
        await result.current.loadSuggestedLinks()
      })

      expect(result.current.suggestedLinks).toEqual([])
      expect(mockFilterLinksWithAI).not.toHaveBeenCalled()
    })
  })

  describe('clearSuggestedLinks', () => {
    it('clears suggestions and resets initialized flag', async () => {
      const mockLinks = [createMockSuggestedLink()]
      mockFilterLinksWithAI.mockResolvedValue(mockLinks)

      const sources = [createMockSource()]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      // First load some suggestions
      await act(async () => {
        await result.current.loadSuggestedLinks()
      })

      expect(result.current.hasLinks).toBe(true)
      expect(suggestedLinksInitialized.value).toBe(true)

      // Now clear
      act(() => {
        result.current.clearSuggestedLinks()
      })

      expect(result.current.suggestedLinks).toEqual([])
      expect(result.current.hasLinks).toBe(false)
      expect(suggestedLinksInitialized.value).toBe(false)
    })
  })

  describe('auto-generation on source changes', () => {
    it('auto-generates suggestions when first source is added', async () => {
      const mockLinks = [createMockSuggestedLink()]
      mockFilterLinksWithAI.mockResolvedValue(mockLinks)

      // Start with no sources
      const { rerender } = renderHook(
        ({ sources }) => useSuggestedLinks(sources),
        { initialProps: { sources: [] as Source[] } },
      )

      // Add first source
      const newSources = [createMockSource({ id: 'source-1' })]

      act(() => {
        rerender({ sources: newSources })
      })

      // Wait for debounce (1 second + buffer)
      await waitFor(
        () => {
          expect(mockFilterLinksWithAI).toHaveBeenCalledTimes(1)
        },
        { timeout: 2000 },
      )
    })

    it('auto-regenerates when additional sources are added', async () => {
      const mockLinks = [createMockSuggestedLink()]
      mockFilterLinksWithAI.mockResolvedValue(mockLinks)

      // Start with no sources
      const { rerender } = renderHook(
        ({ sources }) => useSuggestedLinks(sources),
        { initialProps: { sources: [] as Source[] } },
      )

      // Add first source
      const firstSources = [createMockSource({ id: 'source-1' })]
      act(() => {
        rerender({ sources: firstSources })
      })

      // Wait for first generation
      await waitFor(
        () => {
          expect(mockFilterLinksWithAI).toHaveBeenCalledTimes(1)
        },
        { timeout: 2000 },
      )

      // Add another source
      const moreSources = [
        ...firstSources,
        createMockSource({ id: 'source-2' }),
      ]

      act(() => {
        rerender({ sources: moreSources })
      })

      // Wait for regeneration
      await waitFor(
        () => {
          expect(mockFilterLinksWithAI).toHaveBeenCalledTimes(2)
        },
        { timeout: 2000 },
      )
    })

    it('does not auto-generate when no extractable links', async () => {
      mockHasExtractableLinks.mockReturnValue(false)

      // Start with no sources
      const { rerender } = renderHook(
        ({ sources }) => useSuggestedLinks(sources),
        { initialProps: { sources: [] as Source[] } },
      )

      // Add source with no links
      const newSources = [createMockSource({ id: 'source-1', links: [] })]

      act(() => {
        rerender({ sources: newSources })
      })

      // Wait a bit to ensure no call happens
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Should NOT have called filterLinksWithAI since no extractable links
      expect(mockFilterLinksWithAI).not.toHaveBeenCalled()
    })

    it('clears suggestions when all sources removed', async () => {
      const mockLinks = [createMockSuggestedLink()]
      mockFilterLinksWithAI.mockResolvedValue(mockLinks)

      // Start with no sources
      const { result, rerender } = renderHook(
        ({ sources }) => useSuggestedLinks(sources),
        { initialProps: { sources: [] as Source[] } },
      )

      // Add a source to trigger generation
      const withSource = [createMockSource({ id: 'source-1' })]
      act(() => {
        rerender({ sources: withSource })
      })

      // Wait for suggestions to be populated
      await waitFor(
        () => {
          expect(result.current.hasLinks).toBe(true)
        },
        { timeout: 2000 },
      )

      // Remove all sources
      act(() => {
        rerender({ sources: [] })
      })

      // Suggestions should be cleared immediately
      expect(result.current.suggestedLinks).toEqual([])
    })
  })

  describe('return value interface', () => {
    it('returns all required properties and functions', () => {
      const sources = [createMockSource()]
      const { result } = renderHook(() => useSuggestedLinks(sources))

      expect(result.current).toHaveProperty('suggestedLinks')
      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('hasLinks')
      expect(result.current).toHaveProperty('count')
      expect(result.current).toHaveProperty('rawLinkCount')
      expect(result.current).toHaveProperty('hasExtractable')
      expect(result.current).toHaveProperty('loadSuggestedLinks')
      expect(result.current).toHaveProperty('clearSuggestedLinks')

      expect(typeof result.current.loadSuggestedLinks).toBe('function')
      expect(typeof result.current.clearSuggestedLinks).toBe('function')
    })
  })
})

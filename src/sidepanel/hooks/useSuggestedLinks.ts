/**
 * useSuggestedLinks Hook
 *
 * Manages AI-suggested links from current sources.
 * Extracts links from sources and uses AI to filter/rank them.
 */

import { signal, computed } from '@preact/signals'
import { useCallback, useEffect } from 'preact/hooks'
import type { Source, SuggestedLink } from '../../types/index.ts'
import {
  filterLinksWithAI,
  hasExtractableLinks,
  getRawLinkCount,
} from '../../lib/suggested-links.ts'

// Signals for global state
export const suggestedLinks = signal<SuggestedLink[]>([])
export const suggestedLinksLoading = signal<boolean>(false)
export const suggestedLinksError = signal<string | null>(null)

// Computed values
export const hasSuggestedLinks = computed(() => suggestedLinks.value.length > 0)
export const suggestedLinksCount = computed(() => suggestedLinks.value.length)

export interface UseSuggestedLinksReturn {
  suggestedLinks: SuggestedLink[]
  loading: boolean
  error: string | null
  hasLinks: boolean
  count: number
  rawLinkCount: number
  hasExtractable: boolean
  loadSuggestedLinks: () => Promise<void>
  clearSuggestedLinks: () => void
}

export function useSuggestedLinks(sources: Source[]): UseSuggestedLinksReturn {
  // Check if there are extractable links in sources
  const hasExtractable = hasExtractableLinks(sources)
  const rawLinkCount = getRawLinkCount(sources)

  // Load suggested links using AI
  const loadSuggestedLinks = useCallback(async () => {
    if (!hasExtractable || sources.length === 0) {
      suggestedLinks.value = []
      return
    }

    suggestedLinksLoading.value = true
    suggestedLinksError.value = null

    try {
      const links = await filterLinksWithAI(sources, 10)
      suggestedLinks.value = links
    }
    catch (error) {
      console.error('[useSuggestedLinks] Failed to load suggested links:', error)
      suggestedLinksError.value = error instanceof Error ? error.message : 'Failed to load suggested links'
      suggestedLinks.value = []
    }
    finally {
      suggestedLinksLoading.value = false
    }
  }, [sources, hasExtractable])

  // Clear suggested links
  const clearSuggestedLinks = useCallback(() => {
    suggestedLinks.value = []
    suggestedLinksError.value = null
  }, [])

  // Clear when sources change significantly
  useEffect(() => {
    // Clear suggestions when sources change - they'll need to be refreshed
    suggestedLinks.value = []
    suggestedLinksError.value = null
  }, [sources.length])

  return {
    suggestedLinks: suggestedLinks.value,
    loading: suggestedLinksLoading.value,
    error: suggestedLinksError.value,
    hasLinks: hasSuggestedLinks.value,
    count: suggestedLinksCount.value,
    rawLinkCount,
    hasExtractable,
    loadSuggestedLinks,
    clearSuggestedLinks,
  }
}

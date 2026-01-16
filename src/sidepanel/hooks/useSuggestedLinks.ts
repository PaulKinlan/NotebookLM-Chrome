/**
 * useSuggestedLinks Hook
 *
 * Manages AI-suggested links from current sources.
 * Extracts links from sources and uses AI to filter/rank them.
 */

import { signal, computed } from '@preact/signals'
import { useCallback, useEffect, useRef } from 'preact/hooks'
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
// Track whether suggestions have been loaded at least once (for auto-regeneration)
export const suggestedLinksInitialized = signal<boolean>(false)

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
      // Mark as initialized so future source changes trigger auto-regeneration
      suggestedLinksInitialized.value = true
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
    suggestedLinksInitialized.value = false
  }, [])

  // Track previous sources length to detect changes
  const prevSourcesLengthRef = useRef(sources.length)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-generate when sources change (debounced to handle rapid additions)
  useEffect(() => {
    const prevLength = prevSourcesLengthRef.current
    prevSourcesLengthRef.current = sources.length

    // Skip if sources length hasn't actually changed
    if (prevLength === sources.length) {
      return
    }

    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Auto-generate with debounce when there are sources
    if (sources.length > 0 && hasExtractable) {
      // Debounce to handle rapid source additions (e.g., adding multiple bookmarks)
      debounceTimerRef.current = setTimeout(() => {
        void loadSuggestedLinks()
        debounceTimerRef.current = null
      }, 1000) // 1 second debounce
    }
    else {
      // Clear if no sources or no extractable links
      suggestedLinks.value = []
      suggestedLinksError.value = null
    }

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [sources.length, loadSuggestedLinks, hasExtractable])

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

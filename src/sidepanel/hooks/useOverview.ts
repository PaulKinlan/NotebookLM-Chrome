/**
 * useOverview Hook
 *
 * Manages the notebook overview/summary - loading cached summaries
 * and generating new ones when sources change.
 */

import { useCallback, useEffect, useRef } from 'preact/hooks'
import type { Source } from '../../types/index.ts'
import { getSummary, saveSummary, createSummary } from '../../lib/storage'
import { generateSummary } from '../../lib/ai'
import { summaryContent, showSummary } from '../store'
import { renderMarkdown } from '../../lib/markdown-renderer'

export interface UseOverviewReturn {
  /** Load or generate overview for current sources */
  loadOverview: () => Promise<void>
  /** Regenerate overview (force new generation) */
  regenerateOverview: () => Promise<void>
}

/**
 * Check if two arrays of source IDs match (same items, possibly different order)
 */
function sourceIdsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((id, i) => id === sortedB[i])
}

/**
 * Hook for managing notebook overview/summary
 */
export function useOverview(notebookId: string | null, sources: Source[]): UseOverviewReturn {
  // Track the last processed source IDs to avoid unnecessary regeneration
  const lastSourceIdsRef = useRef<string[]>([])
  const isGeneratingRef = useRef(false)

  const generateAndSave = useCallback(async (sourceIds: string[]) => {
    if (!notebookId || isGeneratingRef.current) return

    isGeneratingRef.current = true

    // Show loading state
    showSummary.value = true
    summaryContent.value = null

    try {
      const content = await generateSummary(sources)

      // Save the summary
      const summary = createSummary(notebookId, sourceIds, content)
      await saveSummary(summary)

      // Render and display
      const rendered = renderMarkdown(content)
      summaryContent.value = rendered
    }
    catch (error) {
      console.error('[useOverview] Failed to generate summary:', error)
      const message = error instanceof Error ? error.message : 'Failed to generate overview'
      summaryContent.value = `<div class="summary-error">${message}</div>`
    }
    finally {
      isGeneratingRef.current = false
    }
  }, [notebookId, sources])

  const loadOverview = useCallback(async () => {
    if (!notebookId) {
      showSummary.value = false
      summaryContent.value = null
      return
    }

    // Hide if no sources
    if (sources.length === 0) {
      showSummary.value = false
      summaryContent.value = null
      return
    }

    const sourceIds = sources.map(s => s.id)

    // Check if we have a cached summary with matching source IDs
    try {
      const cachedSummary = await getSummary(notebookId)

      if (cachedSummary && sourceIdsMatch(cachedSummary.sourceIds, sourceIds)) {
        // Use cached summary
        const rendered = renderMarkdown(cachedSummary.content)
        summaryContent.value = rendered
        showSummary.value = true
        lastSourceIdsRef.current = sourceIds
        return
      }

      // Generate new summary
      lastSourceIdsRef.current = sourceIds
      await generateAndSave(sourceIds)
    }
    catch (error) {
      console.error('[useOverview] Failed to load overview:', error)
    }
  }, [notebookId, sources, generateAndSave])

  const regenerateOverview = useCallback(async () => {
    if (!notebookId || sources.length === 0) {
      return
    }

    const sourceIds = sources.map(s => s.id)
    await generateAndSave(sourceIds)
  }, [notebookId, sources, generateAndSave])

  // Load overview on mount and when notebook/sources change
  useEffect(() => {
    const sourceIds = sources.map(s => s.id)

    // Only load if sources actually changed
    if (!sourceIdsMatch(lastSourceIdsRef.current, sourceIds)) {
      void loadOverview()
    }
  }, [notebookId, sources, loadOverview])

  return {
    loadOverview,
    regenerateOverview,
  }
}

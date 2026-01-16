/**
 * useTransform Hook
 *
 * Manages content transformation operations including:
 * - Running transformations on sources
 * - Managing transform history
 * - Saving/loading transformations
 * - Opening transformations in new tabs
 */

import { useCallback, useEffect } from 'preact/hooks'
import DOMPurify from 'dompurify'
import type { Source, TransformationType } from '../../types/index.ts'
import {
  generatePodcastScript,
  generateQuiz,
  generateKeyTakeaways,
  generateEmailSummary,
  generateSlideDeck,
  generateReport,
  generateDataTable,
  generateMindMap,
  generateFlashcards,
  generateTimeline,
  generateGlossary,
  generateComparison,
  generateFAQ,
  generateActionItems,
  generateExecutiveBrief,
  generateStudyGuide,
  generateProsCons,
  generateCitationList,
  generateOutline,
} from '../../lib/ai.ts'
import {
  saveTransformation,
  deleteTransformation,
  createTransformation,
  getTransformations,
} from '../../lib/storage.ts'
import { renderMarkdown, isHtmlContent } from '../../lib/markdown-renderer.ts'
import { escapeHtml } from '../dom-utils.ts'
import { transformHistory, transforming } from '../store'

// Maximum number of transform cards to keep in history
const MAX_TRANSFORM_HISTORY = 10

// Transform type titles for display
const TRANSFORM_TITLES: Record<TransformationType, string> = {
  podcast: 'Podcast Script',
  quiz: 'Study Quiz',
  takeaways: 'Key Takeaways',
  email: 'Email Summary',
  slidedeck: 'Slide Deck',
  report: 'Report',
  datatable: 'Data Table',
  mindmap: 'Mind Map',
  flashcards: 'Flashcards',
  timeline: 'Timeline',
  glossary: 'Glossary',
  comparison: 'Comparison',
  faq: 'FAQ',
  actionitems: 'Action Items',
  executivebrief: 'Executive Brief',
  studyguide: 'Study Guide',
  proscons: 'Pros and Cons',
  citations: 'Citation List',
  outline: 'Outline',
}

// Interactive transform types that return HTML content
const INTERACTIVE_TYPES: Set<TransformationType> = new Set([
  'quiz',
  'flashcards',
  'timeline',
  'mindmap',
  'slidedeck',
  'studyguide',
])

/**
 * Metadata for a transform result card
 */
export interface TransformResult {
  /** Unique ID for this result (generated on creation) */
  id: string
  /** Title of the transform */
  title: string
  /** Transform type */
  type: TransformationType
  /** Generated content */
  content: string
  /** Whether content is interactive HTML */
  isInteractive: boolean
  /** Source IDs used for this transform */
  sourceIds: string[]
  /** Notebook ID */
  notebookId: string
  /** Timestamp when created */
  timestamp: number
  /** Saved transformation ID (null if not saved) */
  savedId: string | null
}

export interface UseTransformReturn {
  /** Whether a transform is in progress */
  isTransforming: boolean
  /** Transform history (newest first) */
  history: TransformResult[]
  /** Run a transformation */
  transform: (type: TransformationType, sources: Source[], notebookId: string) => Promise<void>
  /** Remove a transform from history */
  removeResult: (id: string) => void
  /** Clear all transform history */
  clearHistory: () => void
  /** Save a transform result */
  saveResult: (result: TransformResult) => Promise<void>
  /** Delete a saved transform */
  deleteResult: (result: TransformResult) => Promise<void>
  /** Open a transform in a new tab */
  openInNewTab: (result: TransformResult) => void
  /** Reload transform history from storage */
  reloadHistory: () => Promise<void>
}

/**
 * Generate a full HTML page for viewing markdown transforms
 */
function generateFullPageHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - FolioLM</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e4e4e7;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 24px 0;
      font-size: 28px;
      color: #fff;
      border-bottom: 1px solid #3f3f5a;
      padding-bottom: 12px;
    }
    .content {
      background: #252538;
      border-radius: 12px;
      padding: 32px;
    }
    .content h1, .content h2, .content h3, .content h4 {
      color: #fff;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .content h1:first-child, .content h2:first-child {
      margin-top: 0;
    }
    .content p {
      margin: 0 0 16px 0;
    }
    .content ul, .content ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
    }
    .content code {
      background: #1a1a2e;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    .content pre {
      background: #1a1a2e;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .content pre code {
      background: none;
      padding: 0;
    }
    .content blockquote {
      border-left: 3px solid #8b5cf6;
      margin: 0 0 16px 0;
      padding-left: 16px;
      color: #a1a1aa;
    }
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .content th, .content td {
      border: 1px solid #3f3f5a;
      padding: 12px;
      text-align: left;
    }
    .content th {
      background: #1a1a2e;
    }
    .content a {
      color: #8b5cf6;
    }
    @media print {
      body { background: white; color: black; }
      .container { max-width: 100%; }
      .content { background: white; border: 1px solid #ccc; }
      .content h1, .content h2, .content h3, .content h4 { color: black; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <div class="content">
      ${content}
    </div>
  </div>
</body>
</html>`
}

/**
 * Hook for managing content transformations
 */
export function useTransform(notebookId: string | null = null): UseTransformReturn {
  // Load transform history when notebook changes
  useEffect(() => {
    if (notebookId) {
      void loadHistory()
    }
    else {
      transformHistory.value = []
    }
  }, [notebookId])

  const loadHistory = useCallback(async () => {
    if (!notebookId) {
      transformHistory.value = []
      return
    }

    const transformations = await getTransformations(notebookId)

    // Convert stored transformations to TransformResult format
    const results: TransformResult[] = transformations.map((t) => {
      // Determine if this is interactive content
      const isInteractive = INTERACTIVE_TYPES.has(t.type) && isHtmlContent(t.content)

      return {
        id: t.id,
        title: t.title,
        type: t.type,
        content: t.content,
        isInteractive,
        sourceIds: t.sourceIds,
        notebookId: t.notebookId,
        timestamp: t.createdAt,
        savedId: t.id, // Already saved, so savedId = id
      }
    })

    transformHistory.value = results
  }, [notebookId])

  const transform = useCallback(async (
    type: TransformationType,
    sources: Source[],
    nbId: string,
  ) => {
    if (sources.length === 0) {
      console.warn('[useTransform] No sources to transform')
      return
    }

    transforming.value = true
    try {
      let output = ''

      // Map transform types to their generator functions
      const transformers: Record<TransformationType, () => Promise<string>> = {
        podcast: () => generatePodcastScript(sources),
        quiz: () => generateQuiz(sources),
        takeaways: () => generateKeyTakeaways(sources),
        email: () => generateEmailSummary(sources),
        slidedeck: () => generateSlideDeck(sources),
        report: () => generateReport(sources),
        datatable: () => generateDataTable(sources),
        mindmap: () => generateMindMap(sources),
        flashcards: () => generateFlashcards(sources),
        timeline: () => generateTimeline(sources),
        glossary: () => generateGlossary(sources),
        comparison: () => generateComparison(sources),
        faq: () => generateFAQ(sources),
        actionitems: () => generateActionItems(sources),
        executivebrief: () => generateExecutiveBrief(sources),
        studyguide: () => generateStudyGuide(sources),
        proscons: () => generateProsCons(sources),
        citations: () => generateCitationList(sources),
        outline: () => generateOutline(sources),
      }

      if (!transformers[type]) {
        console.error('[useTransform] Unknown transform type:', type)
        return
      }

      output = await transformers[type]()

      // Determine if this is an interactive transform
      const isInteractive = INTERACTIVE_TYPES.has(type) && isHtmlContent(output)

      // Create result object
      const result: TransformResult = {
        id: crypto.randomUUID(),
        title: TRANSFORM_TITLES[type],
        type,
        content: output,
        isInteractive,
        sourceIds: sources.map(s => s.id),
        notebookId: nbId,
        timestamp: Date.now(),
        savedId: null,
      }

      // Add to history (newest first, enforce limit)
      const newHistory = [result, ...transformHistory.value]
      transformHistory.value = newHistory.slice(0, MAX_TRANSFORM_HISTORY)
    }
    finally {
      transforming.value = false
    }
  }, [])

  const removeResult = useCallback((id: string) => {
    transformHistory.value = transformHistory.value.filter((r: TransformResult) => r.id !== id)
  }, [])

  const clearHistory = useCallback(() => {
    transformHistory.value = []
  }, [])

  const saveResult = useCallback(async (result: TransformResult) => {
    if (result.savedId) {
      console.warn('[useTransform] Result already saved')
      return
    }

    const transformation = createTransformation(
      result.notebookId,
      result.type,
      result.title,
      result.content,
      result.sourceIds,
    )

    await saveTransformation(transformation)

    // Update the result with its saved ID
    transformHistory.value = transformHistory.value.map((r: TransformResult) =>
      r.id === result.id ? { ...r, savedId: transformation.id } : r,
    )
  }, [])

  const deleteResult = useCallback(async (result: TransformResult) => {
    if (result.savedId) {
      await deleteTransformation(result.savedId)
    }
    // Remove from history regardless of whether it was saved
    removeResult(result.id)
  }, [removeResult])

  const openInNewTab = useCallback((result: TransformResult) => {
    // For interactive content, use chrome.tabs message passing:
    // - Open fullscreen-wrapper.html via chrome.tabs.create() to get tab ID
    // - Send content via chrome.tabs.sendMessage() once the tab loads
    // - The wrapper renders content in a sandboxed iframe using blob URLs
    //
    // For non-interactive (markdown) content, we can use a blob URL since it doesn't need inline scripts.

    if (result.isInteractive) {
      // Open the wrapper page
      const wrapperUrl = chrome.runtime.getURL('src/sandbox/fullscreen-wrapper.html')

      chrome.tabs.create({ url: wrapperUrl }, (tab) => {
        if (!tab?.id) {
          return
        }

        const tabId = tab.id

        // Wait for the tab to finish loading before sending content
        const listener = (
          updatedTabId: number,
          changeInfo: { status?: string },
        ) => {
          if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
            return
          }

          // Tab is ready, send content via chrome.tabs.sendMessage
          void chrome.tabs.sendMessage(tabId, {
            type: 'FULLSCREEN_CONTENT',
            title: result.title,
            content: result.content,
            isInteractive: true,
          })

          // Clean up listener
          chrome.tabs.onUpdated.removeListener(listener)
        }

        chrome.tabs.onUpdated.addListener(listener)

        // Fallback: clean up listener after 30 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener)
        }, 30000)
      })
    }
    else {
      // For markdown content, sanitize with DOMPurify before insertion
      const renderedContent = renderMarkdown(result.content)
      const sanitizedContent = DOMPurify.sanitize(renderedContent, {
        USE_PROFILES: { html: true },
      })
      let fullHtml = generateFullPageHtml(result.title, sanitizedContent)

      // Sanitize the entire document
      fullHtml = DOMPurify.sanitize(fullHtml, {
        WHOLE_DOCUMENT: true,
        USE_PROFILES: { html: true },
      })

      const blob = new Blob([fullHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      chrome.tabs.create({ url }, (tab) => {
        // Clean up blob URL when tab finishes loading (not a fixed timeout)
        if (!tab?.id) {
          URL.revokeObjectURL(url)
          return
        }

        const tabId = tab.id
        const listener = (
          updatedTabId: number,
          changeInfo: { status?: string },
        ) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            URL.revokeObjectURL(url)
            chrome.tabs.onUpdated.removeListener(listener)
          }
        }

        chrome.tabs.onUpdated.addListener(listener)

        // Fallback cleanup after 30 seconds in case onUpdated never fires
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener)
          URL.revokeObjectURL(url)
        }, 30000)
      })
    }
  }, [])

  const reloadHistory = useCallback(async () => {
    await loadHistory()
  }, [loadHistory])

  return {
    isTransforming: transforming.value,
    history: transformHistory.value,
    transform,
    removeResult,
    clearHistory,
    saveResult,
    deleteResult,
    openInNewTab,
    reloadHistory,
  }
}

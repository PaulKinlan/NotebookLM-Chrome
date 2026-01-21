/**
 * useTransform Hook
 *
 * Manages content transformation operations including:
 * - Running transformations on sources (via background service worker)
 * - Managing transform history
 * - Saving/loading transformations
 * - Opening transformations in new tabs
 *
 * Transformations now run in the background service worker, allowing them
 * to continue even when the side panel is closed.
 */

import { useCallback, useEffect } from 'preact/hooks'
import DOMPurify from 'dompurify'
import type { Source, TransformationType, BackgroundTransform, Message } from '../../types/index.ts'
import {
  saveTransformation,
  deleteTransformation,
  createTransformation,
  getTransformations,
  deleteBackgroundTransform,
} from '../../lib/storage.ts'
import { renderMarkdown, isHtmlContent } from '../../lib/markdown-renderer.ts'
import { escapeHtml } from '../dom-utils.ts'
import { transformHistory, pendingTransforms } from '../store'
import type { PendingTransform } from '../store'

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
  /** Whether any transform is in progress */
  isTransforming: boolean
  /** Pending transforms currently being generated */
  pending: PendingTransform[]
  /** Transform history (newest first) */
  history: TransformResult[]
  /** Run a transformation (can be called multiple times concurrently) */
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
  /** Sync pending transforms from background */
  syncPendingTransforms: () => Promise<void>
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
 * Convert a BackgroundTransform to a PendingTransform for UI display
 */
function backgroundToPending(bg: BackgroundTransform): PendingTransform {
  return {
    id: bg.id,
    type: bg.type,
    notebookId: bg.notebookId,
    sourceIds: bg.sourceIds,
    startTime: bg.startedAt ?? bg.createdAt,
  }
}

/**
 * Convert a completed BackgroundTransform to a TransformResult
 */
function backgroundToResult(bg: BackgroundTransform): TransformResult | null {
  if (!bg.content || bg.status !== 'completed') {
    return null
  }

  const isInteractive = INTERACTIVE_TYPES.has(bg.type) && isHtmlContent(bg.content)

  return {
    id: bg.id,
    title: TRANSFORM_TITLES[bg.type],
    type: bg.type,
    content: bg.content,
    isInteractive,
    sourceIds: bg.sourceIds,
    notebookId: bg.notebookId,
    timestamp: bg.completedAt ?? Date.now(),
    savedId: null,
  }
}

/**
 * Type guard for BackgroundTransform
 */
function isBackgroundTransform(value: unknown): value is BackgroundTransform {
  return (
    typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'type' in value
    && 'status' in value
    && 'notebookId' in value
  )
}

/**
 * Response type for GET_PENDING_TRANSFORMS message
 */
interface GetPendingTransformsResponse {
  transforms: BackgroundTransform[]
}

/**
 * Type guard for GetPendingTransformsResponse
 */
function isGetPendingTransformsResponse(value: unknown): value is GetPendingTransformsResponse {
  return (
    typeof value === 'object'
    && value !== null
    && 'transforms' in value
    && Array.isArray((value as GetPendingTransformsResponse).transforms)
  )
}

/**
 * Response type for START_TRANSFORM message
 */
interface StartTransformResponse {
  success: boolean
  transformId?: string
  error?: string
}

/**
 * Type guard for StartTransformResponse
 */
function isStartTransformResponse(value: unknown): value is StartTransformResponse {
  return (
    typeof value === 'object'
    && value !== null
    && 'success' in value
    && typeof (value as StartTransformResponse).success === 'boolean'
  )
}

/**
 * Hook for managing content transformations
 */
export function useTransform(notebookId: string | null = null): UseTransformReturn {
  // Load transform history and sync pending transforms when notebook changes
  useEffect(() => {
    if (notebookId) {
      void loadHistory()
      void syncPendingTransforms()
    }
    else {
      transformHistory.value = []
      pendingTransforms.value = []
    }
  }, [notebookId])

  // Set up message listener for transform events from background
  useEffect(() => {
    const handleMessage = (message: Message) => {
      if (!message.type || !message.payload) return

      // Only handle transform messages for the current notebook
      if (!isBackgroundTransform(message.payload)) return
      const bg = message.payload
      if (bg.notebookId !== notebookId) return

      switch (message.type) {
        case 'TRANSFORM_STARTED':
        case 'TRANSFORM_PROGRESS': {
          // Update pending transforms
          const pending = backgroundToPending(bg)
          const existing = pendingTransforms.value.find(p => p.id === bg.id)
          if (!existing) {
            pendingTransforms.value = [...pendingTransforms.value, pending]
          }
          break
        }
        case 'TRANSFORM_COMPLETE': {
          // Remove from pending
          pendingTransforms.value = pendingTransforms.value.filter(p => p.id !== bg.id)

          // Add to history if completed successfully
          if (bg.status === 'completed') {
            const result = backgroundToResult(bg)
            if (result) {
              // Check if already in history (by id)
              const exists = transformHistory.value.some(r => r.id === result.id)
              if (!exists) {
                const newHistory = [result, ...transformHistory.value]
                transformHistory.value = newHistory.slice(0, MAX_TRANSFORM_HISTORY)
              }
            }

            // Clean up the background transform record after adding to history
            void deleteBackgroundTransform(bg.id)
          }
          break
        }
        case 'TRANSFORM_ERROR': {
          // Remove from pending
          pendingTransforms.value = pendingTransforms.value.filter(p => p.id !== bg.id)
          console.error('[useTransform] Transform failed:', bg.error)
          break
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
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

  /**
   * Sync pending transforms from the background service worker.
   * Called when the side panel opens to restore any in-progress transforms.
   */
  const syncPendingTransforms = useCallback(async () => {
    if (!notebookId) {
      pendingTransforms.value = []
      return
    }

    try {
      const response: unknown = await chrome.runtime.sendMessage({
        type: 'GET_PENDING_TRANSFORMS',
        payload: { notebookId },
      })

      if (isGetPendingTransformsResponse(response)) {
        // Separate pending/running from completed
        const pending: PendingTransform[] = []
        const completed: TransformResult[] = []

        for (const bg of response.transforms) {
          if (bg.status === 'pending' || bg.status === 'running') {
            pending.push(backgroundToPending(bg))
          }
          else if (bg.status === 'completed' && bg.content) {
            const result = backgroundToResult(bg)
            if (result) {
              completed.push(result)
              // Clean up the background transform record
              void deleteBackgroundTransform(bg.id)
            }
          }
        }

        // Update pending transforms
        pendingTransforms.value = pending

        // Add completed transforms to history (if not already there)
        if (completed.length > 0) {
          const existingIds = new Set(transformHistory.value.map(r => r.id))
          const newResults = completed.filter(r => !existingIds.has(r.id))
          if (newResults.length > 0) {
            const newHistory = [...newResults, ...transformHistory.value]
            transformHistory.value = newHistory.slice(0, MAX_TRANSFORM_HISTORY)
          }
        }
      }
    }
    catch (error) {
      console.error('[useTransform] Failed to sync pending transforms:', error)
    }
  }, [notebookId])

  /**
   * Start a transformation via the background service worker.
   * The transform will continue running even if the side panel is closed.
   */
  const transform = useCallback(async (
    type: TransformationType,
    sources: Source[],
    nbId: string,
  ) => {
    if (sources.length === 0) {
      console.warn('[useTransform] No sources to transform')
      return
    }

    try {
      // Send message to background to start the transform
      const response: unknown = await chrome.runtime.sendMessage({
        type: 'START_TRANSFORM',
        payload: {
          notebookId: nbId,
          type,
          sourceIds: sources.map(s => s.id),
        },
      })

      if (!isStartTransformResponse(response) || !response.success) {
        const errorMsg = isStartTransformResponse(response) ? response.error : 'Invalid response'
        console.error('[useTransform] Failed to start transform:', errorMsg)
        return
      }

      // Add to pending immediately (the message listener will update as it progresses)
      const pending: PendingTransform = {
        id: response.transformId ?? crypto.randomUUID(),
        type,
        notebookId: nbId,
        sourceIds: sources.map(s => s.id),
        startTime: Date.now(),
      }

      pendingTransforms.value = [...pendingTransforms.value, pending]
    }
    catch (error) {
      console.error('[useTransform] Error starting transform:', error)
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
    isTransforming: pendingTransforms.value.length > 0,
    pending: pendingTransforms.value,
    history: transformHistory.value,
    transform,
    removeResult,
    clearHistory,
    saveResult,
    deleteResult,
    openInNewTab,
    reloadHistory,
    syncPendingTransforms,
  }
}

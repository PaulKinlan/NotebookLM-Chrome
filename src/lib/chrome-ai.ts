/**
 * Chrome Built-in AI Model Utilities
 *
 * Provides utilities for checking Chrome's on-device AI model availability
 * and triggering the download. The model download requires a user gesture.
 *
 * @see https://developer.chrome.com/docs/ai/prompt-api
 * @see https://developer.chrome.com/docs/ai/inform-users-of-model-download
 */

// ============================================================================
// Type Definitions for Chrome LanguageModel API
// ============================================================================

/**
 * Model availability status returned by LanguageModel.availability()
 */
export type ModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

/**
 * Download progress event from LanguageModel.create() monitor
 */
export interface DownloadProgressEvent {
  loaded: number // Progress from 0 to 1
}

/**
 * Download monitor for tracking model download progress
 */
export interface DownloadMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: DownloadProgressEvent) => void,
  ): void
}

/**
 * Options for creating a LanguageModel session
 */
export interface LanguageModelCreateOptions {
  monitor?: (monitor: DownloadMonitor) => void
  systemPrompt?: string
  temperature?: number
  topK?: number
}

/**
 * LanguageModel session interface (simplified for download purposes)
 */
export interface LanguageModelSession {
  prompt(input: string): Promise<string>
  promptStreaming(input: string): ReadableStream<string>
  destroy(): void
}

/**
 * Chrome's global LanguageModel API
 */
export interface LanguageModelAPI {
  availability(): Promise<ModelAvailability>
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>
}

// ============================================================================
// Global API Access
// ============================================================================

/**
 * Get the LanguageModel API from the global scope if available.
 * Returns undefined if Chrome's built-in AI is not supported.
 */
function getLanguageModelAPI(): LanguageModelAPI | undefined {
  // Chrome's Prompt API exposes LanguageModel as a global
  // We check for it on globalThis to access it in a type-safe way
  const global = globalThis as unknown as Record<string, unknown>
  if (typeof global.LanguageModel !== 'undefined') {
    return global.LanguageModel as LanguageModelAPI
  }
  return undefined
}

// ============================================================================
// Model Availability and Download Functions
// ============================================================================

/**
 * Check if Chrome's built-in AI is supported in this browser
 */
export function isBuiltInAISupported(): boolean {
  return getLanguageModelAPI() !== undefined
}

/**
 * Check the availability status of Chrome's built-in AI model
 *
 * @returns The model availability status, or 'unavailable' if API not supported
 */
export async function checkModelAvailability(): Promise<ModelAvailability> {
  const api = getLanguageModelAPI()
  if (!api) {
    return 'unavailable'
  }

  try {
    return await api.availability()
  }
  catch (error) {
    console.warn('[ChromeAI] Failed to check model availability:', error)
    return 'unavailable'
  }
}

/**
 * Callback for download progress updates
 */
export type DownloadProgressCallback = (progress: number) => void

/**
 * Result of attempting to start/trigger model download
 */
export interface ModelDownloadResult {
  success: boolean
  status: ModelAvailability
  error?: string
}

/**
 * Trigger the Chrome built-in AI model download.
 *
 * IMPORTANT: This function MUST be called during a user gesture (click, keypress, etc.)
 * because Chrome requires user activation to start the model download.
 *
 * This function calls api.create() immediately to preserve user activation.
 * Chrome's create() handles all states gracefully:
 * - If model is available, creates session instantly
 * - If downloadable, triggers download
 * - If downloading, waits for completion
 * - If unavailable, throws an error
 *
 * @param onProgress - Optional callback for download progress (0-1)
 * @returns Result indicating success and current status
 */
export async function triggerModelDownload(
  onProgress?: DownloadProgressCallback,
): Promise<ModelDownloadResult> {
  // Synchronous check - doesn't consume user activation
  const api = getLanguageModelAPI()
  if (!api) {
    console.log('[ChromeAI] Built-in AI not supported in this browser')
    return {
      success: false,
      status: 'unavailable',
      error: 'Chrome built-in AI is not supported in this browser',
    }
  }

  // Call create() immediately to preserve user activation
  // Do NOT await checkModelAvailability() before this - it would consume the user gesture
  console.log('[ChromeAI] Triggering model download/session creation...')

  try {
    // Create a session with download monitoring
    // This triggers the download if needed and we can track progress
    const session = await api.create({
      monitor: (monitor: DownloadMonitor) => {
        monitor.addEventListener('downloadprogress', (event: DownloadProgressEvent) => {
          const progress = event.loaded
          console.log(`[ChromeAI] Download progress: ${(progress * 100).toFixed(1)}%`)
          onProgress?.(progress)
        })
      },
    })

    // Once create() resolves, the model is ready
    // Destroy the session since we only wanted to trigger the download
    session.destroy()

    console.log('[ChromeAI] Model ready')
    return { success: true, status: 'available' }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[ChromeAI] Failed to create session/download model:', errorMessage)

    // Check status after failure to provide accurate feedback
    const currentStatus = await checkModelAvailability()

    return {
      success: false,
      status: currentStatus,
      error: `Failed to initialize model: ${errorMessage}`,
    }
  }
}

/**
 * Start model download in the background without blocking.
 *
 * This is useful for triggering the download during a user gesture
 * without waiting for it to complete. The download will continue
 * in the background.
 *
 * @param onProgress - Optional callback for download progress (0-1)
 * @param onComplete - Optional callback when download completes
 */
export function startModelDownloadAsync(
  onProgress?: DownloadProgressCallback,
  onComplete?: (result: ModelDownloadResult) => void,
): void {
  // Fire and forget - don't await
  triggerModelDownload(onProgress)
    .then((result) => {
      onComplete?.(result)
    })
    .catch((error: unknown) => {
      console.error('[ChromeAI] Async download error:', error)
      onComplete?.({
        success: false,
        status: 'unavailable',
        error: error instanceof Error ? error.message : String(error),
      })
    })
}

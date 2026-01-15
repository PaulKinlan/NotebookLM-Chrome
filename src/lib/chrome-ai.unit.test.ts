/**
 * Unit tests for chrome-ai module
 *
 * Tests the Chrome Built-in AI model utilities including:
 * - isBuiltInAISupported: Check if LanguageModel API is available
 * - checkModelAvailability: Get model availability status
 * - triggerModelDownload: Trigger model download with progress monitoring
 * - startModelDownloadAsync: Non-blocking download trigger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type {
  ModelAvailability,
  LanguageModelAPI,
  LanguageModelSession,
  DownloadMonitor,
  DownloadProgressEvent,
} from './chrome-ai.ts'

// Store original globalThis.LanguageModel
let originalLanguageModel: unknown

// Mock session that tracks destroy() calls
function createMockSession(): LanguageModelSession {
  return {
    prompt: vi.fn().mockResolvedValue('response'),
    promptStreaming: vi.fn().mockReturnValue(new ReadableStream()),
    destroy: vi.fn(),
  }
}

// Mock LanguageModel API factory
function createMockLanguageModelAPI(
  availability: ModelAvailability = 'available',
  createBehavior: 'success' | 'error' | 'progress' = 'success',
): LanguageModelAPI {
  return {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockImplementation((options?: { monitor?: (m: DownloadMonitor) => void }) => {
      if (createBehavior === 'error') {
        return Promise.reject(new Error('Model creation failed'))
      }

      if (createBehavior === 'progress' && options?.monitor) {
        // Simulate download progress
        const mockMonitor: DownloadMonitor = {
          addEventListener: (type, listener) => {
            if (type === 'downloadprogress') {
              // Simulate progress events
              setTimeout(() => {
                listener({ loaded: 0.5 } as DownloadProgressEvent)
              }, 10)
              setTimeout(() => {
                listener({ loaded: 1.0 } as DownloadProgressEvent)
              }, 20)
            }
          },
        }
        options.monitor(mockMonitor)
      }

      return Promise.resolve(createMockSession())
    }),
  }
}

// Helper to set up mock LanguageModel on globalThis
function setMockLanguageModel(api: LanguageModelAPI | undefined): void {
  const global = globalThis as unknown as Record<string, unknown>
  if (api === undefined) {
    delete global.LanguageModel
  }
  else {
    global.LanguageModel = api
  }
}

describe('chrome-ai', () => {
  // Store module reference for re-importing
  let chromeAI: typeof import('./chrome-ai.ts')

  beforeEach(async () => {
    // Store original value
    const global = globalThis as unknown as Record<string, unknown>
    originalLanguageModel = global.LanguageModel

    // Clear any existing mock
    delete global.LanguageModel

    // Reset modules and mocks
    vi.clearAllMocks()
    vi.resetModules()

    // Fresh import
    chromeAI = await import('./chrome-ai.ts')
  })

  afterEach(() => {
    // Restore original value
    const global = globalThis as unknown as Record<string, unknown>
    if (originalLanguageModel !== undefined) {
      global.LanguageModel = originalLanguageModel
    }
    else {
      delete global.LanguageModel
    }
  })

  describe('isBuiltInAISupported', () => {
    it('returns false when LanguageModel is not defined', () => {
      setMockLanguageModel(undefined)
      expect(chromeAI.isBuiltInAISupported()).toBe(false)
    })

    it('returns true when LanguageModel is defined', () => {
      setMockLanguageModel(createMockLanguageModelAPI())
      expect(chromeAI.isBuiltInAISupported()).toBe(true)
    })
  })

  describe('checkModelAvailability', () => {
    it('returns unavailable when API is not supported', async () => {
      setMockLanguageModel(undefined)
      const result = await chromeAI.checkModelAvailability()
      expect(result).toBe('unavailable')
    })

    it('returns available when model is ready', async () => {
      setMockLanguageModel(createMockLanguageModelAPI('available'))
      const result = await chromeAI.checkModelAvailability()
      expect(result).toBe('available')
    })

    it('returns downloadable when model needs download', async () => {
      setMockLanguageModel(createMockLanguageModelAPI('downloadable'))
      const result = await chromeAI.checkModelAvailability()
      expect(result).toBe('downloadable')
    })

    it('returns downloading when download is in progress', async () => {
      setMockLanguageModel(createMockLanguageModelAPI('downloading'))
      const result = await chromeAI.checkModelAvailability()
      expect(result).toBe('downloading')
    })

    it('returns unavailable when availability check throws', async () => {
      const mockAPI: LanguageModelAPI = {
        availability: vi.fn().mockRejectedValue(new Error('API error')),
        create: vi.fn(),
      }
      setMockLanguageModel(mockAPI)

      const result = await chromeAI.checkModelAvailability()
      expect(result).toBe('unavailable')
    })
  })

  describe('triggerModelDownload', () => {
    it('returns unavailable when API is not supported', async () => {
      setMockLanguageModel(undefined)

      const result = await chromeAI.triggerModelDownload()

      expect(result).toEqual({
        success: false,
        status: 'unavailable',
        error: 'Chrome built-in AI is not supported in this browser',
      })
    })

    it('returns success when model is created successfully', async () => {
      const createMock = vi.fn().mockResolvedValue(createMockSession())
      const mockAPI: LanguageModelAPI = {
        availability: vi.fn().mockResolvedValue('available'),
        create: createMock,
      }
      setMockLanguageModel(mockAPI)

      const result = await chromeAI.triggerModelDownload()

      expect(result).toEqual({
        success: true,
        status: 'available',
      })
      expect(createMock).toHaveBeenCalled()
    })

    it('destroys session after successful creation', async () => {
      const destroyMock = vi.fn()
      const mockSession: LanguageModelSession = {
        prompt: vi.fn().mockResolvedValue('response'),
        promptStreaming: vi.fn().mockReturnValue(new ReadableStream()),
        destroy: destroyMock,
      }
      const mockAPI: LanguageModelAPI = {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue(mockSession),
      }
      setMockLanguageModel(mockAPI)

      await chromeAI.triggerModelDownload()

      expect(destroyMock).toHaveBeenCalled()
    })

    it('calls progress callback during download', async () => {
      const mockAPI = createMockLanguageModelAPI('downloadable', 'progress')
      setMockLanguageModel(mockAPI)

      const progressCallback = vi.fn()
      await chromeAI.triggerModelDownload(progressCallback)

      // Wait for progress events to fire
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(progressCallback).toHaveBeenCalledWith(0.5)
      expect(progressCallback).toHaveBeenCalledWith(1.0)
    })

    it('returns error status when create fails', async () => {
      const mockAPI = createMockLanguageModelAPI('downloadable', 'error')
      setMockLanguageModel(mockAPI)

      const result = await chromeAI.triggerModelDownload()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to initialize model')
    })
  })

  describe('startModelDownloadAsync', () => {
    it('calls completion callback with result', async () => {
      const mockAPI = createMockLanguageModelAPI('available', 'success')
      setMockLanguageModel(mockAPI)

      const completionCallback = vi.fn()
      chromeAI.startModelDownloadAsync(undefined, completionCallback)

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(completionCallback).toHaveBeenCalledWith({
        success: true,
        status: 'available',
      })
    })

    it('calls progress and completion callbacks', async () => {
      const mockAPI = createMockLanguageModelAPI('downloadable', 'progress')
      setMockLanguageModel(mockAPI)

      const progressCallback = vi.fn()
      const completionCallback = vi.fn()
      chromeAI.startModelDownloadAsync(progressCallback, completionCallback)

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(progressCallback).toHaveBeenCalled()
      expect(completionCallback).toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      const mockAPI = createMockLanguageModelAPI('downloadable', 'error')
      setMockLanguageModel(mockAPI)

      const completionCallback = vi.fn()
      chromeAI.startModelDownloadAsync(undefined, completionCallback)

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(completionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      )
    })
  })
})

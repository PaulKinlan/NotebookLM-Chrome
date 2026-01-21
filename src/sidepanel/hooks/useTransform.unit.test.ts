/**
 * Unit tests for useTransform hook
 *
 * Tests the transform management hook including:
 * - Transform state management (isTransforming, history)
 * - Background message passing for transform execution
 * - Save/delete functionality
 * - Open in new tab functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/preact'
import type { Source, TransformationType, BackgroundTransform } from '../../types/index.ts'

// ============================================================================
// Mocks
// ============================================================================

// Mock storage functions
const mockSaveTransformation = vi.fn()
const mockDeleteTransformation = vi.fn()
const mockCreateTransformation = vi.fn()
const mockDeleteBackgroundTransform = vi.fn()
const mockGetTransformations = vi.fn()

vi.mock('../../lib/storage.ts', () => ({
  saveTransformation: (t: unknown) => mockSaveTransformation(t),
  deleteTransformation: (id: string) => mockDeleteTransformation(id),
  createTransformation: (nb: string, type: string, title: string, content: string, sourceIds: string[]) => mockCreateTransformation(nb, type, title, content, sourceIds),
  deleteBackgroundTransform: (id: string) => mockDeleteBackgroundTransform(id),
  getTransformations: (nbId: string) => mockGetTransformations(nbId),
}))

// Mock markdown renderer
vi.mock('../../lib/markdown-renderer.ts', () => ({
  renderMarkdown: (text: string) => `<p>${text}</p>`,
  isHtmlContent: (content: string) => content.startsWith('<html>'),
}))

vi.mock('../dom-utils.ts', () => ({
  escapeHtml: (text: string) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}))

// Mock for message listeners
const messageListeners: ((message: unknown) => void)[] = []

// Mock sendMessage to resolve with success by default
const mockSendMessage = vi.fn()

// Mock chrome APIs
globalThis.chrome = {
  tabs: {
    create: vi.fn((_options, callback) => {
      callback?.({ id: 123 } as never)
    }),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: vi.fn((listener: (message: unknown) => void) => {
        messageListeners.push(listener)
      }),
      removeListener: vi.fn((listener: (message: unknown) => void) => {
        const index = messageListeners.indexOf(listener)
        if (index > -1) messageListeners.splice(index, 1)
      }),
    },
  },
} as never

// Helper to simulate messages from background
function simulateBackgroundMessage(message: unknown) {
  for (const listener of messageListeners) {
    listener(message)
  }
}

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
  },
}))

// Mock console.warn and console.error to avoid test output noise
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

// ============================================================================
// Test Fixtures
// ============================================================================

const mockSources: Source[] = [
  {
    id: 'source-1',
    title: 'Test Source 1',
    url: 'https://example.com/1',
    content: 'Test content for source 1',
    type: 'tab',
    createdAt: Date.now(),
    notebookId: 'notebook-1',
    syncStatus: 'local',
    updatedAt: Date.now(),
  },
  {
    id: 'source-2',
    title: 'Test Source 2',
    url: 'https://example.com/2',
    content: 'Test content for source 2',
    type: 'bookmark',
    createdAt: Date.now(),
    notebookId: 'notebook-1',
    syncStatus: 'local',
    updatedAt: Date.now(),
  },
]

const mockNotebookId = 'notebook-1'

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()

  // Clear message listeners
  messageListeners.length = 0

  // Reset global signals
  transformHistory.value = []
  pendingTransforms.value = []

  // Reset mock functions
  mockSaveTransformation.mockReset()
  mockDeleteTransformation.mockReset()
  mockCreateTransformation.mockReset()
  mockDeleteBackgroundTransform.mockReset()
  mockGetTransformations.mockReset()
  mockSendMessage.mockReset()

  // Default mock return values
  mockGetTransformations.mockResolvedValue([])
  mockSendMessage.mockResolvedValue({ success: true, transformId: 'bg-transform-1' })

  consoleWarnSpy.mockClear()
  consoleErrorSpy.mockClear()
})

// Import hook and signals after mocks are set up
import { useTransform } from './useTransform.ts'
import { transformHistory, pendingTransforms } from '../store'

// ============================================================================
// Tests
// ============================================================================

describe('useTransform', () => {
  describe('initial state', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useTransform())

      expect(result.current.isTransforming).toBe(false)
      expect(result.current.pending).toEqual([])
      expect(result.current.history).toEqual([])
    })
  })

  describe('transform via background', () => {
    it('returns early with warning when sources array is empty', async () => {
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', [], mockNotebookId)
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith('[useTransform] No sources to transform')
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('sends START_TRANSFORM message to background', async () => {
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'START_TRANSFORM',
        payload: {
          notebookId: mockNotebookId,
          type: 'podcast',
          sourceIds: ['source-1', 'source-2'],
        },
      })
    })

    it('adds pending transform after successful START_TRANSFORM', async () => {
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.pending).toHaveLength(1)
      expect(result.current.pending[0].type).toBe('podcast')
      expect(result.current.pending[0].notebookId).toBe(mockNotebookId)
      expect(result.current.isTransforming).toBe(true)
    })

    it('logs error when START_TRANSFORM fails', async () => {
      mockSendMessage.mockResolvedValue({ success: false, error: 'No API key' })

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useTransform] Failed to start transform:',
        'No API key',
      )
      expect(result.current.pending).toHaveLength(0)
    })
  })

  describe('TRANSFORM_COMPLETE message handling', () => {
    it('adds completed transform to history when TRANSFORM_COMPLETE received', async () => {
      const { result } = renderHook(() => useTransform(mockNotebookId))

      // Start a transform
      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.pending).toHaveLength(1)

      // Simulate TRANSFORM_COMPLETE from background
      const bgTransform: BackgroundTransform = {
        id: 'bg-transform-1',
        type: 'podcast',
        notebookId: mockNotebookId,
        sourceIds: ['source-1', 'source-2'],
        status: 'completed',
        createdAt: Date.now() - 1000,
        startedAt: Date.now() - 500,
        completedAt: Date.now(),
        content: '# Podcast Script\n\nThis is a test.',
      }

      act(() => {
        simulateBackgroundMessage({
          type: 'TRANSFORM_COMPLETE',
          payload: bgTransform,
        })
      })

      // Pending should be cleared
      expect(result.current.pending).toHaveLength(0)
      expect(result.current.isTransforming).toBe(false)

      // History should have the result
      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].type).toBe('podcast')
      expect(result.current.history[0].title).toBe('Podcast Script')
      expect(result.current.history[0].content).toBe('# Podcast Script\n\nThis is a test.')
    })

    it('removes pending transform on TRANSFORM_ERROR', async () => {
      const { result } = renderHook(() => useTransform(mockNotebookId))

      // Start a transform
      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.pending).toHaveLength(1)

      // Simulate TRANSFORM_ERROR from background
      const bgTransform: BackgroundTransform = {
        id: 'bg-transform-1',
        type: 'podcast',
        notebookId: mockNotebookId,
        sourceIds: ['source-1', 'source-2'],
        status: 'failed',
        createdAt: Date.now() - 1000,
        startedAt: Date.now() - 500,
        completedAt: Date.now(),
        error: 'API rate limit exceeded',
      }

      act(() => {
        simulateBackgroundMessage({
          type: 'TRANSFORM_ERROR',
          payload: bgTransform,
        })
      })

      // Pending should be cleared
      expect(result.current.pending).toHaveLength(0)
      expect(result.current.isTransforming).toBe(false)

      // History should be empty (transform failed)
      expect(result.current.history).toHaveLength(0)
    })

    it('ignores messages for different notebooks', async () => {
      const { result } = renderHook(() => useTransform(mockNotebookId))

      // Start a transform
      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.pending).toHaveLength(1)

      // Simulate TRANSFORM_COMPLETE from a different notebook
      const bgTransform: BackgroundTransform = {
        id: 'bg-transform-other',
        type: 'quiz',
        notebookId: 'other-notebook', // Different notebook
        sourceIds: ['source-3'],
        status: 'completed',
        createdAt: Date.now(),
        completedAt: Date.now(),
        content: 'Quiz content',
      }

      act(() => {
        simulateBackgroundMessage({
          type: 'TRANSFORM_COMPLETE',
          payload: bgTransform,
        })
      })

      // Pending should NOT be cleared (different notebook)
      expect(result.current.pending).toHaveLength(1)
      // History should be empty (message was for different notebook)
      expect(result.current.history).toHaveLength(0)
    })
  })

  describe('removeResult', () => {
    it('removes a transform from history by id', () => {
      const { result } = renderHook(() => useTransform())

      // Add items to history inside act
      act(() => {
        transformHistory.value = [
          {
            id: 'result-1',
            title: 'Quiz',
            type: 'quiz' as TransformationType,
            content: 'Quiz content',
            isInteractive: false,
            sourceIds: ['source-1'],
            notebookId: mockNotebookId,
            timestamp: Date.now(),
            savedId: null,
          },
          {
            id: 'result-2',
            title: 'Podcast',
            type: 'podcast' as TransformationType,
            content: 'Podcast content',
            isInteractive: false,
            sourceIds: ['source-1'],
            notebookId: mockNotebookId,
            timestamp: Date.now() - 1000,
            savedId: null,
          },
        ]
      })

      expect(result.current.history).toHaveLength(2)

      act(() => {
        result.current.removeResult('result-1')
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].id).toBe('result-2')
    })
  })

  describe('clearHistory', () => {
    it('clears all transform history', () => {
      const { result } = renderHook(() => useTransform())

      // Add item to history inside act
      act(() => {
        transformHistory.value = [
          {
            id: 'result-1',
            title: 'Quiz',
            type: 'quiz' as TransformationType,
            content: 'Quiz content',
            isInteractive: false,
            sourceIds: ['source-1'],
            notebookId: mockNotebookId,
            timestamp: Date.now(),
            savedId: null,
          },
        ]
      })

      expect(result.current.history).toHaveLength(1)

      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.history).toHaveLength(0)
    })
  })

  describe('saveResult', () => {
    it('saves a transform result and updates savedId', async () => {
      const mockTransformation = {
        id: 'saved-id-123',
        notebookId: mockNotebookId,
        type: 'podcast' as const,
        title: 'Podcast Script',
        content: 'Podcast content',
        sourceIds: ['source-1'],
        syncStatus: 'local' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      mockCreateTransformation.mockReturnValue(mockTransformation)
      mockSaveTransformation.mockResolvedValue(undefined)

      const unsavedResult = {
        id: 'result-1',
        title: 'Podcast Script',
        type: 'podcast' as TransformationType,
        content: 'Podcast content',
        isInteractive: false,
        sourceIds: ['source-1'],
        notebookId: mockNotebookId,
        timestamp: Date.now(),
        savedId: null,
      }

      const { result } = renderHook(() => useTransform())

      act(() => {
        transformHistory.value = [unsavedResult]
      })

      await act(async () => {
        await result.current.saveResult(unsavedResult)
      })

      expect(mockCreateTransformation).toHaveBeenCalledWith(
        mockNotebookId,
        'podcast',
        'Podcast Script',
        'Podcast content',
        ['source-1'],
      )
      expect(mockSaveTransformation).toHaveBeenCalledWith(mockTransformation)
      expect(result.current.history[0].savedId).toBe('saved-id-123')
    })

    it('does not save already saved result', async () => {
      const alreadySavedResult = {
        id: 'result-1',
        title: 'Podcast Script',
        type: 'podcast' as TransformationType,
        content: 'Podcast content',
        isInteractive: false,
        sourceIds: ['source-1'],
        notebookId: mockNotebookId,
        timestamp: Date.now(),
        savedId: 'already-saved', // Already has savedId
      }

      const { result } = renderHook(() => useTransform())

      act(() => {
        transformHistory.value = [alreadySavedResult]
      })

      await act(async () => {
        await result.current.saveResult(alreadySavedResult)
      })

      expect(mockCreateTransformation).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalledWith('[useTransform] Result already saved')
    })
  })

  describe('deleteResult', () => {
    it('deletes saved transform from storage and removes from history', async () => {
      mockDeleteTransformation.mockResolvedValue(undefined)

      const savedResult = {
        id: 'result-1',
        title: 'Podcast Script',
        type: 'podcast' as TransformationType,
        content: 'Podcast content',
        isInteractive: false,
        sourceIds: ['source-1'],
        notebookId: mockNotebookId,
        timestamp: Date.now(),
        savedId: 'saved-id-123', // Has savedId
      }

      const { result } = renderHook(() => useTransform())

      act(() => {
        transformHistory.value = [savedResult]
      })

      await act(async () => {
        await result.current.deleteResult(savedResult)
      })

      expect(mockDeleteTransformation).toHaveBeenCalledWith('saved-id-123')
      expect(result.current.history).toHaveLength(0)
    })

    it('removes unsaved result from history without calling delete', async () => {
      const unsavedResult = {
        id: 'result-1',
        title: 'Podcast Script',
        type: 'podcast' as TransformationType,
        content: 'Podcast content',
        isInteractive: false,
        sourceIds: ['source-1'],
        notebookId: mockNotebookId,
        timestamp: Date.now(),
        savedId: null, // Not saved
      }

      const { result } = renderHook(() => useTransform())

      act(() => {
        transformHistory.value = [unsavedResult]
      })

      await act(async () => {
        await result.current.deleteResult(unsavedResult)
      })

      expect(mockDeleteTransformation).not.toHaveBeenCalled()
      expect(result.current.history).toHaveLength(0)
    })
  })

  describe('openInNewTab', () => {
    it('opens markdown transform in new tab', () => {
      const markdownResult = {
        id: 'result-1',
        title: 'Podcast Script',
        type: 'podcast' as TransformationType,
        content: '# Test Content',
        isInteractive: false,
        sourceIds: ['source-1'],
        notebookId: mockNotebookId,
        timestamp: Date.now(),
        savedId: null,
      }

      const { result } = renderHook(() => useTransform())

      act(() => {
        transformHistory.value = [markdownResult]
      })

      act(() => {
        result.current.openInNewTab(markdownResult)
      })

      expect(globalThis.chrome.tabs.create).toHaveBeenCalled()
    })

    it('opens interactive HTML transform in sandboxed iframe', () => {
      const interactiveResult = {
        id: 'result-1',
        title: 'Study Quiz',
        type: 'quiz' as TransformationType,
        content: '<html><body>Quiz</body></html>',
        isInteractive: true,
        sourceIds: ['source-1'],
        notebookId: mockNotebookId,
        timestamp: Date.now(),
        savedId: null,
      }

      const { result } = renderHook(() => useTransform())

      act(() => {
        transformHistory.value = [interactiveResult]
      })

      act(() => {
        result.current.openInNewTab(interactiveResult)
      })

      expect(globalThis.chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.any(String) }),
        expect.any(Function),
      )
    })
  })

  describe('syncPendingTransforms', () => {
    it('syncs pending transforms from background on mount', async () => {
      mockSendMessage.mockResolvedValue({
        transforms: [
          {
            id: 'bg-1',
            type: 'podcast',
            notebookId: mockNotebookId,
            sourceIds: ['source-1'],
            status: 'running',
            createdAt: Date.now(),
            startedAt: Date.now(),
          },
        ],
      })

      const { result } = renderHook(() => useTransform(mockNotebookId))

      // Wait for useEffect to run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Check that GET_PENDING_TRANSFORMS was called
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'GET_PENDING_TRANSFORMS',
        payload: { notebookId: mockNotebookId },
      })

      expect(result.current.pending).toHaveLength(1)
      expect(result.current.pending[0].type).toBe('podcast')
    })
  })
})

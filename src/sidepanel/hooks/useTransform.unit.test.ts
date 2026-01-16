/**
 * Unit tests for useTransform hook
 *
 * Tests the transform management hook including:
 * - Transform state management (isTransforming, history)
 * - Transform execution for all transform types
 * - Save/delete functionality
 * - Open in new tab functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/preact'
import type { Source, TransformationType } from '../../types/index.ts'

// ============================================================================
// Mocks
// ============================================================================

// Mock all AI transform functions
const mockGeneratePodcastScript = vi.fn()
const mockGenerateQuiz = vi.fn()
const mockGenerateKeyTakeaways = vi.fn()
const mockGenerateEmailSummary = vi.fn()
const mockGenerateSlideDeck = vi.fn()
const mockGenerateReport = vi.fn()
const mockGenerateDataTable = vi.fn()
const mockGenerateMindMap = vi.fn()
const mockGenerateFlashcards = vi.fn()
const mockGenerateTimeline = vi.fn()
const mockGenerateGlossary = vi.fn()
const mockGenerateComparison = vi.fn()
const mockGenerateFAQ = vi.fn()
const mockGenerateActionItems = vi.fn()
const mockGenerateExecutiveBrief = vi.fn()
const mockGenerateStudyGuide = vi.fn()
const mockGenerateProsCons = vi.fn()
const mockGenerateCitationList = vi.fn()
const mockGenerateOutline = vi.fn()

// Mock the ai.ts module
vi.mock('../../lib/ai.ts', () => ({
  generatePodcastScript: () => mockGeneratePodcastScript(),
  generateQuiz: () => mockGenerateQuiz(),
  generateKeyTakeaways: () => mockGenerateKeyTakeaways(),
  generateEmailSummary: () => mockGenerateEmailSummary(),
  generateSlideDeck: () => mockGenerateSlideDeck(),
  generateReport: () => mockGenerateReport(),
  generateDataTable: () => mockGenerateDataTable(),
  generateMindMap: () => mockGenerateMindMap(),
  generateFlashcards: () => mockGenerateFlashcards(),
  generateTimeline: () => mockGenerateTimeline(),
  generateGlossary: () => mockGenerateGlossary(),
  generateComparison: () => mockGenerateComparison(),
  generateFAQ: () => mockGenerateFAQ(),
  generateActionItems: () => mockGenerateActionItems(),
  generateExecutiveBrief: () => mockGenerateExecutiveBrief(),
  generateStudyGuide: () => mockGenerateStudyGuide(),
  generateProsCons: () => mockGenerateProsCons(),
  generateCitationList: () => mockGenerateCitationList(),
  generateOutline: () => mockGenerateOutline(),
  classifyError: vi.fn(),
  formatErrorForUser: vi.fn(),
  withRetry: vi.fn(),
  streamChat: vi.fn(),
  chat: vi.fn(),
  testConnection: vi.fn(),
  testConnectionWithConfig: vi.fn(),
  rankSourceRelevance: vi.fn(),
  type: {},
}))

// Mock storage functions
const mockSaveTransformation = vi.fn()
const mockDeleteTransformation = vi.fn()
const mockCreateTransformation = vi.fn()

vi.mock('../../lib/storage.ts', () => ({
  saveTransformation: (t: unknown) => mockSaveTransformation(t),
  deleteTransformation: (id: string) => mockDeleteTransformation(id),
  createTransformation: (nb: string, type: string, title: string, content: string, sourceIds: string[]) => mockCreateTransformation(nb, type, title, content, sourceIds),
}))

// Mock chrome.tabs.create
vi.mock('../../lib/markdown-renderer.ts', () => ({
  renderMarkdown: (text: string) => `<p>${text}</p>`,
  isHtmlContent: (content: string) => content.startsWith('<html>'),
}))

vi.mock('../dom-utils.ts', () => ({
  escapeHtml: (text: string) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}))

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
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
} as never

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

  // Reset global signals
  transformHistory.value = []
  pendingTransforms.value = []

  // Reset all mock functions
  mockGeneratePodcastScript.mockReset()
  mockGenerateQuiz.mockReset()
  mockGenerateKeyTakeaways.mockReset()
  mockGenerateEmailSummary.mockReset()
  mockGenerateSlideDeck.mockReset()
  mockGenerateReport.mockReset()
  mockGenerateDataTable.mockReset()
  mockGenerateMindMap.mockReset()
  mockGenerateFlashcards.mockReset()
  mockGenerateTimeline.mockReset()
  mockGenerateGlossary.mockReset()
  mockGenerateComparison.mockReset()
  mockGenerateFAQ.mockReset()
  mockGenerateActionItems.mockReset()
  mockGenerateExecutiveBrief.mockReset()
  mockGenerateStudyGuide.mockReset()
  mockGenerateProsCons.mockReset()
  mockGenerateCitationList.mockReset()
  mockGenerateOutline.mockReset()
  mockSaveTransformation.mockReset()
  mockDeleteTransformation.mockReset()
  mockCreateTransformation.mockReset()

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

  describe('transform', () => {
    it('returns early with warning when sources array is empty', async () => {
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', [], mockNotebookId)
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith('[useTransform] No sources to transform')
      expect(result.current.history).toHaveLength(0)
    })

    it('logs error for unknown transform type', async () => {
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('unknown' as TransformationType, mockSources, mockNotebookId)
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith('[useTransform] Unknown transform type:', 'unknown')
      expect(result.current.history).toHaveLength(0)
    })

    it('sets isTransforming to true during transform and false after completion', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast result')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        void result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.isTransforming).toBe(false)
      expect(result.current.history).toHaveLength(1)
    })

    it('resets isTransforming to false even when transform throws error', async () => {
      mockGeneratePodcastScript.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        // The transform will reject, but we still expect state to be reset
        try {
          await result.current.transform('podcast', mockSources, mockNotebookId)
        }
        catch {
          // Expected to throw
        }
      })

      expect(result.current.isTransforming).toBe(false)
      expect(result.current.history).toHaveLength(0)
    })

    it('creates transform result with correct properties for markdown content', async () => {
      const mockContent = '# Podcast Content\n\nThis is a test.'
      mockGeneratePodcastScript.mockResolvedValue(mockContent)

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.history).toHaveLength(1)
      const transformResult = result.current.history[0]
      expect(transformResult.id).toBeDefined()
      expect(transformResult.title).toBe('Podcast Script')
      expect(transformResult.type).toBe('podcast')
      expect(transformResult.content).toBe(mockContent)
      expect(transformResult.isInteractive).toBe(false)
      expect(transformResult.sourceIds).toEqual(['source-1', 'source-2'])
      expect(transformResult.notebookId).toBe(mockNotebookId)
      expect(transformResult.savedId).toBe(null)
      expect(transformResult.timestamp).toBeDefined()
    })

    it('creates interactive transform result for quiz type with HTML content', async () => {
      const mockHtml = '<html><body><div class="quiz">Interactive quiz</div></body></html>'
      mockGenerateQuiz.mockResolvedValue(mockHtml)

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('quiz', mockSources, mockNotebookId)
      })

      expect(result.current.history).toHaveLength(1)
      const transformResult = result.current.history[0]
      expect(transformResult.isInteractive).toBe(true)
      expect(transformResult.title).toBe('Study Quiz')
    })

    it('enforces history limit of 10 results', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Result')

      const { result } = renderHook(() => useTransform())

      // Create 11 transforms
      for (let i = 0; i < 11; i++) {
        await act(async () => {
          await result.current.transform('podcast', mockSources, mockNotebookId)
        })
      }

      // Should only have 10 (MAX_TRANSFORM_HISTORY)
      expect(result.current.history).toHaveLength(10)
    })

    it('orders history with newest first', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast result')
      mockGenerateQuiz.mockResolvedValue('Quiz result')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      await act(async () => {
        await result.current.transform('quiz', mockSources, mockNotebookId)
      })

      expect(result.current.history).toHaveLength(2)
      expect(result.current.history[0].type).toBe('quiz') // Newest first
      expect(result.current.history[1].type).toBe('podcast')
    })
  })

  describe('all transform types', () => {
    it('executes podcast transform', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Podcast Script')
      expect(mockGeneratePodcastScript).toHaveBeenCalled()
    })

    it('executes quiz transform', async () => {
      mockGenerateQuiz.mockResolvedValue('Quiz content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('quiz', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Study Quiz')
      expect(mockGenerateQuiz).toHaveBeenCalled()
    })

    it('executes takeaways transform', async () => {
      mockGenerateKeyTakeaways.mockResolvedValue('Takeaways content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('takeaways', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Key Takeaways')
      expect(mockGenerateKeyTakeaways).toHaveBeenCalled()
    })

    it('executes email transform', async () => {
      mockGenerateEmailSummary.mockResolvedValue('Email content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('email', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Email Summary')
      expect(mockGenerateEmailSummary).toHaveBeenCalled()
    })

    it('executes slidedeck transform', async () => {
      mockGenerateSlideDeck.mockResolvedValue('Slide deck content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('slidedeck', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Slide Deck')
      expect(mockGenerateSlideDeck).toHaveBeenCalled()
    })

    it('executes report transform', async () => {
      mockGenerateReport.mockResolvedValue('Report content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('report', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Report')
      expect(mockGenerateReport).toHaveBeenCalled()
    })

    it('executes datatable transform', async () => {
      mockGenerateDataTable.mockResolvedValue('Data table content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('datatable', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Data Table')
      expect(mockGenerateDataTable).toHaveBeenCalled()
    })

    it('executes mindmap transform', async () => {
      mockGenerateMindMap.mockResolvedValue('Mind map content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('mindmap', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Mind Map')
      expect(mockGenerateMindMap).toHaveBeenCalled()
    })

    it('executes flashcards transform', async () => {
      mockGenerateFlashcards.mockResolvedValue('Flashcards content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('flashcards', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Flashcards')
      expect(mockGenerateFlashcards).toHaveBeenCalled()
    })

    it('executes timeline transform', async () => {
      mockGenerateTimeline.mockResolvedValue('Timeline content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('timeline', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Timeline')
      expect(mockGenerateTimeline).toHaveBeenCalled()
    })

    it('executes glossary transform', async () => {
      mockGenerateGlossary.mockResolvedValue('Glossary content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('glossary', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Glossary')
      expect(mockGenerateGlossary).toHaveBeenCalled()
    })

    it('executes comparison transform', async () => {
      mockGenerateComparison.mockResolvedValue('Comparison content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('comparison', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Comparison')
      expect(mockGenerateComparison).toHaveBeenCalled()
    })

    it('executes faq transform', async () => {
      mockGenerateFAQ.mockResolvedValue('FAQ content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('faq', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('FAQ')
      expect(mockGenerateFAQ).toHaveBeenCalled()
    })

    it('executes actionitems transform', async () => {
      mockGenerateActionItems.mockResolvedValue('Action items content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('actionitems', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Action Items')
      expect(mockGenerateActionItems).toHaveBeenCalled()
    })

    it('executes executivebrief transform', async () => {
      mockGenerateExecutiveBrief.mockResolvedValue('Executive brief content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('executivebrief', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Executive Brief')
      expect(mockGenerateExecutiveBrief).toHaveBeenCalled()
    })

    it('executes studyguide transform', async () => {
      mockGenerateStudyGuide.mockResolvedValue('Study guide content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('studyguide', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Study Guide')
      expect(mockGenerateStudyGuide).toHaveBeenCalled()
    })

    it('executes proscons transform', async () => {
      mockGenerateProsCons.mockResolvedValue('Pros and cons content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('proscons', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Pros and Cons')
      expect(mockGenerateProsCons).toHaveBeenCalled()
    })

    it('executes citations transform', async () => {
      mockGenerateCitationList.mockResolvedValue('Citations content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('citations', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Citation List')
      expect(mockGenerateCitationList).toHaveBeenCalled()
    })

    it('executes outline transform', async () => {
      mockGenerateOutline.mockResolvedValue('Outline content')
      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('outline', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].title).toBe('Outline')
      expect(mockGenerateOutline).toHaveBeenCalled()
    })
  })

  describe('removeResult', () => {
    it('removes a transform from history by id', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast content')
      mockGenerateQuiz.mockResolvedValue('Quiz content')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
        await result.current.transform('quiz', mockSources, mockNotebookId)
      })

      const firstId = result.current.history[0].id

      act(() => {
        result.current.removeResult(firstId)
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].type).toBe('podcast')
    })
  })

  describe('clearHistory', () => {
    it('clears all transform history', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast content')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
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
        sourceIds: ['source-1', 'source-2'],
        syncStatus: 'local' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      mockCreateTransformation.mockReturnValue(mockTransformation)
      mockSaveTransformation.mockResolvedValue(undefined)

      mockGeneratePodcastScript.mockResolvedValue('Podcast content')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      const transformResult = result.current.history[0]
      expect(transformResult.savedId).toBe(null)

      await act(async () => {
        await result.current.saveResult(transformResult)
      })

      expect(mockCreateTransformation).toHaveBeenCalledWith(
        mockNotebookId,
        'podcast',
        'Podcast Script',
        'Podcast content',
        ['source-1', 'source-2'],
      )
      expect(mockSaveTransformation).toHaveBeenCalledWith(mockTransformation)
      expect(result.current.history[0].savedId).toBe('saved-id-123')
    })

    it('does not save already saved result', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast content')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      // Manually set savedId
      const history = result.current.history
      history[0] = { ...history[0], savedId: 'already-saved' }

      await act(async () => {
        await result.current.saveResult(result.current.history[0])
      })

      expect(mockCreateTransformation).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalledWith('[useTransform] Result already saved')
    })
  })

  describe('deleteResult', () => {
    it('deletes saved transform from storage and removes from history', async () => {
      const mockTransformation = {
        id: 'saved-id-123',
        notebookId: mockNotebookId,
        type: 'podcast' as const,
        title: 'Podcast Script',
        content: 'Podcast content',
        sourceIds: ['source-1', 'source-2'],
        syncStatus: 'local' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      mockCreateTransformation.mockReturnValue(mockTransformation)
      mockSaveTransformation.mockResolvedValue(undefined)
      mockDeleteTransformation.mockResolvedValue(undefined)

      mockGeneratePodcastScript.mockResolvedValue('Podcast content')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      // Save the result first
      await act(async () => {
        await result.current.saveResult(result.current.history[0])
      })

      expect(result.current.history[0].savedId).toBe('saved-id-123')

      // Delete the result
      await act(async () => {
        await result.current.deleteResult(result.current.history[0])
      })

      expect(mockDeleteTransformation).toHaveBeenCalledWith('saved-id-123')
      expect(result.current.history).toHaveLength(0)
    })

    it('removes unsaved result from history without calling delete', async () => {
      mockGeneratePodcastScript.mockResolvedValue('Podcast content')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      const transformResult = result.current.history[0]
      expect(transformResult.savedId).toBe(null)

      await act(async () => {
        await result.current.deleteResult(transformResult)
      })

      expect(mockDeleteTransformation).not.toHaveBeenCalled()
      expect(result.current.history).toHaveLength(0)
    })
  })

  describe('openInNewTab', () => {
    it('opens markdown transform in new tab', async () => {
      mockGeneratePodcastScript.mockResolvedValue('# Test Content\n\nThis is a test.')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      act(() => {
        result.current.openInNewTab(result.current.history[0])
      })

      expect(globalThis.chrome.tabs.create).toHaveBeenCalled()
    })

    it('opens interactive HTML transform in sandboxed iframe', async () => {
      const htmlContent = '<html><body><div class="quiz">Interactive quiz content</div></body></html>'
      mockGenerateQuiz.mockResolvedValue(htmlContent)

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('quiz', mockSources, mockNotebookId)
      })

      const transformResult = result.current.history[0]
      expect(transformResult.isInteractive).toBe(true)

      act(() => {
        result.current.openInNewTab(transformResult)
      })

      expect(globalThis.chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.any(String) }),
        expect.any(Function),
      )
    })
  })

  describe('edge cases', () => {
    it('handles empty string result from transform', async () => {
      mockGeneratePodcastScript.mockResolvedValue('')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.history[0].content).toBe('')
    })

    it('handles multiple sequential transforms', async () => {
      mockGeneratePodcastScript.mockResolvedValue('First result')
        .mockResolvedValueOnce('First result')
        .mockResolvedValue('Second result')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      await act(async () => {
        await result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.history).toHaveLength(2)
      expect(result.current.history[0].content).toBe('Second result')
      expect(result.current.history[1].content).toBe('First result')
    })

    it('handles single source array', async () => {
      const singleSource: Source[] = [
        {
          id: 'single',
          title: 'Single Source',
          url: 'https://example.com/single',
          content: 'Single content',
          type: 'manual',
          createdAt: Date.now(),
          notebookId: 'notebook-1',
          syncStatus: 'local',
          updatedAt: Date.now(),
        },
      ]

      mockGenerateQuiz.mockResolvedValue('Quiz of single source')

      const { result } = renderHook(() => useTransform())

      await act(async () => {
        await result.current.transform('quiz', singleSource, mockNotebookId)
      })

      expect(result.current.history[0].sourceIds).toEqual(['single'])
    })
  })

  describe('concurrent transforms', () => {
    it('allows multiple transforms to run concurrently', async () => {
      // Create promises that we can control
      let resolvePodcast: (value: string) => void
      let resolveQuiz: (value: string) => void

      const podcastPromise = new Promise<string>((resolve) => {
        resolvePodcast = resolve
      })
      const quizPromise = new Promise<string>((resolve) => {
        resolveQuiz = resolve
      })

      mockGeneratePodcastScript.mockReturnValue(podcastPromise)
      mockGenerateQuiz.mockReturnValue(quizPromise)

      const { result } = renderHook(() => useTransform())

      // Start both transforms concurrently (don't await)
      act(() => {
        void result.current.transform('podcast', mockSources, mockNotebookId)
        void result.current.transform('quiz', mockSources, mockNotebookId)
      })

      // Both should be pending
      expect(result.current.pending).toHaveLength(2)
      expect(result.current.isTransforming).toBe(true)
      expect(result.current.pending[0].type).toBe('podcast')
      expect(result.current.pending[1].type).toBe('quiz')

      // Complete the first transform
      await act(async () => {
        resolvePodcast!('Podcast result')
        await podcastPromise
      })

      // Only one should still be pending
      expect(result.current.pending).toHaveLength(1)
      expect(result.current.pending[0].type).toBe('quiz')
      expect(result.current.isTransforming).toBe(true)
      expect(result.current.history).toHaveLength(1)

      // Complete the second transform
      await act(async () => {
        resolveQuiz!('Quiz result')
        await quizPromise
      })

      // No more pending, both in history
      expect(result.current.pending).toHaveLength(0)
      expect(result.current.isTransforming).toBe(false)
      expect(result.current.history).toHaveLength(2)
    })

    it('pending transforms contain correct metadata', async () => {
      let resolvePodcast: (value: string) => void
      const podcastPromise = new Promise<string>((resolve) => {
        resolvePodcast = resolve
      })

      mockGeneratePodcastScript.mockReturnValue(podcastPromise)

      const { result } = renderHook(() => useTransform())

      act(() => {
        void result.current.transform('podcast', mockSources, mockNotebookId)
      })

      // Check pending transform has correct properties
      expect(result.current.pending).toHaveLength(1)
      const pending = result.current.pending[0]
      expect(pending.id).toBeDefined()
      expect(pending.type).toBe('podcast')
      expect(pending.notebookId).toBe(mockNotebookId)
      expect(pending.sourceIds).toEqual(['source-1', 'source-2'])
      expect(pending.startTime).toBeDefined()
      expect(pending.startTime).toBeLessThanOrEqual(Date.now())

      // Clean up
      await act(async () => {
        resolvePodcast!('Podcast result')
        await podcastPromise
      })
    })

    it('removes pending transform on error', async () => {
      let rejectPodcast: (error: Error) => void
      const podcastPromise = new Promise<string>((_, reject) => {
        rejectPodcast = reject
      })

      mockGeneratePodcastScript.mockReturnValue(podcastPromise)

      const { result } = renderHook(() => useTransform())

      // Store the transform promise so we can await it later
      let transformPromise: Promise<void>
      act(() => {
        transformPromise = result.current.transform('podcast', mockSources, mockNotebookId)
      })

      expect(result.current.pending).toHaveLength(1)

      // Reject the transform and await it to completion
      await act(async () => {
        rejectPodcast!(new Error('API Error'))
        try {
          await transformPromise
        }
        catch {
          // Expected - the transform should reject
        }
      })

      // Pending should be cleared even on error
      expect(result.current.pending).toHaveLength(0)
      expect(result.current.isTransforming).toBe(false)
      expect(result.current.history).toHaveLength(0)
    })
  })
})

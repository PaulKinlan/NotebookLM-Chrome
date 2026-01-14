/**
 * useTransform Hook
 *
 * Manages transformation state and logic.
 * Handles generating content transformations from sources.
 */

import { useState, useRef } from 'preact/hooks'
import { useNotebook } from './useNotebook.ts'
import { useSources } from './useSources.ts'
import { useNotification } from './useNotification.ts'
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
import { renderMarkdown, isHtmlContent } from '../../lib/markdown-renderer.ts'

export type TransformType
  = | 'podcast'
    | 'quiz'
    | 'takeaways'
    | 'email'
    | 'slidedeck'
    | 'report'
    | 'datatable'
    | 'mindmap'
    | 'flashcards'
    | 'timeline'
    | 'glossary'
    | 'comparison'
    | 'faq'
    | 'actionitems'
    | 'executivebrief'
    | 'studyguide'
    | 'proscons'
    | 'citations'
    | 'outline'

export interface TransformResult {
  id: string
  type: TransformType
  title: string
  content: string
  timestamp: number
  isInteractive: boolean
}

const TRANSFORM_TITLES: Record<TransformType, string> = {
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
  comparison: 'Comparison Chart',
  faq: 'FAQ',
  actionitems: 'Action Items',
  executivebrief: 'Executive Brief',
  studyguide: 'Study Guide',
  proscons: 'Pros & Cons',
  citations: 'Citation List',
  outline: 'Outline',
}

const INTERACTIVE_TYPES: TransformType[] = [
  'quiz',
  'flashcards',
  'timeline',
  'slidedeck',
  'mindmap',
  'studyguide',
]

const MAX_HISTORY = 10

export function useTransform() {
  const { currentNotebookId } = useNotebook()
  const { sources } = useSources(currentNotebookId)
  const { showNotification } = useNotification()

  const [history, setHistory] = useState<TransformResult[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const activeTransformIdRef = useRef<string | null>(null)

  /**
   * Generate a transformation from sources
   */
  async function generate(type: TransformType): Promise<void> {
    if (!currentNotebookId) {
      showNotification('Please select a notebook first')
      return
    }

    if (sources.length === 0) {
      showNotification('Add some sources first')
      return
    }

    setIsGenerating(true)

    // Create placeholder result
    const resultId = crypto.randomUUID()
    activeTransformIdRef.current = resultId

    const newResult: TransformResult = {
      id: resultId,
      type,
      title: TRANSFORM_TITLES[type],
      content: '<em>Generating...</em>',
      timestamp: Date.now(),
      isInteractive: INTERACTIVE_TYPES.includes(type),
    }

    // Add to history (newest first)
    setHistory((prev) => {
      const updated = [newResult, ...prev]
      return updated.slice(0, MAX_HISTORY)
    })

    try {
      let result: string

      switch (type) {
        case 'podcast':
          result = await generatePodcastScript(sources, {})
          break
        case 'quiz':
          result = await generateQuiz(sources, {})
          break
        case 'takeaways':
          result = await generateKeyTakeaways(sources)
          break
        case 'email':
          result = await generateEmailSummary(sources)
          break
        case 'slidedeck':
          result = await generateSlideDeck(sources)
          break
        case 'report':
          result = await generateReport(sources)
          break
        case 'datatable':
          result = await generateDataTable(sources)
          break
        case 'mindmap':
          result = await generateMindMap(sources)
          break
        case 'flashcards':
          result = await generateFlashcards(sources, {})
          break
        case 'timeline':
          result = await generateTimeline(sources)
          break
        case 'glossary':
          result = await generateGlossary(sources)
          break
        case 'comparison':
          result = await generateComparison(sources)
          break
        case 'faq':
          result = await generateFAQ(sources, {})
          break
        case 'actionitems':
          result = await generateActionItems(sources)
          break
        case 'executivebrief':
          result = await generateExecutiveBrief(sources)
          break
        case 'studyguide':
          result = await generateStudyGuide(sources)
          break
        case 'proscons':
          result = await generateProsCons(sources)
          break
        case 'citations':
          result = await generateCitationList(sources)
          break
        case 'outline':
          result = await generateOutline(sources)
          break
      }

      // Render markdown content
      let finalContent: string
      if (INTERACTIVE_TYPES.includes(type) && isHtmlContent(result)) {
        // Interactive HTML content (quiz, flashcards, etc.)
        finalContent = result // Already has HTML
      }
      else {
        // Standard markdown content - render with proper markdown parser
        finalContent = renderMarkdown(result)
      }

      // Update the result with final content
      setHistory(prev => prev.map(r =>
        r.id === resultId
          ? { ...r, content: finalContent }
          : r,
      ))
    }
    catch (error) {
      console.error('Transform failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorContent = `
        <p class="error">Failed to generate: ${errorMessage}</p>
        <p>Please check your API key in Settings.</p>
      `
      setHistory(prev => prev.map(r =>
        r.id === resultId
          ? { ...r, content: errorContent }
          : r,
      ))
    }
    finally {
      setIsGenerating(false)
      activeTransformIdRef.current = null
    }
  }

  /**
   * Remove a result from history
   */
  function removeResult(id: string): void {
    setHistory(prev => prev.filter(r => r.id !== id))
  }

  /**
   * Clear all history
   */
  function clearHistory(): void {
    setHistory([])
  }

  /**
   * Copy result content to clipboard
   */
  async function copyResult(id: string): Promise<void> {
    const result = history.find(r => r.id === id)
    if (!result) return

    // Strip HTML tags for clipboard
    const tmp = document.createElement('div')
    tmp.innerHTML = result.content
    const textContent = tmp.textContent || tmp.innerText || ''

    try {
      await navigator.clipboard.writeText(textContent)
      showNotification('Copied to clipboard')
    }
    catch {
      showNotification('Failed to copy')
    }
  }

  return {
    history,
    isGenerating,
    activeTransformId: activeTransformIdRef.current,
    generate,
    removeResult,
    clearHistory,
    copyResult,
  }
}

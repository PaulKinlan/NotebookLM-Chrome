/**
 * TransformTabStateful Component
 *
 * A fully stateful transform tab component that manages its own state and transformation logic.
 * Handles generating content transformations (podcast, quiz, takeaways, etc.) from sources.
 */

import { useRef, useEffect } from '../../jsx-runtime/hooks/index.ts'
import { useTransform, type TransformType } from '../hooks/useTransform.ts'
import { SandboxRenderer } from '../../lib/sandbox-renderer.ts'

/**
 * SVG child elements for each icon type
 * Using proper JSX elements instead of string injection
 */
function getIconElements(type: TransformType): JSX.Element[] {
  const icons: Record<TransformType, JSX.Element[]> = {
    podcast: [
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />,
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />,
      <line x1="12" y1="19" x2="12" y2="23" />,
      <line x1="8" y1="23" x2="16" y2="23" />,
    ],
    quiz: [
      <circle cx="12" cy="12" r="10" />,
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />,
      <line x1="12" y1="17" x2="12.01" y2="17" />,
    ],
    takeaways: [
      <line x1="8" y1="6" x2="21" y2="6" />,
      <line x1="8" y1="12" x2="21" y2="12" />,
      <line x1="8" y1="18" x2="21" y2="18" />,
      <line x1="3" y1="6" x2="3.01" y2="6" />,
      <line x1="3" y1="12" x2="3.01" y2="12" />,
      <line x1="3" y1="18" x2="3.01" y2="18" />,
    ],
    email: [
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />,
      <polyline points="22,6 12,13 2,6" />,
    ],
    slidedeck: [
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />,
      <line x1="8" y1="21" x2="16" y2="21" />,
      <line x1="12" y1="17" x2="12" y2="21" />,
    ],
    report: [
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
      <polyline points="14 2 14 8 20 8" />,
      <line x1="16" y1="13" x2="8" y2="13" />,
      <line x1="16" y1="17" x2="8" y2="17" />,
      <polyline points="10 9 9 9 8 9" />,
    ],
    datatable: [
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />,
      <line x1="3" y1="9" x2="21" y2="9" />,
      <line x1="3" y1="15" x2="21" y2="15" />,
      <line x1="9" y1="3" x2="9" y2="21" />,
      <line x1="15" y1="3" x2="15" y2="21" />,
    ],
    mindmap: [
      <circle cx="12" cy="12" r="3" />,
      <circle cx="4" cy="6" r="2" />,
      <circle cx="20" cy="6" r="2" />,
      <circle cx="4" cy="18" r="2" />,
      <circle cx="20" cy="18" r="2" />,
      <line x1="9.5" y1="10" x2="5.5" y2="7.5" />,
      <line x1="14.5" y1="10" x2="18.5" y2="7.5" />,
      <line x1="9.5" y1="14" x2="5.5" y2="16.5" />,
      <line x1="14.5" y1="14" x2="18.5" y2="16.5" />,
    ],
    flashcards: [
      <rect x="2" y="4" width="16" height="12" rx="2" />,
      <rect x="6" y="8" width="16" height="12" rx="2" />,
    ],
    timeline: [
      <line x1="12" y1="2" x2="12" y2="22" />,
      <circle cx="12" cy="6" r="2" />,
      <circle cx="12" cy="12" r="2" />,
      <circle cx="12" cy="18" r="2" />,
      <line x1="14" y1="6" x2="20" y2="6" />,
      <line x1="4" y1="12" x2="10" y2="12" />,
      <line x1="14" y1="18" x2="20" y2="18" />,
    ],
    glossary: [
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />,
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />,
      <line x1="8" y1="6" x2="16" y2="6" />,
      <line x1="8" y1="10" x2="14" y2="10" />,
      <line x1="8" y1="14" x2="12" y2="14" />,
    ],
    comparison: [
      <rect x="3" y="3" width="8" height="18" rx="1" />,
      <rect x="13" y="3" width="8" height="18" rx="1" />,
      <line x1="7" y1="8" x2="7" y2="8.01" />,
      <line x1="7" y1="12" x2="7" y2="12.01" />,
      <line x1="7" y1="16" x2="7" y2="16.01" />,
      <line x1="17" y1="8" x2="17" y2="8.01" />,
      <line x1="17" y1="12" x2="17" y2="12.01" />,
      <line x1="17" y1="16" x2="17" y2="16.01" />,
    ],
    faq: [
      <circle cx="12" cy="12" r="10" />,
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />,
      <line x1="12" y1="17" x2="12.01" y2="17" />,
    ],
    actionitems: [
      <polyline points="9 11 12 14 22 4" />,
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
    ],
    executivebrief: [
      <rect x="2" y="3" width="20" height="18" rx="2" />,
      <line x1="6" y1="8" x2="18" y2="8" />,
      <line x1="6" y1="12" x2="18" y2="12" />,
      <line x1="6" y1="16" x2="12" y2="16" />,
    ],
    studyguide: [
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />,
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
    ],
    proscons: [
      <line x1="12" y1="2" x2="12" y2="22" />,
      <line x1="5" y1="6" x2="9" y2="6" />,
      <line x1="5" y1="10" x2="9" y2="10" />,
      <line x1="5" y1="14" x2="9" y2="14" />,
      <line x1="15" y1="6" x2="19" y2="6" />,
      <line x1="15" y1="10" x2="19" y2="10" />,
      <line x1="15" y1="14" x2="19" y2="14" />,
    ],
    citations: [
      <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
      <path d="M6 9v12" />,
      <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
      <path d="M18 9v12" />,
    ],
    outline: [
      <line x1="8" y1="6" x2="21" y2="6" />,
      <line x1="8" y1="12" x2="21" y2="12" />,
      <line x1="8" y1="18" x2="21" y2="18" />,
      <line x1="3" y1="6" x2="3.01" y2="6" />,
      <line x1="3" y1="12" x2="3.01" y2="12" />,
      <line x1="3" y1="18" x2="3.01" y2="18" />,
    ],
  }
  return icons[type] || []
}

/**
 * TransformIcon Component - renders SVG icon using proper JSX elements
 */
function TransformIcon({ type }: { type: TransformType }): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {getIconElements(type)}
    </svg>
  )
}

interface TransformTabStatefulProps {
  active: boolean
}

interface TransformCard {
  id: string
  type: TransformType
  title: string
  content: string
  timestamp: number
  isInteractive: boolean
}

// Transform configuration with icons
const TRANSFORMS: Array<{ type: TransformType, title: string, description: string, icon: string }> = [
  { type: 'podcast', title: 'Podcast Script', description: 'Generate a 2-person conversation', icon: 'podcast-icon' },
  { type: 'quiz', title: 'Study Quiz', description: 'Test your knowledge', icon: 'quiz-icon' },
  { type: 'takeaways', title: 'Key Takeaways', description: 'Extract main points', icon: 'takeaways-icon' },
  { type: 'email', title: 'Email Summary', description: 'Professional summary to share', icon: 'email-icon' },
  { type: 'slidedeck', title: 'Slide Deck', description: 'Presentation outline', icon: 'slidedeck-icon' },
  { type: 'report', title: 'Report', description: 'Formal document', icon: 'report-icon' },
  { type: 'datatable', title: 'Data Table', description: 'Organize facts into tables', icon: 'datatable-icon' },
  { type: 'mindmap', title: 'Mind Map', description: 'Concept hierarchy', icon: 'mindmap-icon' },
  { type: 'flashcards', title: 'Flashcards', description: 'Q&A study cards', icon: 'flashcards-icon' },
  { type: 'timeline', title: 'Timeline', description: 'Chronological events', icon: 'timeline-icon' },
  { type: 'glossary', title: 'Glossary', description: 'Key terms & definitions', icon: 'glossary-icon' },
  { type: 'comparison', title: 'Comparison', description: 'Side-by-side analysis', icon: 'comparison-icon' },
  { type: 'faq', title: 'FAQ', description: 'Common questions', icon: 'faq-icon' },
  { type: 'actionitems', title: 'Action Items', description: 'Tasks & to-dos', icon: 'actionitems-icon' },
  { type: 'executivebrief', title: 'Executive Brief', description: 'One-page summary', icon: 'executivebrief-icon' },
  { type: 'studyguide', title: 'Study Guide', description: 'Comprehensive review', icon: 'studyguide-icon' },
  { type: 'proscons', title: 'Pros & Cons', description: 'Balanced analysis', icon: 'proscons-icon' },
  { type: 'citations', title: 'Citation List', description: 'Formatted references', icon: 'citations-icon' },
  { type: 'outline', title: 'Outline', description: 'Document structure', icon: 'outline-icon' },
]

/**
 * TransformCardButton Component - renders a single transform button
 */
function TransformCardButton({ transform, disabled, onClick }: {
  transform: { type: TransformType, title: string, description: string, icon: string }
  disabled: boolean
  onClick: (type: TransformType) => void
}): JSX.Element {
  return (
    <button
      className="transform-card"
      id={`transform-${transform.type}`}
      disabled={disabled}
      onClick={() => onClick(transform.type)}
      type="button"
    >
      <div className={`transform-icon ${transform.icon}`}>
        <TransformIcon type={transform.type} />
      </div>
      <div className="transform-info">
        <span className="transform-title">{transform.title}</span>
        <span className="transform-desc">{transform.description}</span>
      </div>
    </button>
  )
}

/**
 * TransformCardResult Component - renders a single transform result
 */
function TransformCardResult({ result, onCopy, onRemove }: {
  result: TransformCard
  onCopy: (id: string) => Promise<void>
  onRemove: (id: string) => void
}): JSX.Element {
  const containerRef = useRef<{ sandbox: SandboxRenderer | null }>({ sandbox: null })

  // Initialize/update sandbox when result changes
  useEffect(() => {
    const container = document.querySelector(`[data-result-id="${result.id}"] .transform-content`)
    if (!(container instanceof HTMLElement)) return

    // Clean up existing sandbox
    if (containerRef.current.sandbox) {
      containerRef.current.sandbox.destroy()
    }

    // Create new sandbox
    const sandbox = new SandboxRenderer(container)
    containerRef.current.sandbox = sandbox

    // Render content
    if (result.isInteractive) {
      void sandbox.renderInteractive(result.content)
    }
    else {
      void sandbox.render(result.content)
    }

    // Cleanup on unmount
    return () => {
      if (containerRef.current.sandbox) {
        containerRef.current.sandbox.destroy()
        containerRef.current.sandbox = null
      }
    }
  }, [result.id, result.content, result.isInteractive])

  return (
    <div className="transform-result" data-result-id={result.id}>
      <div className="transform-result-header">
        <h3>{result.title}</h3>
        <div className="transform-result-actions">
          <button
            className="icon-btn"
            title="Copy"
            onClick={() => onCopy(result.id)}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button
            className="icon-btn"
            title="Remove"
            onClick={() => onRemove(result.id)}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div className="transform-content"></div>
    </div>
  )
}

/**
 * TransformTabStateful Component
 */
export function TransformTabStateful({ active }: TransformTabStatefulProps): JSX.Element {
  const { history, isGenerating, generate, removeResult, copyResult } = useTransform()

  function handleTransform(type: TransformType): void {
    void generate(type)
  }

  return (
    <section id="tab-transform" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Transform</h2>
      <p className="helper-text">Transform your sources into different formats.</p>

      <div className="transform-grid">
        {TRANSFORMS.map(transform => (
          <TransformCardButton
            transform={transform}
            disabled={isGenerating}
            onClick={handleTransform}
          />
        ))}
      </div>

      {/* Transform History */}
      <div id="transform-history" className="transform-history">
        {history.map(result => (
          <TransformCardResult
            result={result}
            onCopy={copyResult}
            onRemove={removeResult}
          />
        ))}
      </div>
    </section>
  )
}

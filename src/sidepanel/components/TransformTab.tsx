import type { JSX } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import { transformHistory, transforming } from '../store'
import { useTransform } from '../hooks/useTransform'
import type { TransformResult } from '../hooks/useTransform'
import type { TransformationType } from '../../types/index.ts'
import { SandboxContent } from './SandboxContent'
import { TransformConfigPopover, ConfigIcon } from './TransformConfigPopover'

interface TransformTabProps {
  active: boolean
  onTransform: (type: string) => void
  notebookId: string | null
}

// Transform type definitions with their icons and descriptions
const TRANSFORM_TYPES: Array<{
  type: TransformationType
  title: string
  desc: string
  icon: JSX.Element
}> = [
  {
    type: 'podcast',
    title: 'Podcast Script',
    desc: 'Generate a 2-person conversation',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    ),
  },
  {
    type: 'quiz',
    title: 'Study Quiz',
    desc: 'Test your knowledge',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
  },
  {
    type: 'takeaways',
    title: 'Key Takeaways',
    desc: 'Extract main points',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    ),
  },
  {
    type: 'email',
    title: 'Email Summary',
    desc: 'Professional summary to share',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    ),
  },
  {
    type: 'slidedeck',
    title: 'Slide Deck',
    desc: 'Presentation outline',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    ),
  },
  {
    type: 'report',
    title: 'Report',
    desc: 'Formal document',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
  },
  {
    type: 'datatable',
    title: 'Data Table',
    desc: 'Organize facts into tables',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    ),
  },
  {
    type: 'mindmap',
    title: 'Mind Map',
    desc: 'Concept hierarchy',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"></circle>
        <circle cx="4" cy="6" r="2"></circle>
        <circle cx="20" cy="6" r="2"></circle>
        <circle cx="4" cy="18" r="2"></circle>
        <circle cx="20" cy="18" r="2"></circle>
        <line x1="9.5" y1="10" x2="5.5" y2="7.5"></line>
        <line x1="14.5" y1="10" x2="18.5" y2="7.5"></line>
        <line x1="9.5" y1="14" x2="5.5" y2="16.5"></line>
        <line x1="14.5" y1="14" x2="18.5" y2="16.5"></line>
      </svg>
    ),
  },
  {
    type: 'flashcards',
    title: 'Flashcards',
    desc: 'Q&A study cards',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="16" height="12" rx="2"></rect>
        <rect x="6" y="8" width="16" height="12" rx="2"></rect>
      </svg>
    ),
  },
  {
    type: 'timeline',
    title: 'Timeline',
    desc: 'Chronological events',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <circle cx="12" cy="6" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="18" r="2"></circle>
        <line x1="14" y1="6" x2="20" y2="6"></line>
        <line x1="4" y1="12" x2="10" y2="12"></line>
        <line x1="14" y1="18" x2="20" y2="18"></line>
      </svg>
    ),
  },
  {
    type: 'glossary',
    title: 'Glossary',
    desc: 'Key terms & definitions',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        <line x1="8" y1="6" x2="16" y2="6"></line>
        <line x1="8" y1="10" x2="14" y2="10"></line>
        <line x1="8" y1="14" x2="12" y2="14"></line>
      </svg>
    ),
  },
  {
    type: 'comparison',
    title: 'Comparison',
    desc: 'Side-by-side analysis',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="8" height="18" rx="1"></rect>
        <rect x="13" y="3" width="8" height="18" rx="1"></rect>
        <line x1="7" y1="8" x2="7" y2="8.01"></line>
        <line x1="7" y1="12" x2="7" y2="12.01"></line>
        <line x1="7" y1="16" x2="7" y2="16.01"></line>
        <line x1="17" y1="8" x2="17" y2="8.01"></line>
        <line x1="17" y1="12" x2="17" y2="12.01"></line>
        <line x1="17" y1="16" x2="17" y2="16.01"></line>
      </svg>
    ),
  },
  {
    type: 'faq',
    title: 'FAQ',
    desc: 'Common questions',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
  },
  {
    type: 'actionitems',
    title: 'Action Items',
    desc: 'Tasks & to-dos',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    ),
  },
  {
    type: 'executivebrief',
    title: 'Executive Brief',
    desc: 'One-page summary',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="18" rx="2"></rect>
        <line x1="6" y1="8" x2="18" y2="8"></line>
        <line x1="6" y1="12" x2="18" y2="12"></line>
        <line x1="6" y1="16" x2="12" y2="16"></line>
      </svg>
    ),
  },
  {
    type: 'studyguide',
    title: 'Study Guide',
    desc: 'Comprehensive review',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
    ),
  },
  {
    type: 'proscons',
    title: 'Pros & Cons',
    desc: 'Balanced analysis',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <line x1="5" y1="6" x2="9" y2="6"></line>
        <line x1="5" y1="10" x2="9" y2="10"></line>
        <line x1="5" y1="14" x2="9" y2="14"></line>
        <line x1="15" y1="6" x2="19" y2="6"></line>
        <line x1="15" y1="10" x2="19" y2="10"></line>
        <line x1="15" y1="14" x2="19" y2="14"></line>
      </svg>
    ),
  },
  {
    type: 'citations',
    title: 'Citation List',
    desc: 'Formatted references',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
        <path d="M6 9v12"></path>
        <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
        <path d="M18 9v12"></path>
      </svg>
    ),
  },
  {
    type: 'outline',
    title: 'Outline',
    desc: 'Document structure',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    ),
  },
]

export function TransformTab(props: TransformTabProps) {
  const { active, onTransform, notebookId } = props
  const { openInNewTab, removeResult, saveResult } = useTransform(notebookId)

  // State for config popover
  const [configOpen, setConfigOpen] = useState(false)
  const [configType, setConfigType] = useState<TransformationType | null>(null)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleOpenConfig = useCallback((e: MouseEvent, type: TransformationType) => {
    e.stopPropagation() // Prevent triggering the transform
    setConfigType(type)
    setConfigOpen(true)
  }, [])

  const handleCloseConfig = useCallback(() => {
    setConfigOpen(false)
    setConfigType(null)
  }, [])

  const renderTransformCard = (result: TransformResult) => {
    return (
      <div key={result.id} className={`transform-result ${result.savedId ? 'transform-saved' : ''}`} data-transform-id={result.id}>
        <div className="transform-result-header">
          <h3>{result.title}</h3>
          <div className="transform-result-actions">
            <button
              className="icon-btn"
              onClick={() => openInNewTab(result)}
              title="Open in new tab"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            {!result.savedId && (
              <button
                className="icon-btn"
                onClick={() => void saveResult(result)}
                title="Save"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              </button>
            )}
            {result.savedId && (
              <button
                className="icon-btn saved"
                title="Saved"
                disabled
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
            )}
            <button
              className="icon-btn"
              onClick={() => removeResult(result.id)}
              title="Delete"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div className="transform-content">
          <SandboxContent
            content={result.content}
            isInteractive={result.isInteractive}
          />
        </div>
        <div className="transform-meta">
          <span className="transform-date">{formatDate(result.timestamp)}</span>
        </div>
      </div>
    )
  }

  return (
    <section id="tab-transform" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Transform</h2>
      <p className="helper-text">Transform your sources into different formats.</p>

      <div className="transform-grid">
        {TRANSFORM_TYPES.map(transform => (
          <button
            key={transform.type}
            className="transform-card"
            id={`transform-${transform.type}`}
            onClick={() => onTransform(transform.type)}
          >
            <div className={`transform-icon ${transform.type}-icon`}>
              {transform.icon}
              <button
                className="transform-config-btn"
                onClick={e => handleOpenConfig(e, transform.type)}
                title="Configure options"
                type="button"
              >
                <ConfigIcon />
              </button>
            </div>
            <div className="transform-info">
              <span className="transform-title">{transform.title}</span>
              <span className="transform-desc">{transform.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Transform History */}
      {transformHistory.value.length > 0 && (
        <div className="transform-history">
          <h3 className="section-title">Recent Transforms</h3>
          {transforming.value && (
            <div className="transform-loading">Generating transform...</div>
          )}
          {transformHistory.value.map(result => renderTransformCard(result))}
        </div>
      )}

      {transforming.value && transformHistory.value.length === 0 && (
        <div className="transform-loading">Generating transform...</div>
      )}

      {/* Config Popover */}
      {configType && (
        <TransformConfigPopover
          type={configType}
          isOpen={configOpen}
          onClose={handleCloseConfig}
        />
      )}
    </section>
  )
}

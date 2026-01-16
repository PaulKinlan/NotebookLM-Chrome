import { transformHistory, transforming } from '../store'
import { useTransform } from '../hooks/useTransform'
import type { TransformResult } from '../hooks/useTransform'
import { SandboxContent } from './SandboxContent'

interface TransformTabProps {
  active: boolean
  onTransform: (type: string) => void
  notebookId: string | null
}

export function TransformTab(props: TransformTabProps) {
  const { active, onTransform, notebookId } = props
  const { openInNewTab, removeResult, saveResult } = useTransform(notebookId)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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
        <button className="transform-card" id="transform-podcast" onClick={() => onTransform('podcast')}>
          <div className="transform-icon podcast-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Podcast Script</span>
            <span className="transform-desc">Generate a 2-person conversation</span>
          </div>
        </button>

        <button className="transform-card" id="transform-quiz" onClick={() => onTransform('quiz')}>
          <div className="transform-icon quiz-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Study Quiz</span>
            <span className="transform-desc">Test your knowledge</span>
          </div>
        </button>

        <button className="transform-card" id="transform-takeaways" onClick={() => onTransform('takeaways')}>
          <div className="transform-icon takeaways-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Key Takeaways</span>
            <span className="transform-desc">Extract main points</span>
          </div>
        </button>

        <button className="transform-card" id="transform-email" onClick={() => onTransform('email')}>
          <div className="transform-icon email-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Email Summary</span>
            <span className="transform-desc">Professional summary to share</span>
          </div>
        </button>

        <button className="transform-card" id="transform-slidedeck" onClick={() => onTransform('slidedeck')}>
          <div className="transform-icon slidedeck-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Slide Deck</span>
            <span className="transform-desc">Presentation outline</span>
          </div>
        </button>

        <button className="transform-card" id="transform-report" onClick={() => onTransform('report')}>
          <div className="transform-icon report-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Report</span>
            <span className="transform-desc">Formal document</span>
          </div>
        </button>

        <button className="transform-card" id="transform-datatable" onClick={() => onTransform('datatable')}>
          <div className="transform-icon datatable-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Data Table</span>
            <span className="transform-desc">Organize facts into tables</span>
          </div>
        </button>

        <button className="transform-card" id="transform-mindmap" onClick={() => onTransform('mindmap')}>
          <div className="transform-icon mindmap-icon">
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
          </div>
          <div className="transform-info">
            <span className="transform-title">Mind Map</span>
            <span className="transform-desc">Concept hierarchy</span>
          </div>
        </button>

        <button className="transform-card" id="transform-flashcards" onClick={() => onTransform('flashcards')}>
          <div className="transform-icon flashcards-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="16" height="12" rx="2"></rect>
              <rect x="6" y="8" width="16" height="12" rx="2"></rect>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Flashcards</span>
            <span className="transform-desc">Q&A study cards</span>
          </div>
        </button>

        <button className="transform-card" id="transform-timeline" onClick={() => onTransform('timeline')}>
          <div className="transform-icon timeline-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <circle cx="12" cy="6" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="18" r="2"></circle>
              <line x1="14" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="12" x2="10" y2="12"></line>
              <line x1="14" y1="18" x2="20" y2="18"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Timeline</span>
            <span className="transform-desc">Chronological events</span>
          </div>
        </button>

        <button className="transform-card" id="transform-glossary" onClick={() => onTransform('glossary')}>
          <div className="transform-icon glossary-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <line x1="8" y1="6" x2="16" y2="6"></line>
              <line x1="8" y1="10" x2="14" y2="10"></line>
              <line x1="8" y1="14" x2="12" y2="14"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Glossary</span>
            <span className="transform-desc">Key terms & definitions</span>
          </div>
        </button>

        <button className="transform-card" id="transform-comparison" onClick={() => onTransform('comparison')}>
          <div className="transform-icon comparison-icon">
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
          </div>
          <div className="transform-info">
            <span className="transform-title">Comparison</span>
            <span className="transform-desc">Side-by-side analysis</span>
          </div>
        </button>

        <button className="transform-card" id="transform-faq" onClick={() => onTransform('faq')}>
          <div className="transform-icon faq-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">FAQ</span>
            <span className="transform-desc">Common questions</span>
          </div>
        </button>

        <button className="transform-card" id="transform-actionitems" onClick={() => onTransform('actionitems')}>
          <div className="transform-icon actionitems-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Action Items</span>
            <span className="transform-desc">Tasks & to-dos</span>
          </div>
        </button>

        <button className="transform-card" id="transform-executivebrief" onClick={() => onTransform('executivebrief')}>
          <div className="transform-icon executivebrief-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="18" rx="2"></rect>
              <line x1="6" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="12" x2="18" y2="12"></line>
              <line x1="6" y1="16" x2="12" y2="16"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Executive Brief</span>
            <span className="transform-desc">One-page summary</span>
          </div>
        </button>

        <button className="transform-card" id="transform-studyguide" onClick={() => onTransform('studyguide')}>
          <div className="transform-icon studyguide-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Study Guide</span>
            <span className="transform-desc">Comprehensive review</span>
          </div>
        </button>

        <button className="transform-card" id="transform-proscons" onClick={() => onTransform('proscons')}>
          <div className="transform-icon proscons-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <line x1="5" y1="6" x2="9" y2="6"></line>
              <line x1="5" y1="10" x2="9" y2="10"></line>
              <line x1="5" y1="14" x2="9" y2="14"></line>
              <line x1="15" y1="6" x2="19" y2="6"></line>
              <line x1="15" y1="10" x2="19" y2="10"></line>
              <line x1="15" y1="14" x2="19" y2="14"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Pros & Cons</span>
            <span className="transform-desc">Balanced analysis</span>
          </div>
        </button>

        <button className="transform-card" id="transform-citations" onClick={() => onTransform('citations')}>
          <div className="transform-icon citations-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
              <path d="M6 9v12"></path>
              <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
              <path d="M18 9v12"></path>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Citation List</span>
            <span className="transform-desc">Formatted references</span>
          </div>
        </button>

        <button className="transform-card" id="transform-outline" onClick={() => onTransform('outline')}>
          <div className="transform-icon outline-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <div className="transform-info">
            <span className="transform-title">Outline</span>
            <span className="transform-desc">Document structure</span>
          </div>
        </button>
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
    </section>
  )
}

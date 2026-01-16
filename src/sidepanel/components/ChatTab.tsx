import { useRef } from 'preact/hooks'
import type { Source } from '../../types/index.ts'
import { SourceItem } from './SourceItem'
import { chatMessages, showNotification } from '../store'
import { For } from '@preact/signals/utils'
import { useSuggestedLinks } from '../hooks/useSuggestedLinks'

interface ChatTabProps {
  active: boolean
  sources: Source[]
  onQuery: (question: string) => void
  onClearChat: () => void
  onRegenerateSummary: () => void
  onAddCurrentTab: () => void
  onManageSources: () => void
  onRefreshSources: () => void
  onRemoveSource?: (sourceId: string) => void
  onAddSuggestedLink?: (url: string, title: string) => void
  summaryContent: string | null
  showSummary: boolean
}

export function ChatTab(props: ChatTabProps) {
  const { active, sources, onQuery, onClearChat, onRegenerateSummary, onAddCurrentTab, onManageSources, onRefreshSources, onRemoveSource, onAddSuggestedLink, summaryContent, showSummary } = props
  const queryInputRef = useRef<HTMLInputElement>(null)

  // Suggested links hook
  const {
    suggestedLinks,
    loading: suggestedLinksLoading,
    error: suggestedLinksError,
    count: suggestedLinksCount,
    hasExtractable: hasExtractableLinks,
    loadSuggestedLinks,
  } = useSuggestedLinks(sources)

  const handleQuery = () => {
    const question = queryInputRef.current?.value.trim()
    if (question) {
      onQuery(question)
      if (queryInputRef.current) {
        queryInputRef.current.value = ''
      }
    }
  }

  const handleKeyPress = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key === 'Enter') {
      handleQuery()
    }
  }

  return (
    <section id="tab-chat" className={`tab-content ${active ? 'active' : ''}`}>
      {/* Summary Section (Collapsible) */}
      <details id="summary-section" className="summary-section" style={{ display: showSummary ? 'block' : 'none' }}>
        <summary className="summary-header">
          <h3 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            Overview
          </h3>
          <div className="summary-header-actions">
            <button id="regenerate-summary-btn" className="btn btn-small btn-outline" title="Regenerate overview" onClick={() => void onRegenerateSummary()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <svg className="summary-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div id="notebook-summary" className="summary-content">
          {summaryContent !== null
            ? (
                <div dangerouslySetInnerHTML={{ __html: summaryContent }} />
              )
            : (
                <div className="summary-loading">
                  <span className="loading-spinner"></span>
                  <span>Generating overview...</span>
                </div>
              )}
        </div>
      </details>

      {/* Sources Section (Collapsible) */}
      <details id="sources-section" className="sources-section" open>
        <summary className="sources-section-header">
          <h3 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Active Sources (
            <span id="source-count">{sources.length}</span>
            )
          </h3>
          <div className="sources-section-actions">
            <a
              href="#"
              id="manage-sources"
              className="link"
              onClick={(e) => {
                e.preventDefault()
                onManageSources()
              }}
            >
              Manage
            </a>
            <button id="refresh-all-sources-btn" className="btn btn-small btn-outline" title="Refresh all sources" onClick={() => void onRefreshSources()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <svg className="sources-section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div className="sources-section-content">
          <div id="active-sources" className="sources-list compact">
            {sources.length === 0
              ? (
                  <div className="empty-state">
                    <p>No sources added yet. Add a source to get started.</p>
                  </div>
                )
              : (
                  sources.map(source => (
                    <SourceItem key={source.id} source={source} onRemove={onRemoveSource} />
                  ))
                )}
          </div>
          <button id="add-page-btn" className="btn btn-outline btn-small" onClick={() => void onAddCurrentTab()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Current Page
          </button>
        </div>
      </details>

      {/* Suggested Links Section (Collapsible) - show when there are sources */}
      <details id="suggested-links-section" className="suggested-links-section" style={{ display: sources.length > 0 ? 'block' : 'none' }}>
        <summary className="suggested-links-header">
          <h3 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Suggested Links (
            <span id="suggested-links-count">{suggestedLinksCount}</span>
            )
          </h3>
          <div className="suggested-links-header-actions">
            <button
              id="refresh-links-btn"
              className="btn btn-small btn-outline"
              title="Find related links"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void loadSuggestedLinks()
              }}
              disabled={suggestedLinksLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={suggestedLinksLoading ? 'spin' : ''}>
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <svg className="suggested-links-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div id="suggested-links-content" className="suggested-links-content">
          {suggestedLinksLoading && (
            <div className="suggested-links-loading">
              <span className="loading-spinner"></span>
              <span>Analyzing links with AI...</span>
            </div>
          )}
          {suggestedLinksError && (
            <div className="suggested-links-error">
              <p>{suggestedLinksError}</p>
            </div>
          )}
          {!suggestedLinksLoading && !suggestedLinksError && suggestedLinks.length === 0 && (
            <div className="suggested-links-empty">
              <p>
                {hasExtractableLinks
                  ? 'Click the refresh button to find related links in your sources.'
                  : 'No links found in your sources. Try adding sources with links to related content.'}
              </p>
            </div>
          )}
          {!suggestedLinksLoading && suggestedLinks.length > 0 && (
            <div id="suggested-links-list" className="suggested-links-list">
              {suggestedLinks.map(link => (
                <div key={link.url} className="suggested-link-item">
                  <div className="suggested-link-info">
                    <div className="suggested-link-title">{link.title}</div>
                    <div className="suggested-link-description">{link.description}</div>
                    <div className="suggested-link-meta">
                      <span className="suggested-link-score">
                        {Math.round(link.relevanceScore * 100)}
                        % relevant
                      </span>
                      <span className="suggested-link-source">
                        from
                        {link.sourceTitle}
                      </span>
                    </div>
                  </div>
                  <div className="suggested-link-actions">
                    <button
                      className="btn btn-small btn-outline"
                      title="Add as source"
                      onClick={() => {
                        if (onAddSuggestedLink) {
                          onAddSuggestedLink(link.url, link.title)
                        }
                        else {
                          showNotification('Adding suggested link not available')
                        }
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Add
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-small btn-outline"
                      title="Open link"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <div className="chat-section">
        <div className="chat-header">
          <h3 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Chat History
          </h3>
          <button id="clear-chat-btn" className="btn btn-small btn-outline" title="Clear chat history" onClick={() => void onClearChat()}>Clear</button>
        </div>
        <div id="chat-messages" className="chat-messages">
          <For each={chatMessages} fallback={<div className="empty-state"><p>Ask a question to get started.</p></div>}>
            {(msg) => {
              // Handle different event types
              if (msg.type === 'user') {
                return (
                  <div className="chat-message user">
                    <div className="chat-message-role">You</div>
                    <div className="chat-message-content">
                      {msg.content.split('\n').map((line: string, i: number) => (
                        <p key={i}>{line || '\u00A0'}</p>
                      ))}
                    </div>
                  </div>
                )
              }
              else if (msg.type === 'assistant') {
                return (
                  <div className="chat-message assistant">
                    <div className="chat-message-role">AI</div>
                    <div className="chat-message-content">
                      {msg.content.split('\n').map((line: string, i: number) => (
                        <p key={i}>{line || '\u00A0'}</p>
                      ))}
                    </div>
                  </div>
                )
              }
              else { // tool-result
                return (
                  <div className="chat-message tool-result">
                    <div className="chat-message-role">
                      Tool:
                      {msg.toolName}
                    </div>
                    <div className="chat-message-content">
                      {msg.error
                        ? (
                            <p className="error">
                              Error:
                              {msg.error}
                            </p>
                          )
                        : <pre>{JSON.stringify(msg.result, null, 2)}</pre>}
                    </div>
                  </div>
                )
              }
            }}
          </For>
        </div>
      </div>

      <div className="query-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <div className="query-input-wrapper">
          <input type="text" id="query-input" ref={queryInputRef} placeholder="Ask a question about your sources..." autoComplete="off" onKeyDown={handleKeyPress} />
          <span id="autocomplete-ghost" className="autocomplete-ghost"></span>
        </div>
        <button id="query-btn" className="icon-btn btn-primary" onClick={handleQuery}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
        <div id="autocomplete-dropdown" className="autocomplete-dropdown hidden"></div>
      </div>
      <p className="helper-text" id="chat-status">Ask questions to synthesize information from your sources.</p>
    </section>
  )
}

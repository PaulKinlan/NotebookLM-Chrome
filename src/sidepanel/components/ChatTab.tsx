interface ChatTabProps {
  active: boolean
  onQuery: () => void
  onClearChat: () => void
  onRegenerateSummary: () => void
  onAddCurrentTab: () => void
}

export function ChatTab(props: ChatTabProps) {
  const { active } = props
  return (
    <section id="tab-chat" className={`tab-content ${active ? 'active' : ''}`}>
      {/* Summary Section (Collapsible) */}
      <details id="summary-section" className="summary-section" style={{ display: 'none' }}>
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
            <button id="regenerate-summary-btn" className="btn btn-small btn-outline" title="Regenerate overview">
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
          <div className="summary-loading">
            <span className="loading-spinner"></span>
            <span>Generating overview...</span>
          </div>
        </div>
      </details>

      <div className="sources-header">
        <h3 className="section-title">
          Active Sources (
          <span id="source-count">0</span>
          )
          <a href="#" id="manage-sources" className="link">Manage</a>
        </h3>
        <button id="refresh-all-sources-btn" className="btn btn-small btn-outline" title="Refresh all sources">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
      <div id="active-sources" className="sources-list compact"></div>

      <button id="add-page-btn" className="btn btn-outline btn-small">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Current Page
      </button>

      {/* Suggested Links Section (Collapsible) */}
      <details id="suggested-links-section" className="suggested-links-section" style={{ display: 'none' }}>
        <summary className="suggested-links-header">
          <h3 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Suggested Links (
            <span id="suggested-links-count">0</span>
            )
          </h3>
          <div className="suggested-links-header-actions">
            <button id="refresh-links-btn" className="btn btn-small btn-outline" title="Refresh suggestions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <div className="suggested-links-loading" style={{ display: 'none' }}>
            <span className="loading-spinner"></span>
            <span>Analyzing links...</span>
          </div>
          <div id="suggested-links-list" className="suggested-links-list"></div>
          <div className="suggested-links-empty" style={{ display: 'none' }}>
            <p>No relevant links found in your sources.</p>
          </div>
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
          <button id="clear-chat-btn" className="btn btn-small btn-outline" title="Clear chat history">Clear</button>
        </div>
        <div id="chat-messages" className="chat-messages">
          <div className="empty-state">
            <p>Ask a question to get started.</p>
          </div>
        </div>
      </div>

      <div className="query-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <div className="query-input-wrapper">
          <input type="text" id="query-input" placeholder="Ask a question about your sources..." autoComplete="off" />
          <span id="autocomplete-ghost" className="autocomplete-ghost"></span>
        </div>
        <button id="query-btn" className="icon-btn btn-primary">
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

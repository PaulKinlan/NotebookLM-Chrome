import type { Source } from '../../types/index.ts'
import { SourceItem } from './SourceItem'

interface AddTabProps {
  active: boolean
  sources: Source[]
  highlightedTabCount: number
  onAddCurrentTab: () => void
  onAddHighlightedTabs: () => void
  onImportTabs: () => void
  onImportTabGroups: () => void
  onImportBookmarks: () => void
  onImportHistory: () => void
  onAddNote: () => void
  onAddImages: () => void
  onRemoveSource?: (sourceId: string) => void
}

export function AddTab(props: AddTabProps) {
  const {
    active,
    sources,
    highlightedTabCount,
    onAddCurrentTab,
    onAddHighlightedTabs,
    onImportTabs,
    onImportTabGroups,
    onImportBookmarks,
    onImportHistory,
    onAddNote,
    onAddImages,
    onRemoveSource,
  } = props
  return (
    <section id="tab-add" className={`tab-content ${active ? 'active' : ''}`}>
      <div className="tab-header">
        <h2>Add Sources</h2>
        <button id="close-add-btn" className="icon-btn hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <button
        id="add-current-tab-btn"
        className="btn btn-primary btn-large"
        onClick={highlightedTabCount > 0 ? onAddHighlightedTabs : onAddCurrentTab}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        {highlightedTabCount > 0 ? `Add ${highlightedTabCount} Tabs` : 'Add Current Tab'}
      </button>
      <p className="helper-text">
        {highlightedTabCount > 0
          ? `${highlightedTabCount} tabs selected in Chrome. Click to add all.`
          : 'Captures the active page content immediately.'}
      </p>

      <h3 className="section-title">Import Options</h3>
      <div className="import-options">
        <button className="import-option" id="import-tabs" onClick={onImportTabs}>
          <span className="import-icon tabs-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
            </svg>
          </span>
          <div className="import-text">
            <span className="import-title">Select from Open Tabs</span>
            <span className="import-desc" id="tabs-count">Choose from active tabs</span>
          </div>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button className="import-option" id="import-tab-groups" onClick={onImportTabGroups}>
          <span className="import-icon tab-groups-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1"></rect>
            </svg>
          </span>
          <div className="import-text">
            <span className="import-title">Add from Tab Groups</span>
            <span className="import-desc">Import entire tab groups</span>
          </div>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button className="import-option" id="import-bookmarks" onClick={onImportBookmarks}>
          <span className="import-icon bookmarks-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </span>
          <div className="import-text">
            <span className="import-title">Add from Bookmarks</span>
            <span className="import-desc">Browse your saved pages</span>
          </div>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button className="import-option" id="import-history" onClick={onImportHistory}>
          <span className="import-icon history-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </span>
          <div className="import-text">
            <span className="import-title">Add from History</span>
            <span className="import-desc">Find previously visited sites</span>
          </div>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button className="import-option" id="add-note" onClick={onAddNote}>
          <span className="import-icon note-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </span>
          <div className="import-text">
            <span className="import-title">Add a Note</span>
            <span className="import-desc">Write your own content</span>
          </div>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <button className="import-option" id="add-images" onClick={onAddImages}>
          <span className="import-icon image-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </span>
          <div className="import-text">
            <span className="import-title">Add from Page Images</span>
            <span className="import-desc">Select images from current page</span>
          </div>
          <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <h3 className="section-title">
        Recent Sources
      </h3>
      <div id="sources-list" className="sources-list">
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
    </section>
  )
}

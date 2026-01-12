interface AddTabProps {
  active: boolean
  onAddCurrentTab: () => void
  onImportTabs: () => void
  onImportTabGroups: () => void
  onImportBookmarks: () => void
  onImportHistory: () => void
}

export function AddTab(props: AddTabProps) {
  const {
    active,
    onAddCurrentTab,
    onImportTabs,
    onImportTabGroups,
    onImportBookmarks,
    onImportHistory,
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

      <button id="add-current-tab-btn" className="btn btn-primary btn-large" onClick={onAddCurrentTab}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Current Tab
      </button>
      <p className="helper-text">Captures the active page content immediately.</p>

      <div className="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="search-sources" placeholder="Search added sources..." />
      </div>

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
      </div>

      <h3 className="section-title">
        Recent Sources
        <a href="#" id="view-all-sources" className="link">View All</a>
      </h3>
      <div id="sources-list" className="sources-list"></div>
    </section>
  )
}

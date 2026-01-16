import type { Notebook } from '../../types/index.ts'
import { notebooks, currentNotebookId } from '../store'

interface LibraryTabProps {
  active: boolean
  onSelectNotebook: (notebookId: string) => void
  onCreateNotebook: () => void
  onEditNotebook: (notebook: Notebook) => void
  onDeleteNotebook: (notebookId: string) => void
}

export function LibraryTab(props: LibraryTabProps) {
  const { active, onSelectNotebook, onCreateNotebook, onEditNotebook, onDeleteNotebook } = props

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <section id="tab-library" className={`tab-content ${active ? 'active' : ''}`}>
      <div className="library-header">
        <h2>Library</h2>
        <button className="btn btn-primary btn-small" onClick={onCreateNotebook}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Folio
        </button>
      </div>
      <p className="helper-text">Your notebooks and saved content.</p>

      <div id="notebooks-list" className="notebooks-list">
        {notebooks.value.length === 0
          ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <p>No notebooks yet</p>
                <p className="empty-state-hint">Create a notebook to start organizing your sources.</p>
                <button className="btn btn-primary" onClick={onCreateNotebook}>
                  Create Your First Folio
                </button>
              </div>
            )
          : (
              notebooks.value.map(notebook => (
                <div
                  key={notebook.id}
                  className={`notebook-item ${currentNotebookId.value === notebook.id ? 'active' : ''}`}
                  onClick={() => onSelectNotebook(notebook.id)}
                >
                  <div className="notebook-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                  </div>
                  <div className="notebook-info">
                    <div className="notebook-name">{notebook.name}</div>
                    <div className="notebook-meta">
                      <span>{`Updated ${formatDate(notebook.updatedAt)}`}</span>
                    </div>
                  </div>
                  <div className="notebook-actions">
                    <button
                      className="icon-btn"
                      title="Edit notebook"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditNotebook(notebook)
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      className="icon-btn"
                      title="Delete notebook"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteNotebook(notebook.id)
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
      </div>
    </section>
  )
}

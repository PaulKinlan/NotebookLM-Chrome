/**
 * HeaderStateful Component
 *
 * Top navigation bar with logo, library/settings buttons, notebook selector, and AI model picker.
 * Uses useNotebook hook to populate and manage the notebook select dropdown.
 */

import { useNotebook } from '../hooks/useNotebook.ts'
import { useNavigation } from '../hooks/useNavigation.ts'

interface HeaderStatefulProps {
  /** Optional callback when notebook changes (in addition to hook's selectNotebook) */
  onNotebookChange?: (id: string) => void
  /** showNotebook function from App's useDialog hook - passed down to share dialog state */
  showNotebook: (options?: { title?: string, placeholder?: string, confirmText?: string }) => Promise<string | null>
}

export function HeaderStateful({ onNotebookChange, showNotebook }: HeaderStatefulProps) {
  const { notebooks, currentNotebookId, selectNotebook, createNotebook } = useNotebook()
  const { switchTab } = useNavigation()

  const handleNotebookChange = async (e: { target: HTMLSelectElement }) => {
    const notebookId = e.target.value || null
    if (notebookId) {
      await selectNotebook(notebookId)
      if (onNotebookChange) {
        onNotebookChange(notebookId)
      }
    }
  }

  const handleNewNotebook = async () => {
    console.log('[handleNewNotebook] Starting notebook creation flow')
    const name = await showNotebook({
      title: 'New Folio',
      placeholder: 'Enter folio name...',
      confirmText: 'Create',
    })
    console.log('[handleNewNotebook] showNotebook returned:', name)
    if (name) {
      // Use the hook's createNotebook which handles saving and state updates
      console.log('[handleNewNotebook] Calling createNotebook with:', name)
      const nb = await createNotebook(name)
      console.log('[handleNewNotebook] createNotebook returned:', nb)
      if (nb) {
        console.log('[handleNewNotebook] Calling selectNotebook with id:', nb.id)
        await selectNotebook(nb.id)
        console.log('[handleNewNotebook] selectNotebook completed')
      }
      else {
        console.log('[handleNewNotebook] createNotebook returned null')
      }
    }
    else {
      console.log('[handleNewNotebook] name was empty/null, not creating notebook')
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">F</span>
        <h1>FolioLM</h1>
        <button
          id="header-library-btn"
          className="header-icon-btn"
          title="Library"
          onClick={() => switchTab('library')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </button>
        <button
          id="header-settings-btn"
          className="header-icon-btn"
          title="Settings"
          onClick={() => switchTab('settings')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      <div className="header-right">
        <select
          id="notebook-select"
          className="header-notebook-select"
          value={currentNotebookId ?? ''}
          onChange={handleNotebookChange}
        >
          <option value="">Select a folio...</option>
          {notebooks.map(notebook => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.name}
            </option>
          ))}
        </select>
        <div className="ai-model-picker">
          <button
            id="ai-model-btn"
            className="header-icon-btn"
            title="AI Model"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="8.5" cy="16" r="1.5"></circle>
              <circle cx="15.5" cy="16" r="1.5"></circle>
              <path d="M8.5 11V7a3.5 3.5 0 0 1 7 0v4"></path>
            </svg>
          </button>
          <div id="ai-model-dropdown" className="ai-model-dropdown hidden">
            <div className="ai-model-dropdown-content">
              <div className="ai-model-dropdown-header">Select AI Model</div>
              <div id="ai-model-list" className="ai-model-list"></div>
            </div>
          </div>
        </div>
        <button
          id="new-notebook-btn"
          className="header-icon-btn"
          title="New Folio"
          onClick={handleNewNotebook}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>
  )
}

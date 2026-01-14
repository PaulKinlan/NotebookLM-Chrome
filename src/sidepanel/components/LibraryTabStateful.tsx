/**
 * LibraryTabStateful Component
 *
 * Displays and manages the list of notebooks.
 * Replaces imperative rendering in controllers.ts (loadNotebooksList function).
 */

import { useEffect, useState } from '../../jsx-runtime/hooks/index.ts'
import { useNotebook } from '../hooks/useNotebook.ts'
import { useNotification } from '../hooks/useNotification.ts'
import { useDialog } from '../hooks/useDialog.ts'
import { getSourcesByNotebook } from '../../lib/storage.ts'
import type { Notebook } from '../../types/index.ts'
import styles from './LibraryTab.module.css'

interface LibraryTabStatefulProps {
  active: boolean
  /** Callback to switch tabs - passed down from App */
  onTabChange?: (tab: 'library' | 'chat' | 'transform' | 'add' | 'settings') => void
}

interface NotebookWithSourceCount extends Notebook {
  sourceCount: number
}

export function LibraryTabStateful({ active, onTabChange }: LibraryTabStatefulProps) {
  const { notebooks, currentNotebookId, selectNotebook, deleteNotebook, reloadNotebooks } = useNotebook()
  const { showNotification } = useNotification()
  const { showConfirm } = useDialog()

  // Track source counts for each notebook
  const [notebooksWithCounts, setNotebooksWithCounts] = useState<NotebookWithSourceCount[]>([])

  // Load source counts when notebooks change
  useEffect(() => {
    void loadSourceCounts()
  }, [notebooks])

  const loadSourceCounts = async () => {
    const withCounts = await Promise.all(
      notebooks.map(async (notebook) => {
        const sources = await getSourcesByNotebook(notebook.id)
        return { ...notebook, sourceCount: sources.length }
      }),
    )
    setNotebooksWithCounts(withCounts)
  }

  // Handle clicking on a notebook to select it
  const handleNotebookClick = async (notebookId: string) => {
    await selectNotebook(notebookId)
    onTabChange?.('chat')
    showNotification('Notebook selected', 'success')
  }

  // Handle exporting a notebook
  const handleExportNotebook = async (notebookId: string, event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    try {
      const notebook = notebooks.find(nb => nb.id === notebookId)
      if (!notebook) return

      const sources = await getSourcesByNotebook(notebookId)
      const data = {
        notebook,
        sources,
        exportDate: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${notebook.name.replace(/[^a-z0-9]/gi, '_')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showNotification(`Exported "${notebook.name}"`, 'success')
    }
    catch (error) {
      console.error('Failed to export notebook:', error)
      showNotification('Failed to export notebook', 'error')
    }
  }

  // Handle deleting a notebook
  const handleDeleteNotebook = async (notebookId: string, notebookName: string, event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const confirmed = await showConfirm({
      title: 'Delete Notebook',
      message: `Are you sure you want to delete "${notebookName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true,
    })

    if (confirmed) {
      await deleteNotebook(notebookId)
      await reloadNotebooks()
      showNotification(`Deleted "${notebookName}"`, 'success')
    }
  }

  return (
    <section id="tab-library" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Library</h2>
      <p className="helper-text">Your notebooks and saved content.</p>
      <div id="notebooks-list" className={`notebooks-list ${styles.notebooksList}`}>
        {notebooksWithCounts.length === 0
          ? (
              <div className="empty-state">
                <p>No notebooks yet. Create one to get started.</p>
              </div>
            )
          : (
              notebooksWithCounts.map(notebook => (
                <div
                  key={notebook.id}
                  className={`notebook-item ${styles.notebookItem} ${currentNotebookId === notebook.id ? `active ${styles.active}` : ''}`}
                  onClick={() => handleNotebookClick(notebook.id)}
                >
                  <div className={styles.notebookIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                  </div>

                  <div className={styles.notebookInfo}>
                    <div className={styles.notebookName}>{notebook.name}</div>
                    <div className={styles.notebookMeta}>
                      {notebook.sourceCount}
                      {' '}
                      source
                      {notebook.sourceCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className={styles.notebookActions}>
                    <button
                      className={`icon-btn ${styles.btnExportNotebook}`}
                      data-id={notebook.id}
                      title="Export notebook"
                      onClick={(e: { stopPropagation: () => void }) => handleExportNotebook(notebook.id, e)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>

                    <button
                      className="icon-btn btn-delete-notebook"
                      data-id={notebook.id}
                      title="Delete notebook"
                      onClick={(e: { stopPropagation: () => void }) => handleDeleteNotebook(notebook.id, notebook.name, e)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

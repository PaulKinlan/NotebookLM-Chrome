/**
 * AddTabStateful Component
 *
 * A fully stateful component for adding sources from tabs, bookmarks,
 * and history. Uses hooks for notebook selection, source management,
 * and permissions.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import { useNotebook } from '../hooks/useNotebook.ts'
import { useSources } from '../hooks/useSources.ts'
import { usePermissions } from '../hooks/usePermissions.ts'
import { useDialog } from '../hooks/useDialog.ts'
import { SourcesList } from './SourcesList.tsx'
import { PickerModal } from './PickerModal.tsx'
import { addCurrentTab } from '../services/sources.ts'
import {
  saveNotebook,
  createNotebook,
  setActiveNotebookId,
} from '../../lib/storage.ts'
import { addSourceToNotebook } from '../services/notebooks.ts'
import { importTabs, importBookmarks, importHistory } from '../services/sources.ts'
import type { PickerItem } from '../services/sources.ts'
import styles from './AddTab.module.css'

interface AddTabStatefulProps {
  active: boolean
  /** Callback to switch tabs - passed down from App */
  onTabChange?: (tab: 'library' | 'chat' | 'transform' | 'add' | 'settings') => void
}

/**
 * AddTabStateful - Fully self-contained add sources component
 */
export function AddTabStateful({ active, onTabChange }: AddTabStatefulProps): JSX.Element {
  // Notebook state
  const { currentNotebookId } = useNotebook()

  // Sources state
  const { removeSource } = useSources(currentNotebookId)

  // Permissions state
  const { permissions } = usePermissions()

  // Dialog state
  const { showNotebook } = useDialog()

  // UI state
  const [showPicker, setShowPicker] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [buttonText, setButtonText] = useState('Add Current Tab')

  /**
   * Update button text based on highlighted tabs
   */
  useEffect(() => {
    const updateButtonText = async () => {
      if (!permissions.tabs) {
        setButtonText('Add Current Tab')
        return
      }

      const tabs = await chrome.tabs.query({ highlighted: true, currentWindow: true })
      if (tabs.length > 1) {
        setButtonText(`Add ${tabs.length} Selected Tabs`)
      }
      else {
        setButtonText('Add Current Tab')
      }
    }

    if (active) {
      void updateButtonText()
    }
  }, [active, permissions.tabs])

  /**
   * Ensure notebook exists before adding source
   */
  async function ensureNotebook(): Promise<string | null> {
    if (currentNotebookId) {
      return currentNotebookId
    }

    const name = await showNotebook({ title: 'Create a notebook first' })
    if (!name) {
      return null
    }

    const notebook = createNotebook(name)
    await saveNotebook(notebook)
    await setActiveNotebookId(notebook.id)

    return notebook.id
  }

  /**
   * Handle add current tab button click
   */
  async function handleAddCurrentTab(): Promise<void> {
    if (isAdding) return

    const notebookId = await ensureNotebook()
    if (!notebookId) {
      return
    }

    setIsAdding(true)

    try {
      // Check for multiple highlighted tabs
      const highlightedTabs = await chrome.tabs.query({
        highlighted: true,
        currentWindow: true,
      })

      if (highlightedTabs.length > 1) {
        // Add all highlighted tabs
        let addedCount = 0
        for (const tab of highlightedTabs) {
          if (!tab.id || !tab.url) continue

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPageContent,
          })

          const result = results?.[0]?.result
          if (result) {
            const { title, content, links } = result
            addSourceToNotebook(
              notebookId,
              'tab',
              tab.url,
              title || tab.title || 'Untitled',
              content,
              links,
            )
            addedCount++
          }
        }

        if (addedCount > 0) {
          chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})
        }
      }
      else {
        // Add single current tab
        await addCurrentTab()
      }
    }
    catch (error) {
      console.error('Failed to add current tab:', error)
    }
    finally {
      setIsAdding(false)
    }
  }

  /**
   * Handle adding sources from picker modal
   */
  async function handleAddSources(items: PickerItem[]): Promise<void> {
    const notebookId = await ensureNotebook()
    if (!notebookId) {
      return
    }

    // Group items by type for efficient importing
    const tabIds: string[] = []
    const bookmarkIds: string[] = []
    const historyUrls: string[] = []

    for (const item of items) {
      if (item.id.startsWith('tab-')) {
        tabIds.push(item.id.replace('tab-', ''))
      }
      else if (item.id.startsWith('bookmark-')) {
        bookmarkIds.push(item.id.replace('bookmark-', ''))
      }
      else if (item.id.startsWith('history-')) {
        historyUrls.push(item.url)
      }
    }

    // Import each batch

    if (tabIds.length > 0) {
      await importTabs(tabIds)
    }
    if (bookmarkIds.length > 0) {
      await importBookmarks(bookmarkIds)
    }
    if (historyUrls.length > 0) {
      await importHistory(historyUrls)
    }

    setShowPicker(false)
    // Sources will reload via useSources hook
  }

  /**
   * Handle import option click with permission check
   */
  function handleImportClick(): void {
    setShowPicker(true)
  }

  function handlePickerClose(): void {
    setShowPicker(false)
  }

  return (
    <section id="tab-add" className={`${styles.tabContent} ${active ? styles.tabContentActive : ''}`}>
      <div className={styles.tabHeader}>
        <h2>Add Sources</h2>
        <button id="close-add-btn" className="icon-btn hidden" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18">
            </line>
            <line x1="6" y1="6" x2="18" y2="18">
            </line>
          </svg>
        </button>
      </div>

      <button
        id="add-current-tab-btn"
        className="btn btn-primary btn-large"
        disabled={isAdding}
        onClick={(): void => {
          void handleAddCurrentTab()
        }}
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19">
          </line>
          <line x1="5" y1="12" x2="19" y2="12">
          </line>
        </svg>
        {isAdding ? 'Adding...' : buttonText}
      </button>
      <p className="helper-text">
        {isAdding
          ? 'Extracting content from page(s)...'
          : 'Captures the active page content immediately.'}
      </p>

      <div className={styles.searchBox}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8">
          </circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65">
          </line>
        </svg>
        <input
          type="text"
          id="search-sources"
          placeholder="Search added sources..."
        />
      </div>

      <h3 className="section-title">Import Options</h3>
      <div className={styles.importOptions}>
        <button
          className={styles.importOption}
          id="import-tabs"
          onClick={handleImportClick}
          type="button"
        >
          <span className={`${styles.importIcon} ${styles.tabsIcon}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2">
              </rect>
              <line x1="3" y1="9" x2="21" y2="9">
              </line>
            </svg>
          </span>
          <div className={styles.importText}>
            <span className={styles.importTitle}>Select from Open Tabs</span>
            <span className={styles.importDesc} id="tabs-count">
              Choose from active tabs
            </span>
          </div>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6">
            </polyline>
          </svg>
        </button>

        <button
          className={styles.importOption}
          id="import-tab-groups"
          onClick={handleImportClick}
          type="button"
        >
          <span className={`${styles.importIcon} ${styles.tabGroupsIcon}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1">
              </rect>
              <rect x="14" y="3" width="7" height="7" rx="1">
              </rect>
              <rect x="3" y="14" width="7" height="7" rx="1">
              </rect>
              <rect x="14" y="14" width="7" height="7" rx="1">
              </rect>
            </svg>
          </span>
          <div className={styles.importText}>
            <span className={styles.importTitle}>Add from Tab Groups</span>
            <span className={styles.importDesc}>Import entire tab groups</span>
          </div>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6">
            </polyline>
          </svg>
        </button>

        <button
          className={styles.importOption}
          id="import-bookmarks"
          onClick={handleImportClick}
          type="button"
        >
          <span className={`${styles.importIcon} ${styles.bookmarksIcon}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z">
              </path>
            </svg>
          </span>
          <div className={styles.importText}>
            <span className={styles.importTitle}>Add from Bookmarks</span>
            <span className={styles.importDesc}>Browse your saved pages</span>
          </div>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6">
            </polyline>
          </svg>
        </button>

        <button
          className={styles.importOption}
          id="import-history"
          onClick={handleImportClick}
          type="button"
        >
          <span className={`${styles.importIcon} ${styles.historyIcon}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10">
              </circle>
              <polyline points="12 6 12 12 16 14">
              </polyline>
            </svg>
          </span>
          <div className={styles.importText}>
            <span className={styles.importTitle}>Add from History</span>
            <span className={styles.importDesc}>Find previously visited sites</span>
          </div>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6">
            </polyline>
          </svg>
        </button>
      </div>

      <h3 className="section-title">
        Recent Sources
        <a
          href="#"
          id="view-all-sources"
          className="link"
          onClick={(e: Event): void => {
            e.preventDefault()
            onTabChange?.('library')
          }}
        >
          View All
        </a>
      </h3>
      <div id="sources-list" className={styles.sourcesList}>
        <SourcesList
          notebookId={currentNotebookId}
          onRemoveSource={(sourceId: string): void => {
            void removeSource(sourceId)
          }}
          limit={5}
        />
      </div>

      {/* Picker Modal */}
      {showPicker && (
        <PickerModal
          onAddSources={handleAddSources}
          onClose={handlePickerClose}
        />
      )}
    </section>
  )
}

/**
 * Content extraction function to be injected into pages
 */
function extractPageContent() {
  const title = document.title
  const content = document.body?.textContent || ''
  const links: Array<{ url: string, text: string, context: string }> = []

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (href) {
      try {
        const text = a.textContent?.trim() || ''
        // Get context: text before and after the link
        const parent = a.parentElement
        const parentText = parent?.textContent || ''
        const linkIndex = parentText.indexOf(text)
        const beforeContext = parentText.slice(Math.max(0, linkIndex - 30), linkIndex)
        const afterContext = parentText.slice(linkIndex + text.length, Math.min(parentText.length, linkIndex + text.length + 30))
        const context = beforeContext + text + afterContext

        links.push({
          url: new URL(href, window.location.href).href,
          text,
          context,
        })
      }
      catch {
        // Ignore invalid URLs
      }
    }
  })

  return { title, content, links }
}

// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component with business logic handlers

import { render } from 'preact'
import { App } from './App'
import { initChromeBridge, checkPendingActions } from './chrome-bridge'
import { initTheme } from './hooks/useTheme.tsx'
import { initBroadcastListeners } from './lib/broadcast'
import { migrateLegacyAISettings, initializeDefaultProfile } from '../lib/model-configs.ts'
import {
  createNotebook,
  saveNotebook,
  getNotebooks,
  setActiveNotebookId,
} from '../lib/storage'
import { currentNotebookId, notebooks } from './store'

// ============================================================================
// Context Menu Callback Helpers
// ============================================================================

// Flag to prevent double-processing from race between checkPendingActions and messages
let isProcessingContextMenuAction = false

/**
 * Truncate text at word boundary with ellipsis
 */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.5) {
    return `${truncated.slice(0, lastSpace)}...`
  }
  return `${truncated}...`
}

/**
 * Validate URL string
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

/**
 * Creates a new notebook, sets it as active, updates signals, and rebuilds context menus
 */
async function createNotebookAndSetActive(name: string): Promise<string> {
  const notebook = createNotebook(name)
  await saveNotebook(notebook)
  await setActiveNotebookId(notebook.id)

  // Update signals to refresh UI
  currentNotebookId.value = notebook.id
  notebooks.value = await getNotebooks()

  // Rebuild context menus to include the new notebook
  chrome.runtime.sendMessage({ type: 'REBUILD_CONTEXT_MENUS' }).catch(() => {})

  return notebook.id
}

/**
 * Handle context menu "New Folio + add page" flow
 */
async function handleCreateNotebookAndAddPage(tabId: number): Promise<void> {
  if (isProcessingContextMenuAction) {
    return
  }
  isProcessingContextMenuAction = true

  try {
    const tab = await chrome.tabs.get(tabId)

    // Guard: ensure tab.url is valid
    if (!tab.url || !isValidUrl(tab.url)) {
      console.error('Tab has no valid URL')
      return
    }

    const notebookName = tab.title
      ? `Folio: ${truncateAtWordBoundary(tab.title, 30)}`
      : 'New Folio'

    const notebookId = await createNotebookAndSetActive(notebookName)

    await chrome.runtime.sendMessage({
      type: 'EXTRACT_FROM_URL',
      payload: { url: tab.url, notebookId },
    })
  }
  catch (error) {
    console.error('Failed to create notebook and add page:', error)
  }
  finally {
    isProcessingContextMenuAction = false
  }
}

/**
 * Handle context menu "New Folio + add link" flow
 */
async function handleCreateNotebookAndAddLink(linkUrl: string): Promise<void> {
  if (isProcessingContextMenuAction) {
    return
  }
  isProcessingContextMenuAction = true

  try {
    // Validate URL before processing
    if (!isValidUrl(linkUrl)) {
      console.error('Invalid link URL:', linkUrl)
      return
    }

    const urlHost = new URL(linkUrl).hostname
    const notebookName = `Folio: ${urlHost}`

    const notebookId = await createNotebookAndSetActive(notebookName)

    await chrome.runtime.sendMessage({
      type: 'EXTRACT_FROM_URL',
      payload: { url: linkUrl, notebookId },
    })
  }
  catch (error) {
    console.error('Failed to create notebook and add link:', error)
  }
  finally {
    isProcessingContextMenuAction = false
  }
}

/**
 * Handle context menu "New Folio + add selection links" flow
 */
async function handleCreateNotebookAndAddSelectionLinks(links: string[]): Promise<void> {
  if (isProcessingContextMenuAction) {
    return
  }
  isProcessingContextMenuAction = true

  try {
    // Filter to valid URLs only
    const validLinks = links.filter(isValidUrl)
    if (validLinks.length === 0) {
      console.error('No valid links in selection')
      return
    }

    const notebookName = `Folio: ${validLinks.length} link${validLinks.length > 1 ? 's' : ''}`
    const notebookId = await createNotebookAndSetActive(notebookName)

    // Process links in parallel for better performance
    const results = await Promise.allSettled(
      validLinks.map(linkUrl =>
        chrome.runtime.sendMessage({
          type: 'EXTRACT_FROM_URL',
          payload: { url: linkUrl, notebookId },
        }),
      ),
    )

    // Log any failures
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`Failed to extract ${failures.length} of ${validLinks.length} links`)
    }
  }
  catch (error) {
    console.error('Failed to create notebook and add selection links:', error)
  }
  finally {
    isProcessingContextMenuAction = false
  }
}

// ============================================================================
// Render
// ============================================================================

const appContainer = document.getElementById('app')
if (!appContainer) {
  throw new Error('App container #app not found')
}

// Initialize theme BEFORE rendering to prevent flash of wrong theme
// This is async but we don't await it - the CSS media queries provide
// a reasonable default until storage is read
void initTheme()

// Initialize AI profiles (migrate legacy settings and/or create default profile)
// This runs async in the background - the app can render while this completes
void (async () => {
  try {
    // First, try to migrate any legacy AI settings from previous versions
    const migrated = await migrateLegacyAISettings()
    if (migrated) {
      console.log('[Init] Migrated legacy AI settings to new profile format')
    }

    // Then, ensure a default profile exists (creates Chrome Built-in if none)
    const created = await initializeDefaultProfile()
    if (created) {
      console.log('[Init] Created default Chrome Built-in AI profile')
    }
  }
  catch (error) {
    console.error('[Init] Failed to initialize AI profiles:', error)
  }
})()

// Render App without businessHandlers (now using hooks internally)
render(
  <App
    initialTab="add"
    fabHidden={true}
    onboardingHidden={false}
  />,
  appContainer,
)

// Initialize Chrome bridge AFTER DOM is rendered with proper callbacks
initChromeBridge({
  onSourceAdded: () => {
    // Sources are handled by BroadcastChannel, but we can trigger UI refresh here too
    window.dispatchEvent(new CustomEvent('foliolm:sources-changed'))
  },
  onCreateNotebookAndAddPage: handleCreateNotebookAndAddPage,
  onCreateNotebookAndAddLink: handleCreateNotebookAndAddLink,
  onCreateNotebookAndAddSelectionLinks: handleCreateNotebookAndAddSelectionLinks,
})

// Initialize BroadcastChannel listeners BEFORE checking pending actions
// to ensure all listeners are ready to receive events
initBroadcastListeners()

// Check for pending actions that occurred while sidepanel was closed
void checkPendingActions()

console.log('FolioLM sidepanel initialized')

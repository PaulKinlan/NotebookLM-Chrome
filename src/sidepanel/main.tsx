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
import { notebookDialog, pendingContextMenuAction, initActiveTab } from './store'

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
 * Opens the notebook dialog with a suggested name and sets up the pending action
 */
function openDialogWithPendingAction(
  suggestedName: string,
  action: NonNullable<typeof pendingContextMenuAction.value>,
): void {
  // Set the pending action to execute after notebook creation
  pendingContextMenuAction.value = action

  // Open the dialog with the suggested name
  notebookDialog.value = {
    isOpen: true,
    mode: 'create',
    initialName: suggestedName,
  }
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

    // Suggest a name based on the tab title
    const suggestedName = tab.title
      ? truncateAtWordBoundary(tab.title, 40)
      : 'New Folio'

    // Open dialog with pending action
    openDialogWithPendingAction(suggestedName, { type: 'ADD_PAGE', tabId })
  }
  catch (error) {
    console.error('Failed to handle create notebook and add page:', error)
  }
  finally {
    isProcessingContextMenuAction = false
  }
}

/**
 * Handle context menu "New Folio + add link" flow
 */
function handleCreateNotebookAndAddLink(linkUrl: string): void {
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

    // Suggest a name based on the hostname
    const urlHost = new URL(linkUrl).hostname
    const suggestedName = urlHost

    // Open dialog with pending action
    openDialogWithPendingAction(suggestedName, { type: 'ADD_LINK', linkUrl })
  }
  catch (error) {
    console.error('Failed to handle create notebook and add link:', error)
  }
  finally {
    isProcessingContextMenuAction = false
  }
}

/**
 * Handle context menu "New Folio + add selection links" flow
 */
function handleCreateNotebookAndAddSelectionLinks(links: string[]): void {
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

    // Suggest a name based on number of links
    const suggestedName = `${validLinks.length} link${validLinks.length > 1 ? 's' : ''}`

    // Open dialog with pending action
    openDialogWithPendingAction(suggestedName, { type: 'ADD_SELECTION_LINKS', links: validLinks })
  }
  catch (error) {
    console.error('Failed to handle create notebook and add selection links:', error)
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

// Initialize theme and active tab BEFORE rendering to prevent flash of wrong state
// These are async but we don't await them - reasonable defaults exist until storage is read
void initTheme()
void initActiveTab()

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

// Render App (active tab is initialized from storage via initActiveTab)
render(
  <App
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

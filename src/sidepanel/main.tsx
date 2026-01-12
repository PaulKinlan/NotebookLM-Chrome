// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component and initializes Chrome extension event listeners

import { App } from './App'
import { initChromeBridge, checkPendingActions, type ChromeBridgeCallbacks } from './chrome-bridge'
import { showNotebookDialog } from './services/ui'
import { createNotebook, saveNotebook, setActiveNotebookId, saveSource, createSource } from '../lib/storage'
import { showNotification } from './services/ui'
import { initTheme } from './hooks/useTheme.tsx'
import type { TabExtractContentResponse } from './chrome-bridge'

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

// Render the App component (stateful components handle their own logic)
const appElement = App({
  activeTab: 'add',
  fabHidden: true,
  onboardingHidden: true,
})
appContainer.appendChild(appElement)

// ============================================================================
// Chrome Event Bridge Setup
// ============================================================================

/**
 * Helper to create a notebook from context menu action
 */
async function createNotebookAndSelect(name: string): Promise<string> {
  const notebook = createNotebook(name)
  await saveNotebook(notebook)
  await setActiveNotebookId(notebook.id)
  return notebook.id
}

/**
 * Handle context menu action: CREATE_NOTEBOOK_AND_ADD_PAGE
 */
async function handleCreateNotebookAndAddPage(tabId: number): Promise<void> {
  const name = await showNotebookDialog({
    title: 'New Folio',
    placeholder: 'Enter folio name...',
    confirmText: 'Create',
  })
  if (!name) return

  const notebookId = await createNotebookAndSelect(name)

  // Extract and add the page
  try {
    const result: unknown = await chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
    })

    if (isTabExtractContentResponse(result)) {
      const source = createSource(
        notebookId,
        'tab',
        result.url,
        result.title,
        result.markdown,
        result.links,
      )
      await saveSource(source)
      showNotification('Source added')
    }
  }
  catch (error) {
    console.error('Failed to add page:', error)
    showNotification('Failed to add page')
  }
}

/**
 * Handle context menu action: CREATE_NOTEBOOK_AND_ADD_LINK
 */
async function handleCreateNotebookAndAddLink(linkUrl: string): Promise<void> {
  const name = await showNotebookDialog({
    title: 'New Folio',
    placeholder: 'Enter folio name...',
    confirmText: 'Create',
  })
  if (!name) return

  const notebookId = await createNotebookAndSelect(name)

  // Add the link as a source
  const source = createSource(
    notebookId,
    'manual',
    linkUrl,
    linkUrl,
    `Link: ${linkUrl}`,
  )
  await saveSource(source)
  showNotification('Source added')
}

/**
 * Handle context menu action: CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS
 */
async function handleCreateNotebookAndAddSelectionLinks(links: string[]): Promise<void> {
  const name = await showNotebookDialog({
    title: 'New Folio',
    placeholder: 'Enter folio name...',
    confirmText: 'Create',
  })
  if (!name) return

  const notebookId = await createNotebookAndSelect(name)

  // Add all links as sources
  for (const link of links) {
    const source = createSource(
      notebookId,
      'manual',
      link,
      link,
      `Link: ${link}`,
    )
    await saveSource(source)
  }
  showNotification(`Added ${links.length} source${links.length > 1 ? 's' : ''}`)
}

/**
 * Type guard for tab extract content response
 */
function isTabExtractContentResponse(value: unknown): value is TabExtractContentResponse {
  return (
    typeof value === 'object'
    && value !== null
    && 'url' in value
    && 'title' in value
    && 'markdown' in value
    && typeof value.url === 'string'
    && typeof value.title === 'string'
    && typeof value.markdown === 'string'
  )
}

/**
 * Callbacks for Chrome event bridge
 */
const chromeBridgeCallbacks: ChromeBridgeCallbacks = {
  onSourceAdded: () => {
    // Sources will be reloaded by the useSources hook
    showNotification('Source added')
  },
  onCreateNotebookAndAddPage: handleCreateNotebookAndAddPage,
  onCreateNotebookAndAddLink: handleCreateNotebookAndAddLink,
  onCreateNotebookAndAddSelectionLinks: handleCreateNotebookAndAddSelectionLinks,
  onTabsHighlighted: () => {
    // Components using hooks will update automatically
  },
  onTabsChanged: () => {
    // Components using hooks will update automatically
  },
}

// Initialize Chrome event bridge
initChromeBridge(chromeBridgeCallbacks)

// Check for pending actions from context menu (in case sidepanel was just opened)
void checkPendingActions()

console.log('FolioLM sidepanel initialized')

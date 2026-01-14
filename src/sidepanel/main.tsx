// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component using Preact and initializes Chrome extension event listeners

import './global.css'
import { render } from 'preact'
import { App, type AppCallbacks } from './App'
import { initTheme } from './hooks/useTheme.tsx'
import { initChromeBridge, checkPendingActions, type ChromeBridgeCallbacks } from './chrome-bridge'
import { createNotebook, saveNotebook, setActiveNotebookId, saveSource, createSource } from '../lib/storage'
import type { TabExtractContentResponse } from './chrome-bridge'

// ============================================================================
// Dialog/Notification State (for Chrome bridge callbacks)
// ============================================================================

let appCallbacks: AppCallbacks | null = null

/**
 * Get the app callbacks - used by Chrome bridge callbacks
 */
function getAppCallbacks(): AppCallbacks {
  if (!appCallbacks) {
    throw new Error('App callbacks not initialized - App component must be rendered first')
  }
  return appCallbacks
}

// ============================================================================
// Render
// ============================================================================

// Initialize theme system
initTheme().catch((error) => {
  console.error('Failed to initialize theme:', error)
})

const appContainer = document.getElementById('app')
if (!appContainer) {
  throw new Error('App container #app not found')
}

// Initialize theme BEFORE rendering to prevent flash of wrong theme
// This is async but we don't await it - the CSS media queries provide
// a reasonable default until storage is read
void initTheme()

// Create callback functions that will be passed to App
const showNotebook: AppCallbacks['showNotebook'] = (options) => {
  return getAppCallbacks().showNotebook(options)
}

const showNotification: AppCallbacks['showNotification'] = (message, type) => {
  return getAppCallbacks().showNotification(message, type)
}

// Render the App component using Preact's render function
render(
  <App
    activeTab="add"
    fabHidden={true}
    onboardingHidden={true}
    onProvideCallbacks={(callbacks: AppCallbacks) => {
      appCallbacks = callbacks
    }}
  />,
  appContainer,
)

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
  const name = await showNotebook({
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
    showNotification('Failed to add page', 'error')
  }
}

/**
 * Handle context menu action: CREATE_NOTEBOOK_AND_ADD_LINK
 */
async function handleCreateNotebookAndAddLink(linkUrl: string): Promise<void> {
  const name = await showNotebook({
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
  const name = await showNotebook({
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

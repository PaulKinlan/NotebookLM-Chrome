/**
 * Chrome Bridge
 *
 * Bridges Chrome extension APIs with the application.
 * Handles global Chrome event listeners that must persist
 * regardless of component lifecycle.
 *
 * This module isolates Chrome-specific concerns from the
 * stateful component architecture.
 */

import type { Message, ExtractedLink } from '../types/index.ts'

// Type for tab extract content response
export interface TabExtractContentResponse {
  url: string
  title: string
  markdown: string
  links?: ExtractedLink[]
}

// Type for URL extract response
export interface UrlExtractResponse {
  url?: string
  title?: string
  content?: string
  markdown?: string
  links?: ExtractedLink[]
  success?: boolean
}

// Type guards for Chrome message responses
export function isTabExtractContentResponse(value: unknown): value is TabExtractContentResponse {
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

export function isUrlExtractResponse(value: unknown): value is UrlExtractResponse {
  return (
    typeof value === 'object'
    && value !== null
  )
}

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Callbacks that the bridge will invoke when Chrome events occur.
 * Components/services can register these callbacks.
 */
export interface ChromeBridgeCallbacks {
  /** Called when sources are added (e.g., from background script) */
  onSourceAdded?: () => void
  /** Called when a context menu action needs to create a notebook and add a page */
  onCreateNotebookAndAddPage?: (tabId: number) => Promise<void>
  /** Called when a context menu action needs to create a notebook and add a link */
  onCreateNotebookAndAddLink?: (linkUrl: string) => Promise<void>
  /** Called when a context menu action needs to create a notebook and add multiple links */
  onCreateNotebookAndAddSelectionLinks?: (links: string[]) => Promise<void>
  /** Called when tabs are highlighted (for updating UI) */
  onTabsHighlighted?: () => void
  /** Called when tabs are created/removed (for updating counts) */
  onTabsChanged?: () => void
}

// ============================================================================
// State
// ============================================================================

let callbacks: ChromeBridgeCallbacks = {}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the Chrome bridge with callbacks.
 * Call this once during app initialization.
 */
export function initChromeBridge(bridgeCallbacks: ChromeBridgeCallbacks): void {
  callbacks = bridgeCallbacks
  setupMessageListener()
  setupTabsListeners()
}

/**
 * Check for pending actions from context menu.
 * Call this after initialization to handle actions that
 * occurred while the sidepanel was closed.
 */
export async function checkPendingActions(): Promise<void> {
  try {
    const result = await chrome.storage.session.get('pendingAction')
    if (result.pendingAction) {
      // Clear the pending action first to prevent duplicate processing
      await chrome.storage.session.remove('pendingAction')

      const { type, payload } = result.pendingAction as {
        type: string
        payload: { tabId?: number, linkUrl?: string, links?: string[] }
      }

      if (type === 'CREATE_NOTEBOOK_AND_ADD_PAGE' && payload.tabId) {
        await callbacks.onCreateNotebookAndAddPage?.(payload.tabId)
      }
      else if (type === 'CREATE_NOTEBOOK_AND_ADD_LINK' && payload.linkUrl) {
        await callbacks.onCreateNotebookAndAddLink?.(payload.linkUrl)
      }
      else if (type === 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS' && payload.links) {
        await callbacks.onCreateNotebookAndAddSelectionLinks?.(payload.links)
      }
    }
  }
  catch (error) {
    console.error('Failed to check pending action:', error)
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'SOURCE_ADDED') {
      callbacks.onSourceAdded?.()
    }
    else if (message.type === 'CREATE_NOTEBOOK_AND_ADD_PAGE') {
      chrome.storage.session.remove('pendingAction').catch(() => {})
      const payload = message.payload as { tabId?: number } | undefined
      if (payload?.tabId !== undefined) {
        void callbacks.onCreateNotebookAndAddPage?.(payload.tabId)
      }
    }
    else if (message.type === 'CREATE_NOTEBOOK_AND_ADD_LINK') {
      chrome.storage.session.remove('pendingAction').catch(() => {})
      const payload = message.payload as { linkUrl?: string } | undefined
      if (payload?.linkUrl !== undefined) {
        void callbacks.onCreateNotebookAndAddLink?.(payload.linkUrl)
      }
    }
    else if (message.type === 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS') {
      chrome.storage.session.remove('pendingAction').catch(() => {})
      const payload = message.payload as { links?: string[] } | undefined
      if (payload?.links !== undefined) {
        void callbacks.onCreateNotebookAndAddSelectionLinks?.(payload.links)
      }
    }
  })
}

function setupTabsListeners(): void {
  chrome.tabs.onHighlighted.addListener(() => {
    callbacks.onTabsHighlighted?.()
  })

  chrome.tabs.onCreated.addListener(() => {
    callbacks.onTabsChanged?.()
  })

  chrome.tabs.onRemoved.addListener(() => {
    callbacks.onTabsChanged?.()
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.title) {
      callbacks.onTabsChanged?.()
    }
  })
}

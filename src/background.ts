import type { Message, ContentExtractionResult, ExtractedLink, BackgroundTransform, TransformationType, Source } from './types/index.ts'
import {
  createSource,
  saveSource,
  getNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
  getSource,
  getSourcesByNotebook,
  getBackgroundTransforms,
  getPendingBackgroundTransforms,
  getBackgroundTransform,
  saveBackgroundTransform,
  createBackgroundTransform,
} from './lib/storage.ts'
import {
  generatePodcastScript,
  generateQuiz,
  generateKeyTakeaways,
  generateEmailSummary,
  generateSlideDeck,
  generateReport,
  generateDataTable,
  generateMindMap,
  generateFlashcards,
  generateTimeline,
  generateGlossary,
  generateComparison,
  generateFAQ,
  generateActionItems,
  generateExecutiveBrief,
  generateStudyGuide,
  generateProsCons,
  generateCitationList,
  generateOutline,
} from './lib/ai.ts'
// Note: getLinksInSelection from './lib/selection-links.ts' is not used here
// because chrome.scripting.executeScript requires a self-contained function.
// The function is inlined in extractLinksFromSelection() below.

/**
 * Response from content script's extractContent action
 */
interface ContentScriptResponse {
  url: string
  title: string
  markdown: string
  textContent?: string
  content?: string
  links?: ExtractedLink[]
}

/**
 * Message sent to content script
 */
interface ContentScriptMessage {
  action: 'ping' | 'extractContent'
}

// ============================================================================
// Side Panel Setup
// ============================================================================

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

// ============================================================================
// Keyboard Command Handlers
// ============================================================================

chrome.commands.onCommand.addListener((command, tab) => {
  void (async () => {
    switch (command) {
      case 'add-page-to-notebook':
        await handleAddPageCommand(tab)
        break
      case 'create-new-notebook':
        await handleCreateNotebookCommand(tab)
        break
      case 'add-selection-as-source':
        await handleAddSelectionCommand(tab)
        break
    }
  })()
})

async function handleAddPageCommand(tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return

  const notebookId = await getActiveNotebookId()
  if (!notebookId) {
    // No active notebook - open side panel and prompt to create one
    await chrome.sidePanel.open({ tabId: tab.id })
    await chrome.storage.session.set({
      pendingAction: {
        type: 'CREATE_NOTEBOOK_AND_ADD_PAGE',
        payload: { tabId: tab.id },
      },
    })
    chrome.runtime
      .sendMessage({
        type: 'CREATE_NOTEBOOK_AND_ADD_PAGE',
        payload: { tabId: tab.id },
      })
      .catch(() => {})
    return
  }

  // Open side panel and add page to active notebook
  await chrome.sidePanel.open({ tabId: tab.id })
  await handleAddPageFromContextMenu(tab.id, notebookId)
}

async function handleCreateNotebookCommand(tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return

  // Open side panel and trigger new notebook creation
  await chrome.sidePanel.open({ tabId: tab.id })
  await chrome.storage.session.set({
    pendingAction: {
      type: 'CREATE_NOTEBOOK',
    },
  })
  chrome.runtime
    .sendMessage({ type: 'CREATE_NOTEBOOK' })
    .catch(() => {})
}

async function handleAddSelectionCommand(tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return

  const notebookId = await getActiveNotebookId()
  if (!notebookId) {
    // No active notebook - open side panel and prompt to create one with selection
    await chrome.sidePanel.open({ tabId: tab.id })
    const selection = await extractSelectionText(tab.id)
    if (selection) {
      await chrome.storage.session.set({
        pendingAction: {
          type: 'CREATE_NOTEBOOK_AND_ADD_SELECTION',
          payload: { text: selection.text, url: selection.url, title: selection.title },
        },
      })
      chrome.runtime
        .sendMessage({
          type: 'CREATE_NOTEBOOK_AND_ADD_SELECTION',
          payload: { text: selection.text, url: selection.url, title: selection.title },
        })
        .catch(() => {})
    }
    return
  }

  // Extract selection and add as source
  await chrome.sidePanel.open({ tabId: tab.id })
  const selection = await extractSelectionText(tab.id)
  if (selection && selection.text.trim()) {
    const source = createSource(
      notebookId,
      'text',
      selection.url,
      selection.title || 'Selected Text',
      selection.text,
    )
    await saveSource(source)
    chrome.runtime
      .sendMessage({ type: 'SOURCE_ADDED', payload: source })
      .catch(() => {})
  }
}

/**
 * Type guard to validate selection extraction result
 */
function isSelectionResult(value: unknown): value is { text: string, url: string, title: string } {
  return (
    typeof value === 'object'
    && value !== null
    && 'text' in value
    && 'url' in value
    && 'title' in value
    && typeof (value as { text: unknown }).text === 'string'
    && typeof (value as { url: unknown }).url === 'string'
    && typeof (value as { title: unknown }).title === 'string'
  )
}

async function extractSelectionText(tabId: number): Promise<{ text: string, url: string, title: string } | null> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selection = window.getSelection()
        return {
          text: selection?.toString() || '',
          url: window.location.href,
          title: document.title,
        }
      },
    })

    if (!result || result.length === 0) {
      return null
    }

    const value = result[0].result
    if (isSelectionResult(value)) {
      return value
    }
    return null
  }
  catch (error) {
    console.error('Error extracting selection text:', error)
    return null
  }
}

// ============================================================================
// Context Menu Setup
// ============================================================================

// Menu ID prefixes
const PAGE_MENU_PREFIX = 'add-page-to-'
const LINK_MENU_PREFIX = 'add-link-to-'
const IMAGE_MENU_PREFIX = 'add-image-to-'
const SELECTION_LINKS_MENU_PREFIX = 'add-selection-links-to-'
const NEW_NOTEBOOK_SUFFIX = 'new-notebook'

// Build context menus on install and when notebooks change
chrome.runtime.onInstalled.addListener(() => {
  void buildContextMenus()
})

// Listen for requests to rebuild context menus (when notebooks change)
// This is needed because IndexedDB changes don't trigger chrome.storage.onChanged

async function buildContextMenus(): Promise<void> {
  // Remove all existing menus first
  void chrome.contextMenus.removeAll()

  const notebooks = await getNotebooks()

  // Create parent menu for pages
  chrome.contextMenus.create({
    id: 'add-page-parent',
    title: 'Add page to Folio',
    contexts: ['page'],
  })

  // Create parent menu for links
  chrome.contextMenus.create({
    id: 'add-link-parent',
    title: 'Add link to Folio',
    contexts: ['link'],
  })

  // Add notebook items for pages
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${PAGE_MENU_PREFIX}${notebook.id}`,
      parentId: 'add-page-parent',
      title: notebook.name,
      contexts: ['page'],
    })
  }

  // Add separator and "New Notebook" for pages
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: 'page-separator',
      parentId: 'add-page-parent',
      type: 'separator',
      contexts: ['page'],
    })
  }

  chrome.contextMenus.create({
    id: `${PAGE_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: 'add-page-parent',
    title: '+ New Folio...',
    contexts: ['page'],
  })

  // Add notebook items for links
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${LINK_MENU_PREFIX}${notebook.id}`,
      parentId: 'add-link-parent',
      title: notebook.name,
      contexts: ['link'],
    })
  }

  // Add separator and "New Notebook" for links
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: 'link-separator',
      parentId: 'add-link-parent',
      type: 'separator',
      contexts: ['link'],
    })
  }

  chrome.contextMenus.create({
    id: `${LINK_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: 'add-link-parent',
    title: '+ New Folio...',
    contexts: ['link'],
  })

  // Create parent menu for images
  chrome.contextMenus.create({
    id: 'add-image-parent',
    title: 'Add image to Folio',
    contexts: ['image'],
  })

  // Add notebook items for images
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${IMAGE_MENU_PREFIX}${notebook.id}`,
      parentId: 'add-image-parent',
      title: notebook.name,
      contexts: ['image'],
    })
  }

  // Add separator and "New Notebook" for images
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: 'image-separator',
      parentId: 'add-image-parent',
      type: 'separator',
      contexts: ['image'],
    })
  }

  chrome.contextMenus.create({
    id: `${IMAGE_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: 'add-image-parent',
    title: '+ New Folio...',
    contexts: ['image'],
  })

  // Create parent menu for selection links
  chrome.contextMenus.create({
    id: 'add-selection-links-parent',
    title: 'Add links in selection to Folio',
    contexts: ['selection'],
  })

  // Add notebook items for selection links
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${SELECTION_LINKS_MENU_PREFIX}${notebook.id}`,
      parentId: 'add-selection-links-parent',
      title: notebook.name,
      contexts: ['selection'],
    })
  }

  // Add separator and "New Notebook" for selection links
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: 'selection-links-separator',
      parentId: 'add-selection-links-parent',
      type: 'separator',
      contexts: ['selection'],
    })
  }

  chrome.contextMenus.create({
    id: `${SELECTION_LINKS_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: 'add-selection-links-parent',
    title: '+ New Folio...',
    contexts: ['selection'],
  })
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    // Type guard for menuItemId
    const menuId = typeof info.menuItemId === 'string' ? info.menuItemId : String(info.menuItemId)

    // For selection links, we must extract links BEFORE the side panel fully opens
    // because opening the panel can cause the page to lose focus and clear the selection.
    // Start the panel opening (required for user gesture), then extract links in parallel.
    let selectionLinksPromise: Promise<string[]> | null = null
    if (menuId.startsWith(SELECTION_LINKS_MENU_PREFIX) && tab?.id) {
      // Start extraction immediately - don't await yet
      selectionLinksPromise = extractLinksFromSelection(tab.id)
    }

    // Open side panel (must be called immediately in response to user gesture)
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }

    // Now await the links extraction if we started it
    const selectionLinks = selectionLinksPromise ? await selectionLinksPromise : null

    // Handle page menu clicks
    if (menuId.startsWith(PAGE_MENU_PREFIX) && tab?.id) {
      const notebookIdOrNew = menuId.replace(PAGE_MENU_PREFIX, '')

      if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
        // Store pending action in session storage for side panel to pick up
        await chrome.storage.session.set({
          pendingAction: {
            type: 'CREATE_NOTEBOOK_AND_ADD_PAGE',
            payload: { tabId: tab.id },
          },
        })
        // Also try sending message in case side panel is already open
        chrome.runtime
          .sendMessage({
            type: 'CREATE_NOTEBOOK_AND_ADD_PAGE',
            payload: { tabId: tab.id },
          })
          .catch(() => {})
      }
      else {
        await handleAddPageFromContextMenu(tab.id, notebookIdOrNew)
      }
    }

    // Handle link menu clicks
    if (menuId.startsWith(LINK_MENU_PREFIX) && info.linkUrl) {
      const notebookIdOrNew = menuId.replace(LINK_MENU_PREFIX, '')

      if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
        // Store pending action in session storage for side panel to pick up
        await chrome.storage.session.set({
          pendingAction: {
            type: 'CREATE_NOTEBOOK_AND_ADD_LINK',
            payload: { linkUrl: info.linkUrl },
          },
        })
        // Also try sending message in case side panel is already open
        chrome.runtime
          .sendMessage({
            type: 'CREATE_NOTEBOOK_AND_ADD_LINK',
            payload: { linkUrl: info.linkUrl },
          })
          .catch(() => {})
      }
      else {
        await handleAddLinkFromContextMenu(info.linkUrl, notebookIdOrNew)
      }
    }

    // Handle image menu clicks
    if (menuId.startsWith(IMAGE_MENU_PREFIX) && info.srcUrl) {
      const notebookIdOrNew = menuId.replace(IMAGE_MENU_PREFIX, '')

      if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
        // Store pending action in session storage for side panel to pick up
        await chrome.storage.session.set({
          pendingAction: {
            type: 'CREATE_NOTEBOOK_AND_ADD_IMAGE',
            payload: { imageUrl: info.srcUrl, pageUrl: info.pageUrl, pageTitle: tab?.title },
          },
        })
        // Also try sending message in case side panel is already open
        chrome.runtime
          .sendMessage({
            type: 'CREATE_NOTEBOOK_AND_ADD_IMAGE',
            payload: { imageUrl: info.srcUrl, pageUrl: info.pageUrl, pageTitle: tab?.title },
          })
          .catch(() => {})
      }
      else {
        await handleAddImageFromContextMenu(info.srcUrl, notebookIdOrNew, info.pageUrl, tab?.title)
      }
    }

    // Handle selection links menu clicks (links already extracted above)
    if (menuId.startsWith(SELECTION_LINKS_MENU_PREFIX) && tab?.id && selectionLinks !== null) {
      const notebookIdOrNew = menuId.replace(SELECTION_LINKS_MENU_PREFIX, '')

      if (selectionLinks.length === 0) {
        console.log('No links found in selection')
        return
      }

      if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
        // Store pending action in session storage for side panel to pick up
        await chrome.storage.session.set({
          pendingAction: {
            type: 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS',
            payload: { links: selectionLinks },
          },
        })
        // Also try sending message in case side panel is already open
        chrome.runtime
          .sendMessage({
            type: 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS',
            payload: { links: selectionLinks },
          })
          .catch(() => {})
      }
      else {
        await handleAddSelectionLinksFromContextMenu(selectionLinks, notebookIdOrNew)
      }
    }
  })()
})

async function handleAddPageFromContextMenu(
  tabId: number,
  notebookId: string,
): Promise<void> {
  try {
    await ensureContentScript(tabId)
    const result = await chrome.tabs.sendMessage<ContentScriptMessage, ContentScriptResponse>(
      tabId,
      {
        action: 'extractContent',
      },
    )

    if (result) {
      const source = createSource(
        notebookId,
        'tab',
        result.url,
        result.title,
        result.markdown,
        result.links,
      )
      await saveSource(source)

      // Set as active notebook
      await setActiveNotebookId(notebookId)

      // Notify the side panel to refresh
      chrome.runtime
        .sendMessage({ type: 'SOURCE_ADDED', payload: source })
        .catch(() => {
          // Side panel may not be listening yet
        })
    }
  }
  catch (error) {
    console.error('Failed to add page from context menu:', error)
  }
}

async function handleAddLinkFromContextMenu(
  linkUrl: string,
  notebookId: string,
): Promise<void> {
  try {
    const result = await extractContentFromUrl(linkUrl)
    if (result) {
      const source = createSource(
        notebookId,
        'tab',
        result.url,
        result.title,
        result.content,
        result.links,
      )
      await saveSource(source)

      // Set as active notebook
      await setActiveNotebookId(notebookId)

      // Notify the side panel to refresh its source list
      chrome.runtime
        .sendMessage({ type: 'SOURCE_ADDED', payload: source })
        .catch(() => {
          // Side panel may not be listening yet
        })
    }
  }
  catch (error) {
    console.error('Failed to add link from context menu:', error)
  }
}

async function handleAddImageFromContextMenu(
  imageUrl: string,
  notebookId: string,
  pageUrl?: string,
  pageTitle?: string,
): Promise<void> {
  try {
    // Extract a title from the image URL filename
    const urlObj = new URL(imageUrl)
    const filename = urlObj.pathname.split('/').pop() || 'image'
    const title = pageTitle ? `Image from ${pageTitle}` : filename

    // Create content description for the image
    const content = pageUrl
      ? `Image: ${filename}\nSource page: ${pageUrl}`
      : `Image: ${filename}`

    const source = createSource(
      notebookId,
      'image',
      imageUrl,
      title,
      content,
    )
    await saveSource(source)

    // Set as active notebook
    await setActiveNotebookId(notebookId)

    // Notify the side panel to refresh its source list
    chrome.runtime
      .sendMessage({ type: 'SOURCE_ADDED', payload: source })
      .catch(() => {
        // Side panel may not be listening yet
      })
  }
  catch (error) {
    console.error('Failed to add image from context menu:', error)
  }
}

/**
 * Extract all links from the current text selection in a tab.
 * Uses chrome.scripting.executeScript to run a function in the page context.
 */
async function extractLinksFromSelection(tabId: number): Promise<string[]> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      // Inline function to avoid issues with module dependencies not being available in page context
      func: () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) {
          return []
        }

        const linksSet = new Set<string>()
        const range = selection.getRangeAt(0)

        // Strategy 1: Check if selection is inside or contains anchor elements
        // by walking up from the common ancestor and down through descendants
        const container = range.commonAncestorContainer
        let searchRoot: Element | null = null

        if (container.nodeType === Node.TEXT_NODE) {
          searchRoot = container.parentElement
        }
        else if (container.nodeType === Node.ELEMENT_NODE) {
          searchRoot = container as Element
        }

        if (searchRoot) {
          // Check if we're inside an anchor (selection is within link text)
          const closestAnchor = searchRoot.closest('a[href]')
          if (closestAnchor instanceof HTMLAnchorElement) {
            const href = closestAnchor.href // Use .href property for resolved URL
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
              linksSet.add(href)
            }
          }

          // Find all anchors within the search root that intersect with the selection
          const allAnchors = searchRoot.querySelectorAll('a[href]')
          for (const anchor of allAnchors) {
            if (!(anchor instanceof HTMLAnchorElement)) continue

            // Check if this anchor intersects with the selection
            if (selection.containsNode(anchor, true)) {
              const href = anchor.href // Use .href property for resolved URL
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                linksSet.add(href)
              }
            }
          }
        }

        // Strategy 2: Also check parent of search root in case selection spans siblings
        if (searchRoot?.parentElement) {
          const parentAnchors = searchRoot.parentElement.querySelectorAll('a[href]')
          for (const anchor of parentAnchors) {
            if (!(anchor instanceof HTMLAnchorElement)) continue

            if (selection.containsNode(anchor, true)) {
              const href = anchor.href
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                linksSet.add(href)
              }
            }
          }
        }

        // Strategy 3: Walk through selection ranges and check each text node's ancestors
        for (let i = 0; i < selection.rangeCount; i++) {
          const r = selection.getRangeAt(i)

          // Check start container's anchor ancestry
          let node: Node | null = r.startContainer
          while (node && node !== document.body) {
            if (node instanceof HTMLAnchorElement && node.href) {
              const href = node.href
              if (href.startsWith('http://') || href.startsWith('https://')) {
                linksSet.add(href)
              }
            }
            node = node.parentNode
          }

          // Check end container's anchor ancestry
          node = r.endContainer
          while (node && node !== document.body) {
            if (node instanceof HTMLAnchorElement && node.href) {
              const href = node.href
              if (href.startsWith('http://') || href.startsWith('https://')) {
                linksSet.add(href)
              }
            }
            node = node.parentNode
          }
        }

        return Array.from(linksSet)
      },
    })

    if (!result || result.length === 0) {
      return []
    }

    // Type guard for script result
    const scriptResult = result[0].result
    return Array.isArray(scriptResult) ? scriptResult : []
  }
  catch (error) {
    console.error('Error extracting links from selection:', error)
    return []
  }
}

/**
 * Handle adding multiple links from a text selection to a notebook.
 * Extracts content from each link and saves them as sources.
 * Processes all links in parallel - each completes independently.
 */
async function handleAddSelectionLinksFromContextMenu(
  links: string[],
  notebookId: string,
): Promise<void> {
  // Set as active notebook first
  await setActiveNotebookId(notebookId)

  // Process all links in parallel - each completes independently
  const results = await Promise.allSettled(
    links.map(async (linkUrl) => {
      const result = await extractContentFromUrl(linkUrl)
      if (result) {
        const source = createSource(
          notebookId,
          'tab',
          result.url,
          result.title,
          result.content,
          result.links,
        )
        await saveSource(source)

        // Notify the side panel to refresh its source list
        chrome.runtime
          .sendMessage({ type: 'SOURCE_ADDED', payload: source })
          .catch(() => {
            // Side panel may not be listening yet
          })
        return source
      }
      return null
    }),
  )

  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    console.warn(`Failed to extract ${failures.length} of ${links.length} links`)
  }
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(console.error)
    return true
  },
)

// User-defined type guard for ContentExtractionResult
function isContentExtractionResult(obj: unknown): obj is ContentExtractionResult {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }

  // Use 'in' operator with type narrowing
  return (
    'url' in obj
    && 'content' in obj
    && 'title' in obj
    && 'textContent' in obj
    && typeof obj.url === 'string'
    && typeof obj.content === 'string'
    && typeof obj.title === 'string'
    && typeof obj.textContent === 'string'
  )
}

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'EXTRACT_CONTENT':
      return extractContentFromActiveTab()
    case 'EXTRACT_FROM_URL': {
      // Type-safe payload extraction - support both string URL and object with { url, notebookId }
      const payload = message.payload

      if (typeof payload === 'string') {
        // Old format: just URL string
        return extractContentFromUrl(payload)
      }

      if (payload && typeof payload === 'object' && 'url' in payload && typeof payload.url === 'string') {
        const { url, notebookId } = payload as { url: string, notebookId?: string }
        const result = await extractContentFromUrl(url)

        // If notebookId is provided, create and save the source
        if (result && notebookId) {
          const source = createSource(
            notebookId,
            'tab',
            result.url,
            result.title,
            result.content,
            result.links,
          )
          await saveSource(source)
          await setActiveNotebookId(notebookId)
          chrome.runtime
            .sendMessage({ type: 'SOURCE_ADDED', payload: source })
            .catch(() => {})
          return { success: true, source }
        }
        return result
      }

      return null
    }
    case 'ADD_SOURCE': {
      // Type guard for ContentExtractionResult
      const payload = message.payload
      if (isContentExtractionResult(payload)) {
        return handleAddSource(payload)
      }
      return null
    }
    case 'REBUILD_CONTEXT_MENUS':
      await buildContextMenus()
      return true
    // Browser tools
    case 'LIST_WINDOWS':
      return handleListWindows()
    case 'LIST_TABS': {
      // Type guard for windowId payload
      const payload = message.payload
      const windowId = (payload && typeof payload === 'object' && 'windowId' in payload)
        ? (typeof payload.windowId === 'number' ? payload.windowId : undefined)
        : undefined
      return handleListTabs(windowId !== undefined ? { windowId } : undefined)
    }
    case 'LIST_TAB_GROUPS':
      return handleListTabGroups()
    case 'READ_PAGE_CONTENT': {
      // Type guard for tabId payload
      const payload = message.payload
      if (payload && typeof payload === 'object' && 'tabId' in payload && typeof payload.tabId === 'number') {
        return handleReadPageContent({ tabId: payload.tabId })
      }
      return null
    }
    case 'REFRESH_SOURCE': {
      const payload = message.payload
      if (payload && typeof payload === 'object' && 'sourceId' in payload && typeof payload.sourceId === 'string') {
        return handleRefreshSource(payload.sourceId)
      }
      return null
    }
    case 'REFRESH_ALL_SOURCES': {
      const payload = message.payload
      if (payload && typeof payload === 'object' && 'notebookId' in payload && typeof payload.notebookId === 'string') {
        return handleRefreshAllSources(payload.notebookId)
      }
      return null
    }
    // Background transformation messages
    case 'START_TRANSFORM': {
      const payload = message.payload
      if (
        payload
        && typeof payload === 'object'
        && 'notebookId' in payload
        && 'type' in payload
        && 'sourceIds' in payload
        && typeof payload.notebookId === 'string'
        && typeof payload.type === 'string'
        && Array.isArray(payload.sourceIds)
      ) {
        return handleStartTransform(
          payload.notebookId,
          payload.type as TransformationType,
          payload.sourceIds as string[],
        )
      }
      return null
    }
    case 'CANCEL_TRANSFORM': {
      const payload = message.payload
      if (payload && typeof payload === 'object' && 'transformId' in payload && typeof payload.transformId === 'string') {
        return handleCancelTransform(payload.transformId)
      }
      return null
    }
    case 'GET_PENDING_TRANSFORMS': {
      const payload = message.payload
      const notebookId = payload && typeof payload === 'object' && 'notebookId' in payload
        ? (typeof payload.notebookId === 'string' ? payload.notebookId : undefined)
        : undefined
      return handleGetPendingTransforms(notebookId)
    }
    default:
      return null
  }
}

async function extractContentFromActiveTab(): Promise<ContentExtractionResult | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id || !tab.url) {
    return null
  }

  try {
    // Wait for the tab to finish loading (resolves immediately if already loaded)
    await waitForTabLoad(tab.id)

    // Ensure content script is injected
    await ensureContentScript(tab.id)

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage<ContentScriptMessage, ContentScriptResponse>(
      tab.id,
      {
        action: 'extractContent',
      },
    )

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
      links: result.links,
    }
  }
  catch (error) {
    console.error('Failed to extract content:', error)
    return null
  }
}

async function extractContentFromUrl(
  url: string,
): Promise<ContentExtractionResult | null> {
  try {
    // Create a new tab to load the URL
    const tab = await chrome.tabs.create({ url, active: false })

    if (!tab.id) {
      return null
    }

    // Wait for the tab to finish loading
    await waitForTabLoad(tab.id)

    // Ensure content script is injected
    await ensureContentScript(tab.id)

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage<ContentScriptMessage, ContentScriptResponse>(
      tab.id,
      {
        action: 'extractContent',
      },
    )

    // Close the tab
    await chrome.tabs.remove(tab.id)

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
      links: result.links,
    }
  }
  catch (error) {
    console.error('Failed to extract content from URL:', error)
    return null
  }
}

async function handleRefreshSource(sourceId: string): Promise<{ success: boolean, error?: string }> {
  try {
    const source = await getSource(sourceId)
    if (!source) {
      return { success: false, error: 'Source not found' }
    }

    // Re-extract content from the URL
    const result = await extractContentFromUrl(source.url)
    if (!result) {
      return { success: false, error: 'Failed to extract content' }
    }

    // Update the source with new content while preserving metadata
    const updatedSource = {
      ...source,
      title: result.title,
      content: result.content,
      links: result.links,
      metadata: {
        ...source.metadata,
        wordCount: result.content.split(/\s+/).filter(Boolean).length,
      },
      updatedAt: Date.now(),
    }

    await saveSource(updatedSource)

    // Notify that source was refreshed
    chrome.runtime
      .sendMessage({ type: 'SOURCE_REFRESHED', payload: updatedSource })
      .catch(() => {})

    return { success: true }
  }
  catch (error) {
    console.error('Failed to refresh source:', error)
    return { success: false, error: String(error) }
  }
}

async function handleRefreshAllSources(notebookId: string): Promise<{ success: boolean, refreshedCount: number, errors: string[] }> {
  const errors: string[] = []
  let refreshedCount = 0

  try {
    const sources = await getSourcesByNotebook(notebookId)

    for (const source of sources) {
      // Skip manual/text sources that don't have URLs to refresh
      if (source.type === 'manual' || source.type === 'text') {
        continue
      }

      const result = await handleRefreshSource(source.id)
      if (result.success) {
        refreshedCount++
      }
      else if (result.error) {
        errors.push(`${source.title}: ${result.error}`)
      }
    }

    return { success: true, refreshedCount, errors }
  }
  catch (error) {
    console.error('Failed to refresh all sources:', error)
    return { success: false, refreshedCount, errors: [...errors, String(error)] }
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  // Inject directly without ping - much faster for parallel operations
  // The injectContentScript function is idempotent (checks if already extracted)
  await chrome.scripting.executeScript({
    target: { tabId },
    func: injectContentScript,
  })
}

// Inline content script injection for pages loaded before extension install
function injectContentScript(): void {
  // Use a document attribute to track extraction state (type-safe)
  const EXTRACTION_ATTR = 'data-notebook-extracted'

  const isExtracted = (): boolean => {
    return document.documentElement.hasAttribute(EXTRACTION_ATTR)
  }

  const markExtracted = (): void => {
    document.documentElement.setAttribute(EXTRACTION_ATTR, 'true')
  }

  // Simple extraction if Turndown isn't available
  if (isExtracted()) {
    return
  }

  // Mark as extracted
  markExtracted()

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    // Type guard for message
    const isValidMessage = (
      msg: unknown,
    ): msg is { action: 'ping' | 'extractContent' } => {
      return (
        typeof msg === 'object'
        && msg !== null
        && 'action' in msg
        && (msg.action === 'ping' || msg.action === 'extractContent')
      )
    }

    if (!isValidMessage(message)) {
      return false
    }

    if (message.action === 'ping') {
      sendResponse({ status: 'ok' })
      return true
    }

    if (message.action === 'extractContent') {
      // Simple text extraction without Turndown
      const title = document.title || 'Untitled'
      const url = window.location.href

      // Remove script, style, nav, footer, etc.
      const clonedBody = document.body.cloneNode(true)

      // Type guard for HTMLElement
      if (!clonedBody || clonedBody.nodeType !== Node.ELEMENT_NODE) {
        sendResponse({ url, title, markdown: '' })
        return true
      }

      // User-defined type guard for HTMLElement
      function isHTMLElement(node: Node): node is HTMLElement {
        return node.nodeType === Node.ELEMENT_NODE
      }

      if (!isHTMLElement(clonedBody)) {
        sendResponse({ url, title, markdown: '' })
        return true
      }

      const removeSelectors = [
        'script',
        'style',
        'noscript',
        'iframe',
        'nav',
        'footer',
        'header',
        'aside',
        'form',
      ]

      removeSelectors.forEach((sel) => {
        const elements = clonedBody.querySelectorAll(sel)
        elements.forEach(el => el.remove())
      })

      // Extract links before converting to text
      const anchors = clonedBody.querySelectorAll('a[href]')
      const seen = new Set<string>()
      const links: Array<{ url: string, text: string, context: string }> = []
      const noisePatterns = [
        /privacy/i, /terms/i, /cookie/i, /policy/i, /login/i, /signin/i,
        /signup/i, /register/i, /account/i, /subscribe/i, /newsletter/i,
        /contact/i, /about\/?$/i, /legal/i, /sitemap/i, /rss/i, /feed/i,
      ]

      for (const anchor of anchors) {
        const href = (anchor as HTMLAnchorElement).href
        const text = (anchor.textContent || '').trim()

        if (!href || !text || text.length < 3) continue
        if (!href.startsWith('http://') && !href.startsWith('https://')) continue
        if (href === url || href === url + '/') continue
        if (seen.has(href)) continue
        if (noisePatterns.some(p => p.test(href))) continue

        seen.add(href)
        const parent = anchor.parentElement
        const context = parent ? (parent.textContent || '').slice(0, 60).trim() : ''
        links.push({ url: href, text, context })
      }

      // Type-safe property access
      const textContent = clonedBody.innerText || clonedBody.textContent || ''
      // Clean up whitespace
      const markdown = textContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n\n')

      sendResponse({ url, title, markdown, links })
      return true
    }

    return false
  })
}

/**
 * Wait for a tab to be ready for content script injection.
 * Uses aggressive polling (100ms) since status === 'complete' can be unreliable
 * for background tabs.
 */
function waitForTabLoad(tabId: number, timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const checkTab = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Tab load timed out after ${timeoutMs}ms`))
        return
      }

      chrome.tabs.get(tabId).then((tab) => {
        if (tab.status === 'complete') {
          resolve()
        }
        else {
          // Poll again quickly (100ms)
          setTimeout(checkTab, 100)
        }
      }).catch(() => {
        reject(new Error('Tab no longer exists'))
      })
    }

    // Start checking immediately
    checkTab()
  })
}

async function handleAddSource(
  extraction: ContentExtractionResult,
): Promise<boolean> {
  const notebookId = await getActiveNotebookId()

  if (!notebookId) {
    return false
  }

  const source = createSource(
    notebookId,
    'tab',
    extraction.url,
    extraction.title,
    extraction.content,
    extraction.links,
  )
  await saveSource(source)

  return true
}

// ============================================================================
// Browser Tools Handlers
// ============================================================================

async function handleListWindows(): Promise<{ windows: Array<{
  id: number
  focused: boolean
  type: 'normal' | 'popup' | 'panel' | 'app' | 'devtools'
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
}> }> {
  const windows = await chrome.windows.getAll({
    populate: false,
    windowTypes: ['normal', 'popup', 'panel', 'devtools'],
  })

  return {
    windows: windows
      .filter((w): w is chrome.windows.Window & { id: number } => w.id !== undefined)
      .map((w) => {
        // Type-safe narrowing with fallbacks
        const windowType = w.type === 'normal' || w.type === 'popup' || w.type === 'panel'
          || w.type === 'app' || w.type === 'devtools'
          ? w.type
          : 'normal'

        const windowState = w.state === 'normal' || w.state === 'minimized'
          || w.state === 'maximized' || w.state === 'fullscreen'
          ? w.state
          : 'normal'

        return {
          id: w.id,
          focused: w.focused ?? false,
          type: windowType,
          state: windowState,
        }
      }),
  }
}

async function handleListTabs(payload: { windowId?: number } | undefined): Promise<{
  tabs: Array<{
    id: number
    windowId: number
    index: number
    title: string
    url: string
    active: boolean
    pinned: boolean
    groupId: number
  }>
}> {
  const tabs = await chrome.tabs.query(
    payload?.windowId ? { windowId: payload.windowId } : {},
  )

  return {
    tabs: tabs
      .filter((t): t is chrome.tabs.Tab & { id: number } => t.id !== undefined)
      .map(t => ({
        id: t.id,
        windowId: t.windowId,
        index: t.index,
        title: t.title || '',
        url: t.url || 'about:blank',
        active: t.active,
        pinned: t.pinned,
        groupId: t.groupId,
      })),
  }
}

async function handleListTabGroups(): Promise<{
  tabGroups: Array<{
    id: number
    windowId: number
    title: string
    color: string
    collapsed: boolean
  }>
}> {
  const tabGroups = await chrome.tabGroups.query({})

  return {
    tabGroups: tabGroups.map(tg => ({
      id: tg.id,
      windowId: tg.windowId,
      title: tg.title || '',
      color: tg.color,
      collapsed: tg.collapsed,
    })),
  }
}

async function handleReadPageContent(payload: { tabId: number }): Promise<{
  tabId: number
  title: string
  url: string
  content: string
} | null> {
  const { tabId } = payload

  // Get tab info
  const tab = await chrome.tabs.get(tabId)
  if (!tab?.id || !tab.url) {
    return null
  }

  try {
    // Wait for the tab to finish loading
    await waitForTabLoad(tab.id)

    // Ensure content script is injected
    await ensureContentScript(tab.id)

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage<ContentScriptMessage, ContentScriptResponse>(
      tab.id,
      {
        action: 'extractContent',
      },
    )

    return {
      tabId: tab.id,
      title: result.title || tab.title || '',
      url: result.url || tab.url || '',
      content: result.textContent || result.content || '',
    }
  }
  catch (error) {
    console.error(`Failed to read content from tab ${tabId}:`, error)
    return null
  }
}

// ============================================================================
// Background Transform Handlers
// ============================================================================

// Track currently running transforms to avoid duplicate execution
const runningTransforms = new Set<string>()

// Map transform types to their generator functions
const TRANSFORM_GENERATORS: Record<TransformationType, (sources: Source[]) => Promise<string>> = {
  podcast: generatePodcastScript,
  quiz: generateQuiz,
  takeaways: generateKeyTakeaways,
  email: generateEmailSummary,
  slidedeck: generateSlideDeck,
  report: generateReport,
  datatable: generateDataTable,
  mindmap: generateMindMap,
  flashcards: generateFlashcards,
  timeline: generateTimeline,
  glossary: generateGlossary,
  comparison: generateComparison,
  faq: generateFAQ,
  actionitems: generateActionItems,
  executivebrief: generateExecutiveBrief,
  studyguide: generateStudyGuide,
  proscons: generateProsCons,
  citations: generateCitationList,
  outline: generateOutline,
}

/**
 * Start a new background transformation.
 * Creates the transform record and begins execution.
 */
async function handleStartTransform(
  notebookId: string,
  type: TransformationType,
  sourceIds: string[],
): Promise<{ success: boolean, transformId?: string, error?: string }> {
  try {
    // Create the transform record
    const transform = createBackgroundTransform(notebookId, type, sourceIds)
    await saveBackgroundTransform(transform)

    // Notify the side panel that a transform has started
    notifyTransformStarted(transform)

    // Execute the transform in the background (don't await)
    void executeTransform(transform.id)

    return { success: true, transformId: transform.id }
  }
  catch (error) {
    console.error('[Background Transform] Failed to start transform:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Cancel a running or pending transformation.
 */
async function handleCancelTransform(
  transformId: string,
): Promise<{ success: boolean, error?: string }> {
  try {
    const transform = await getBackgroundTransform(transformId)
    if (!transform) {
      return { success: false, error: 'Transform not found' }
    }

    if (transform.status === 'completed' || transform.status === 'failed') {
      return { success: false, error: 'Transform already finished' }
    }

    // Mark as cancelled
    transform.status = 'cancelled'
    transform.completedAt = Date.now()
    await saveBackgroundTransform(transform)

    // Remove from running set (if running)
    runningTransforms.delete(transformId)

    // Notify the side panel
    notifyTransformComplete(transform)

    return { success: true }
  }
  catch (error) {
    console.error('[Background Transform] Failed to cancel transform:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get pending/running/completed transforms, optionally filtered by notebook.
 * Returns all transforms that haven't been cleaned up yet.
 * The side panel is responsible for cleaning up completed/failed/cancelled
 * transforms after processing them.
 */
async function handleGetPendingTransforms(
  notebookId?: string,
): Promise<{ transforms: BackgroundTransform[] }> {
  try {
    if (notebookId) {
      const all = await getBackgroundTransforms(notebookId)
      // Return all transforms - the side panel will clean up after processing
      // This ensures no results are lost regardless of how long the panel was closed
      return { transforms: all }
    }
    const pending = await getPendingBackgroundTransforms()
    return { transforms: pending }
  }
  catch (error) {
    console.error('[Background Transform] Failed to get pending transforms:', error)
    return { transforms: [] }
  }
}

/**
 * Execute a transformation in the background.
 * This is called asynchronously after the transform record is created.
 */
async function executeTransform(transformId: string): Promise<void> {
  // Check if already running
  if (runningTransforms.has(transformId)) {
    console.warn('[Background Transform] Transform already running:', transformId)
    return
  }

  runningTransforms.add(transformId)

  try {
    // Get the transform record
    const transform = await getBackgroundTransform(transformId)
    if (!transform) {
      console.error('[Background Transform] Transform not found:', transformId)
      runningTransforms.delete(transformId)
      return
    }

    // Check if cancelled before starting
    if (transform.status === 'cancelled') {
      console.log('[Background Transform] Transform was cancelled:', transformId)
      runningTransforms.delete(transformId)
      return
    }

    // Update status to running
    transform.status = 'running'
    transform.startedAt = Date.now()
    await saveBackgroundTransform(transform)

    // Notify progress
    notifyTransformProgress(transform)

    // Get the sources
    const sources: Source[] = []
    for (const sourceId of transform.sourceIds) {
      const source = await getSource(sourceId)
      if (source) {
        sources.push(source)
      }
    }

    if (sources.length === 0) {
      throw new Error('No valid sources found for transformation')
    }

    // Get the generator function
    const generator = TRANSFORM_GENERATORS[transform.type]
    if (!generator) {
      throw new Error(`Unknown transform type: ${transform.type}`)
    }

    // Check if cancelled before executing
    const checkTransform = await getBackgroundTransform(transformId)
    if (checkTransform?.status === 'cancelled') {
      console.log('[Background Transform] Transform was cancelled before execution:', transformId)
      runningTransforms.delete(transformId)
      return
    }

    // Execute the transformation
    console.log('[Background Transform] Executing transform:', transform.type, 'with', sources.length, 'sources')
    const content = await generator(sources)

    // Check if cancelled after executing
    const finalCheck = await getBackgroundTransform(transformId)
    if (!finalCheck) {
      console.error('[Background Transform] Transform not found after execution:', transformId)
      runningTransforms.delete(transformId)
      return
    }
    if (finalCheck.status === 'cancelled') {
      console.log('[Background Transform] Transform was cancelled after execution:', transformId)
      runningTransforms.delete(transformId)
      return
    }

    // Update finalCheck with result (not the stale transform object)
    finalCheck.status = 'completed'
    finalCheck.completedAt = Date.now()
    finalCheck.content = content
    await saveBackgroundTransform(finalCheck)

    console.log('[Background Transform] Transform completed:', transformId, 'content length:', content.length)

    // Notify completion
    notifyTransformComplete(finalCheck)
  }
  catch (error) {
    console.error('[Background Transform] Transform failed:', transformId, error)

    // Update with error
    const transform = await getBackgroundTransform(transformId)
    if (transform && transform.status !== 'cancelled') {
      transform.status = 'failed'
      transform.completedAt = Date.now()
      transform.error = error instanceof Error ? error.message : String(error)
      await saveBackgroundTransform(transform)

      // Notify error
      notifyTransformError(transform)
    }
  }
  finally {
    runningTransforms.delete(transformId)
  }
}

/**
 * Notify the side panel that a transform has started.
 */
function notifyTransformStarted(transform: BackgroundTransform): void {
  chrome.runtime
    .sendMessage({
      type: 'TRANSFORM_STARTED',
      payload: transform,
    })
    .catch(() => {
      // Side panel may not be listening
    })
}

/**
 * Notify the side panel of transform progress.
 */
function notifyTransformProgress(transform: BackgroundTransform): void {
  chrome.runtime
    .sendMessage({
      type: 'TRANSFORM_PROGRESS',
      payload: transform,
    })
    .catch(() => {
      // Side panel may not be listening
    })
}

/**
 * Notify the side panel that a transform has completed.
 */
function notifyTransformComplete(transform: BackgroundTransform): void {
  chrome.runtime
    .sendMessage({
      type: 'TRANSFORM_COMPLETE',
      payload: transform,
    })
    .catch(() => {
      // Side panel may not be listening
    })
}

/**
 * Notify the side panel that a transform has failed.
 */
function notifyTransformError(transform: BackgroundTransform): void {
  chrome.runtime
    .sendMessage({
      type: 'TRANSFORM_ERROR',
      payload: transform,
    })
    .catch(() => {
      // Side panel may not be listening
    })
}

// ============================================================================
// Service Worker Startup - Resume Pending Transforms
// ============================================================================

/**
 * On service worker startup, check for any pending/running transforms
 * that may have been interrupted and resume them.
 */
async function resumePendingTransforms(): Promise<void> {
  try {
    const pending = await getPendingBackgroundTransforms()
    console.log('[Background Transform] Found', pending.length, 'pending transforms on startup')

    for (const transform of pending) {
      // If it was running when we shut down, reset to pending
      if (transform.status === 'running') {
        transform.status = 'pending'
        await saveBackgroundTransform(transform)
      }

      // Re-execute pending transforms
      if (transform.status === 'pending') {
        console.log('[Background Transform] Resuming transform:', transform.id, transform.type)
        void executeTransform(transform.id)
      }
    }
  }
  catch (error) {
    console.error('[Background Transform] Failed to resume pending transforms:', error)
  }
}

// Resume pending transforms when the service worker starts
void resumePendingTransforms()

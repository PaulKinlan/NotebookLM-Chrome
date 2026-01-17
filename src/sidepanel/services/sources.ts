/**
 * Sources Service
 *
 * Business logic for adding sources from tabs, bookmarks, and history.
 * This service handles Chrome API calls and content extraction.
 */

import type { Source, ExtractedLink } from '../../types/index'
import { addSourceToNotebook, getCurrentNotebookIdState } from './notebooks'
import { checkPermissions, requestPermission } from '../../lib/permissions'
import type { PermissionStatus } from '../../types/index'

// ============================================================================
// Types
// ============================================================================

export interface PickerItem {
  id: string
  url: string
  title: string
  favicon?: string
  color?: string
  tabCount?: number
}

export interface PickerState {
  items: PickerItem[]
  selectedItems: Set<string>
  type: 'tab' | 'tabGroup' | 'bookmark' | 'history' | null
  isOpen: boolean
}

// ============================================================================
// State
// ============================================================================

let permissions: PermissionStatus = {
  tabs: false,
  tabGroups: false,
  bookmarks: false,
  history: false,
}

// ============================================================================
// Permission helpers
// ============================================================================

export async function initializePermissions(): Promise<PermissionStatus> {
  permissions = await checkPermissions()
  return permissions
}

export function getPermissions(): PermissionStatus {
  return permissions
}

export async function ensurePermission(
  permission: keyof PermissionStatus,
): Promise<boolean> {
  if (permissions[permission]) {
    return true
  }

  const granted = await requestPermission(permission)
  if (granted) {
    permissions[permission] = true
  }

  return granted
}

// ============================================================================
// Add Current Tab
// ============================================================================

export async function addCurrentTab(): Promise<Source | null> {
  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) {
    console.error('No active tab found')
    return null
  }

  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    console.error('No notebook selected')
    return null
  }

  if (!tab.id) {
    console.error('Tab has no ID')
    return null
  }

  // Extract content from the tab
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent,
  })

  const result = results?.[0]?.result
  if (!result) {
    console.error('Failed to extract content from tab')
    return null
  }

  const { title, content, links } = result

  // Create source
  const source = addSourceToNotebook(
    notebookId,
    'tab',
    tab.url,
    title || tab.title || 'Untitled',
    content,
    links,
  )

  // Notify background script
  chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})

  return source
}

// ============================================================================
// Import from Tabs
// ============================================================================

export async function getTabs(): Promise<PickerItem[]> {
  const hasPermission = await ensurePermission('tabs')
  if (!hasPermission) {
    return []
  }

  const tabs = await chrome.tabs.query({})
  return tabs.map(tab => ({
    id: String(tab.id),
    url: tab.url || '',
    title: tab.title || 'Untitled',
    favicon: tab.favIconUrl,
  }))
}

export async function importTabs(tabIds: string[]): Promise<Source[]> {
  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    throw new Error('No notebook selected')
  }

  const sources: Source[] = []

  for (const tabId of tabIds) {
    const tab = await chrome.tabs.get(parseInt(tabId, 10))
    if (!tab?.url || !tab.id) continue

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    })

    const result = results?.[0]?.result
    if (result) {
      const { title, content, links } = result
      const source = addSourceToNotebook(
        notebookId,
        'tab',
        tab.url,
        title || tab.title || 'Untitled',
        content,
        links,
      )
      sources.push(source)
    }
  }

  if (sources.length > 0) {
    chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})
  }

  return sources
}

// ============================================================================
// Import from Tab Groups
// ============================================================================

export async function getTabGroups(): Promise<PickerItem[]> {
  const hasPermission = await ensurePermission('tabs')
  const hasTabGroupsPermission = await ensurePermission('tabGroups')
  if (!hasPermission || !hasTabGroupsPermission) {
    return []
  }

  const groups = await chrome.tabGroups.query({})
  const tabs = await chrome.tabs.query({})

  const groupItems: PickerItem[] = []

  for (const group of groups) {
    const groupTabs = tabs.filter(t => t.groupId === group.id)
    const tabIds = groupTabs.map(t => String(t.id)).join(',')
    groupItems.push({
      id: `group-${group.id}`,
      url: tabIds, // Comma-separated tab IDs
      title: group.title || 'Untitled Group',
      color: group.color,
      tabCount: groupTabs.length,
    })
  }

  return groupItems
}

export async function importTabGroups(groupIds: string[]): Promise<Source[]> {
  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    throw new Error('No notebook selected')
  }

  const sources: Source[] = []

  for (const groupId of groupIds) {
    // Extract actual group ID
    const actualGroupId = parseInt(groupId.replace('group-', ''), 10)

    // Get all tabs in the group
    const tabs = await chrome.tabs.query({})
    const groupTabs = tabs.filter(t => t.groupId === actualGroupId)

    for (const tab of groupTabs) {
      if (!tab?.url || !tab.id) continue

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent,
      })

      const result = results?.[0]?.result
      if (result) {
        const { title, content, links } = result
        const source = addSourceToNotebook(
          notebookId,
          'tab',
          tab.url,
          title || tab.title || 'Untitled',
          content,
          links,
        )
        sources.push(source)
      }
    }
  }

  if (sources.length > 0) {
    chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})
  }

  return sources
}

// ============================================================================
// Import from Bookmarks
// ============================================================================

export async function getBookmarks(): Promise<PickerItem[]> {
  const hasPermission = await ensurePermission('bookmarks')
  if (!hasPermission) {
    return []
  }

  const tree = await chrome.bookmarks.getTree()
  const items: PickerItem[] = []

  function flattenBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (node.url) {
        items.push({
          id: node.id,
          url: node.url,
          title: node.title || node.url,
        })
      }
      if (node.children) {
        flattenBookmarks(node.children)
      }
    }
  }

  flattenBookmarks(tree)
  return items
}

export async function importBookmarks(bookmarkIds: string[]): Promise<Source[]> {
  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    throw new Error('No notebook selected')
  }

  const sources: Source[] = []

  for (const bookmarkId of bookmarkIds) {
    const bookmarks = await chrome.bookmarks.get(bookmarkId)
    const bookmark = bookmarks[0]

    if (!bookmark?.url) continue

    // For bookmarks, we can't execute scripts, so use the URL as content
    const source = addSourceToNotebook(
      notebookId,
      'bookmark',
      bookmark.url,
      bookmark.title || bookmark.url,
      `Bookmark: ${bookmark.url}`,
    )
    sources.push(source)
  }

  if (sources.length > 0) {
    chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})
  }

  return sources
}

// ============================================================================
// Import from History
// ============================================================================

export async function getHistory(limit: number = 100): Promise<PickerItem[]> {
  const hasPermission = await ensurePermission('history')
  if (!hasPermission) {
    return []
  }

  const historyItems = await chrome.history.search({
    text: '',
    maxResults: limit,
  })

  return historyItems
    .filter(item => item.url !== undefined && item.url !== null)
    .map(item => ({
      id: String(Date.now() + Math.random()), // History items don't have stable IDs
      url: item.url!,
      title: item.title || item.url!,
    }))
}

export async function importHistory(urls: string[]): Promise<Source[]> {
  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    throw new Error('No notebook selected')
  }

  const sources: Source[] = []

  for (const url of urls) {
    // For history items, use the URL as content
    const source = addSourceToNotebook(
      notebookId,
      'history',
      url,
      url,
      `History: ${url}`,
    )
    sources.push(source)
  }

  if (sources.length > 0) {
    chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})
  }

  return sources
}

// ============================================================================
// Add from URL (for suggested links)
// ============================================================================

export async function addSourceFromUrl(url: string, title: string): Promise<Source | null> {
  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    console.error('No notebook selected')
    return null
  }

  // Create a basic source from the URL
  // Content extraction happens when the user opens it as a tab
  const source = addSourceToNotebook(
    notebookId,
    'manual',
    url,
    title || url,
    `Link: ${url}`,
  )

  chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})

  return source
}

// ============================================================================
// Add Text Source (for drag-and-drop text)
// ============================================================================

export async function addTextSource(text: string, title?: string): Promise<Source | null> {
  const notebookId = await getCurrentNotebookIdState()
  if (!notebookId) {
    console.error('No notebook selected')
    return null
  }

  // Generate a title from the first line or truncated text
  const generatedTitle = title || text.split('\n')[0].slice(0, 50) || 'Dropped Text'

  const source = addSourceToNotebook(
    notebookId,
    'text',
    '', // No URL for text sources
    generatedTitle,
    text,
  )

  chrome.runtime.sendMessage({ type: 'SOURCE_ADDED' }).catch(() => {})

  return source
}

// ============================================================================
// Content extraction function (injected into pages)
// ============================================================================

interface ExtractedContent {
  title: string
  content: string
  links: ExtractedLink[]
}

function extractPageContent(): ExtractedContent {
  const title = document.title

  // Get text content
  const article = document.querySelector('article')
  const main = document.querySelector('main')
  const content = article || main || document.body

  const textContent = content?.textContent || ''
  const cleanContent = textContent
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  // Extract links
  const links: ExtractedLink[] = []
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href')
    if (href) {
      links.push({
        url: href,
        text: link.textContent?.trim() || '',
        context: link.textContent?.slice(0, 50) || '',
      })
    }
  })

  return {
    title,
    content: cleanContent,
    links: links.slice(0, 100), // Limit to 100 links
  }
}

import type {
  Source,
  PermissionStatus,
  ChatEvent,
  Citation,
  SuggestedLink,
  StreamEvent,
  Message,
  TransformationType,
} from '../types/index.ts'
import DOMPurify from 'dompurify'
import type { ExtractedLink } from '../types/index.ts'
import { checkPermissions, requestPermission } from '../lib/permissions.ts'
import { renderMarkdown, isHtmlContent } from '../lib/markdown-renderer.ts'
import {
  escapeHtml,
  formatMarkdown,
} from './dom-utils.ts'
import {
  getNotebooks,
  saveNotebook,
  createNotebook,
  deleteNotebook,
  getNotebook,
  getActiveNotebookId,
  setActiveNotebookId,
  getSourcesByNotebook,
  saveSource,
  deleteSource,
  createSource,
  getChatHistory,
  saveChatEvent,
  createUserEvent,
  createAssistantEvent,
  createToolResultEvent,
  clearChatHistory,
  getCachedResponse,
  saveCachedResponse,
  createCachedResponse,
  createCacheKey,
  getSummary,
  saveSummary,
  createSummary,
  clearAllData,
  getTransformations,
  saveTransformation,
  deleteTransformation,
  createTransformation,
} from '../lib/storage.ts'
import {
  streamChat,
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
  generateSummary,
  formatErrorForUser,
} from '../lib/ai.ts'
import { getSourceTools } from '../lib/agent-tools.ts'
import { getToolPermissions } from '../lib/tool-permissions.ts'
import type { ToolPermissionsConfig } from '../types/index.ts'
import {
  getContextMode,
  setContextMode,
  getAISettings,
} from '../lib/settings.ts'
import {
  getModelConfigs,
  getDefaultModelConfig,
} from '../lib/model-configs.ts'
import { initProviderConfigUI, AI_PROFILES_CHANGED_EVENT } from './provider-config-ui.ts'
import { filterLinksWithAI, hasExtractableLinks } from '../lib/suggested-links.ts'
import { SandboxRenderer } from '../lib/sandbox-renderer.ts'
import { getPreference, onThemeChange } from './hooks/useTheme.tsx'
import {
  exportNotebook,
  type NotebookExport,
  type ExportFormat,
} from '../lib/export.ts'
import {
  isOnboardingComplete,
  markOnboardingComplete,
  ONBOARDING_STEPS,
} from '../lib/onboarding.ts'
import { startModelDownloadAsync } from '../lib/chrome-ai.ts'
import {
  initApprovalUI,
  checkAndShowPendingApprovals,
} from './approval-ui.ts'
import { getTransformConfig } from '../lib/transform-config.ts'
import { initTransformConfigButtons } from './components/TransformConfigPopover.tsx'

// ============================================================================
// Chrome Message Response Types
// ============================================================================

/**
 * Response from chrome.tabs.sendMessage for content extraction
 */
interface TabExtractContentResponse {
  url: string
  title: string
  markdown: string
  links?: ExtractedLink[]
}

/**
 * Response from chrome.runtime.sendMessage for URL extraction
 */
interface UrlExtractResponse {
  url?: string
  title?: string
  content?: string
  markdown?: string
  links?: ExtractedLink[]
  success?: boolean
}

/**
 * Type guard for TabExtractContentResponse
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
 * Type guard for UrlExtractResponse
 */
function isUrlExtractResponse(value: unknown): value is UrlExtractResponse {
  return (
    typeof value === 'object'
    && value !== null
  )
}

/**
 * Type guard for successful UrlExtractResponse with success: true
 */
function isSuccessfulUrlExtractResponse(value: unknown): value is UrlExtractResponse & { success: true } {
  return (
    isUrlExtractResponse(value)
    && 'success' in value
    && value.success === true
  )
}

// ============================================================================
// State
// ============================================================================

let currentNotebookId: string | null = null
let onboardingStep = 0

let permissions: PermissionStatus = {
  tabs: false,
  tabGroups: false,
  bookmarks: false,
  history: false,
}

// Picker state
interface PickerItem {
  id: string
  url: string
  title: string
  favicon?: string
  color?: string // For tab groups
  tabCount?: number // For tab groups
}
let pickerItems: PickerItem[] = []
let selectedPickerItems: Set<string> = new Set()
let pickerType: 'tab' | 'tabGroup' | 'bookmark' | 'history' | null = null

// Suggested links state
let suggestedLinksCache: Map<string, SuggestedLink[]> = new Map()
let suggestedLinksLoading = false

// ============================================================================
// DOM Elements
// ============================================================================

// Helper to lazily get elements (for TSX compatibility where elements render later)
function getElementById<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

// ============================================================================
// Elements
// ============================================================================

const elements = {
  // Navigation
  get navItems(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll('.nav-item'),
    ).filter((item): item is HTMLElement => item instanceof HTMLElement)
  },
  get tabContents(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll('.tab-content'),
    ).filter((item): item is HTMLElement => item instanceof HTMLElement)
  },

  // Header buttons
  get headerLibraryBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('header-library-btn')!
  },
  get headerSettingsBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('header-settings-btn')!
  },

  // Add Sources tab
  get addCurrentTabBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('add-current-tab-btn')!
  },
  get searchSources(): HTMLInputElement {
    return getElementById<HTMLInputElement>('search-sources')!
  },
  get importTabs(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('import-tabs')!
  },
  get importTabGroups(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('import-tab-groups')!
  },
  get importBookmarks(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('import-bookmarks')!
  },
  get importHistory(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('import-history')!
  },
  get tabsCount(): HTMLSpanElement {
    return getElementById<HTMLSpanElement>('tabs-count')!
  },
  get sourcesList(): HTMLDivElement {
    return getElementById<HTMLDivElement>('sources-list')!
  },

  // Chat tab
  get notebookSelect(): HTMLSelectElement {
    return getElementById<HTMLSelectElement>('notebook-select')!
  },
  get aiModelBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('ai-model-btn')!
  },
  get aiModelDropdown(): HTMLDivElement {
    return getElementById<HTMLDivElement>('ai-model-dropdown')!
  },
  get aiModelList(): HTMLDivElement {
    return getElementById<HTMLDivElement>('ai-model-list')!
  },
  get newNotebookBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('new-notebook-btn')!
  },
  get queryInput(): HTMLInputElement {
    return getElementById<HTMLInputElement>('query-input')!
  },
  get queryBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('query-btn')!
  },
  get sourceCount(): HTMLSpanElement {
    return getElementById<HTMLSpanElement>('source-count')!
  },
  get activeSources(): HTMLDivElement {
    return getElementById<HTMLDivElement>('active-sources')!
  },
  get refreshAllSourcesBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('refresh-all-sources-btn')!
  },
  get addPageBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('add-page-btn')!
  },
  get chatMessages(): HTMLDivElement {
    return getElementById<HTMLDivElement>('chat-messages')!
  },
  get clearChatBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('clear-chat-btn')!
  },
  get chatStatus(): HTMLParagraphElement {
    return getElementById<HTMLParagraphElement>('chat-status')!
  },
  get autocompleteDropdown(): HTMLDivElement {
    return getElementById<HTMLDivElement>('autocomplete-dropdown')!
  },
  get autocompleteGhost(): HTMLSpanElement {
    return getElementById<HTMLSpanElement>('autocomplete-ghost')!
  },

  // Summary section
  get summarySection(): HTMLDetailsElement {
    return getElementById<HTMLDetailsElement>('summary-section')!
  },
  get notebookSummary(): HTMLDivElement {
    return getElementById<HTMLDivElement>('notebook-summary')!
  },
  get regenerateSummaryBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('regenerate-summary-btn')!
  },

  // Suggested links section
  get suggestedLinksSection(): HTMLDetailsElement | null {
    return getElementById<HTMLDetailsElement>('suggested-links-section')
  },
  get suggestedLinksCount(): HTMLSpanElement | null {
    return getElementById<HTMLSpanElement>('suggested-links-count')
  },
  get suggestedLinksContent(): HTMLDivElement | null {
    return getElementById<HTMLDivElement>('suggested-links-content')
  },
  get suggestedLinksList(): HTMLDivElement | null {
    return getElementById<HTMLDivElement>('suggested-links-list')
  },
  get refreshLinksBtn(): HTMLButtonElement | null {
    return getElementById<HTMLButtonElement>('refresh-links-btn')
  },

  // Transform tab
  get transformPodcast(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-podcast')!
  },
  get transformQuiz(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-quiz')!
  },
  get transformTakeaways(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-takeaways')!
  },
  get transformEmail(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-email')!
  },
  get transformSlidedeck(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-slidedeck')!
  },
  get transformReport(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-report')!
  },
  get transformDatatable(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-datatable')!
  },
  get transformMindmap(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-mindmap')!
  },
  get transformFlashcards(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-flashcards')!
  },
  get transformTimeline(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-timeline')!
  },
  get transformGlossary(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-glossary')!
  },
  get transformComparison(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-comparison')!
  },
  get transformFaq(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-faq')!
  },
  get transformActionitems(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-actionitems')!
  },
  get transformExecutivebrief(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-executivebrief')!
  },
  get transformStudyguide(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-studyguide')!
  },
  get transformProscons(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-proscons')!
  },
  get transformCitations(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-citations')!
  },
  get transformOutline(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('transform-outline')!
  },
  get transformHistory(): HTMLDivElement {
    return getElementById<HTMLDivElement>('transform-history')!
  },

  // Library tab
  get notebooksList(): HTMLDivElement {
    return getElementById<HTMLDivElement>('notebooks-list')!
  },

  // Settings tab (permissions only - AI provider configs are in provider-config-ui.ts)
  get permTabs(): HTMLInputElement {
    return getElementById<HTMLInputElement>('perm-tabs')!
  },
  get permTabGroups(): HTMLInputElement {
    return getElementById<HTMLInputElement>('perm-tab-groups')!
  },
  get permBookmarks(): HTMLInputElement {
    return getElementById<HTMLInputElement>('perm-bookmarks')!
  },
  get permHistory(): HTMLInputElement {
    return getElementById<HTMLInputElement>('perm-history')!
  },
  get toolBasedContext(): HTMLInputElement {
    return getElementById<HTMLInputElement>('tool-based-context')!
  },
  get chromeToolsWarning(): HTMLParagraphElement {
    return getElementById<HTMLParagraphElement>('chrome-tools-warning')!
  },
  get clearAllDataBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('clear-all-data-btn')!
  },
  get toolPermissionsList(): HTMLDivElement {
    return getElementById<HTMLDivElement>('tool-permissions-list')!
  },
  get resetToolPermissionsBtn(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('reset-tool-permissions-btn')!
  },

  // FAB
  get fab(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('fab')!
  },

  // Picker Modal
  get pickerModal(): HTMLDivElement {
    return getElementById<HTMLDivElement>('picker-modal')!
  },
  get pickerTitle(): HTMLHeadingElement {
    return getElementById<HTMLHeadingElement>('picker-title')!
  },
  get pickerSearch(): HTMLInputElement {
    return getElementById<HTMLInputElement>('picker-search')!
  },
  get pickerList(): HTMLDivElement {
    return getElementById<HTMLDivElement>('picker-list')!
  },
  get pickerSelectedCount(): HTMLSpanElement {
    return getElementById<HTMLSpanElement>('picker-selected-count')!
  },
  get pickerClose(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('picker-close')!
  },
  get pickerCancel(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('picker-cancel')!
  },
  get pickerAdd(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('picker-add')!
  },
  get pickerBackdrop(): HTMLDivElement {
    const el = document.querySelector('.modal-backdrop')
    if (!el || !(el instanceof HTMLDivElement)) {
      throw new Error('Required element .modal-backdrop not found or is not HTMLDivElement')
    }
    return el
  },

  // Dialogs
  get notebookDialog(): HTMLDialogElement {
    return getElementById<HTMLDialogElement>('notebook-dialog')!
  },
  get notebookDialogTitle(): HTMLHeadingElement {
    return getElementById<HTMLHeadingElement>('notebook-dialog-title')!
  },
  get notebookNameInput(): HTMLInputElement {
    return getElementById<HTMLInputElement>('notebook-name-input')!
  },
  get notebookDialogCancel(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('notebook-dialog-cancel')!
  },
  get notebookDialogConfirm(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('notebook-dialog-confirm')!
  },

  get confirmDialog(): HTMLDialogElement {
    return getElementById<HTMLDialogElement>('confirm-dialog')!
  },
  get confirmDialogTitle(): HTMLHeadingElement {
    return getElementById<HTMLHeadingElement>('confirm-dialog-title')!
  },
  get confirmDialogMessage(): HTMLParagraphElement {
    return getElementById<HTMLParagraphElement>('confirm-dialog-message')!
  },
  get confirmDialogCancel(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('confirm-dialog-cancel')!
  },
  get confirmDialogConfirm(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('confirm-dialog-confirm')!
  },

  get notification(): HTMLDivElement {
    return getElementById<HTMLDivElement>('notification')!
  },

  // Onboarding elements
  get onboardingOverlay(): HTMLDivElement {
    return getElementById<HTMLDivElement>('onboarding-overlay')!
  },
  get onboardingIcon(): HTMLDivElement {
    return getElementById<HTMLDivElement>('onboarding-icon')!
  },
  get onboardingTitle(): HTMLHeadingElement {
    return getElementById<HTMLHeadingElement>('onboarding-title')!
  },
  get onboardingDescription(): HTMLParagraphElement {
    return getElementById<HTMLParagraphElement>('onboarding-description')!
  },
  get onboardingDots(): HTMLDivElement {
    return getElementById<HTMLDivElement>('onboarding-dots')!
  },
  get onboardingSkip(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('onboarding-skip')!
  },
  get onboardingNext(): HTMLButtonElement {
    return getElementById<HTMLButtonElement>('onboarding-next')!
  },
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Update Chrome tools warning visibility
 * Shows warning when using Chrome built-in AI with tool-based context
 */
async function updateChromeToolsWarning(): Promise<void> {
  const settings = await getAISettings()
  const isChrome = settings.provider === 'chrome'
  const isToolBased = elements.toolBasedContext.checked

  if (isChrome && isToolBased) {
    elements.chromeToolsWarning.classList.remove('hidden')
  }
  else {
    elements.chromeToolsWarning.classList.add('hidden')
  }
}

async function init(): Promise<void> {
  permissions = await checkPermissions()
  currentNotebookId = await getActiveNotebookId()

  // Check for onboarding
  const onboardingComplete = await isOnboardingComplete()
  if (!onboardingComplete) {
    showOnboarding()
  }

  updatePermissionUI()
  // Load context mode setting
  const contextMode = await getContextMode()
  elements.toolBasedContext.checked = contextMode === 'agentic'
  await updateChromeToolsWarning()

  // Initialize approval UI
  initApprovalUI()

  // Initialize tool permissions UI
  await initToolPermissionsUI()

  // updateSettingsUI() is now handled by provider-config-ui.ts
  setupEventListeners()
  await loadNotebooks()
  await loadAIConfigs()
  await loadSources()
  await loadChatHistory()
  await loadTransformHistory(currentNotebookId)
  void updateTabCount()
  void updateAddTabButton()

  // Initialize provider config UI
  await initProviderConfigUI()

  // Initialize transform config buttons (cog icons)
  // Pass a getter function so buttons can access the current notebook ID when clicked
  initTransformConfigButtons(() => currentNotebookId)

  // Listen for AI profile changes to update the AI config select
  window.addEventListener(AI_PROFILES_CHANGED_EVENT, () => {
    void loadAIConfigs()
    void updateChromeToolsWarning()
  })

  // Listen for tab highlight changes to update button text
  chrome.tabs.onHighlighted.addListener(() => {
    void updateAddTabButton()
  })

  // Listen for tab creation/removal to update tab count in real-time
  chrome.tabs.onCreated.addListener(() => {
    void updateTabCount()
    void refreshPickerIfShowingTabs()
  })

  chrome.tabs.onRemoved.addListener(() => {
    void updateTabCount()
    void refreshPickerIfShowingTabs()
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    // Only refresh when URL or title changes (not for every status update)
    if (changeInfo.url || changeInfo.title) {
      void refreshPickerIfShowingTabs()
    }
  })

  // Check for pending tool approvals periodically (every 1 second)
  setInterval(() => {
    void checkAndShowPendingApprovals()
  }, 1000)

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'SOURCE_ADDED') {
      // Clear suggested links cache so new sources trigger a refresh
      if (currentNotebookId) {
        suggestedLinksCache.delete(currentNotebookId)
      }
      void loadNotebooks()
      void loadSources()
      void loadNotebooksList() // Refresh library page source counts
      showNotification('Source added')
    }
    else if (message.type === 'SOURCE_REFRESHED') {
      // Clear suggested links cache so refreshed sources trigger a refresh
      if (currentNotebookId) {
        suggestedLinksCache.delete(currentNotebookId)
      }
      void loadSources()
    }
    else if (message.type === 'CREATE_NOTEBOOK_AND_ADD_PAGE') {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove('pendingAction').catch(() => {})
      const payload = message.payload as { tabId?: number } | undefined
      if (payload?.tabId !== undefined) void handleCreateNotebookAndAddPage(payload.tabId)
    }
    else if (message.type === 'CREATE_NOTEBOOK_AND_ADD_LINK') {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove('pendingAction').catch(() => {})
      const payload = message.payload as { linkUrl?: string } | undefined
      if (payload?.linkUrl !== undefined) void handleCreateNotebookAndAddLink(payload.linkUrl)
    }
    else if (message.type === 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS') {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove('pendingAction').catch(() => {})
      const payload = message.payload as { links?: string[] } | undefined
      if (payload?.links !== undefined) void handleCreateNotebookAndAddSelectionLinks(payload.links)
    }
  })

  // Check for pending actions from context menu (in case side panel was just opened)
  await checkPendingAction()
}

interface PendingAction {
  type: string
  payload: {
    tabId?: number
    linkUrl?: string
    links?: string[]
  }
}

async function checkPendingAction(): Promise<void> {
  try {
    const result = await chrome.storage.session.get('pendingAction')
    if (result.pendingAction) {
      // Clear the pending action first to prevent duplicate processing
      await chrome.storage.session.remove('pendingAction')

      const { type, payload } = result.pendingAction as PendingAction
      if (type === 'CREATE_NOTEBOOK_AND_ADD_PAGE' && payload.tabId) {
        void handleCreateNotebookAndAddPage(payload.tabId)
      }
      else if (type === 'CREATE_NOTEBOOK_AND_ADD_LINK' && payload.linkUrl) {
        void handleCreateNotebookAndAddLink(payload.linkUrl)
      }
      else if (type === 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS' && payload.links) {
        void handleCreateNotebookAndAddSelectionLinks(payload.links)
      }
    }
  }
  catch (error) {
    console.error('Failed to check pending action:', error)
  }
}

// Notify background script to rebuild context menus when notebooks change
function notifyNotebooksChanged(): void {
  chrome.runtime.sendMessage({ type: 'REBUILD_CONTEXT_MENUS' }).catch(() => {
    // Background may not be ready
  })
}

async function handleCreateNotebookAndAddPage(tabId: number): Promise<void> {
  const name = await showNotebookDialog('New Notebook')
  if (!name) return

  const notebook = createNotebook(name)
  await saveNotebook(notebook)
  currentNotebookId = notebook.id
  await setActiveNotebookId(notebook.id)
  await loadNotebooks()
  await loadNotebooksList()
  elements.notebookSelect.value = notebook.id
  notifyNotebooksChanged()

  // Now extract and add the page
  try {
    const result: unknown = await chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
    })
    // Type guard to ensure result has expected properties
    if (isTabExtractContentResponse(result)) {
      const source = createSource(
        notebook.id,
        'tab',
        result.url,
        result.title,
        result.markdown,
        result.links,
      )
      await saveSource(source)
      // Clear suggested links cache so new sources trigger a refresh
      suggestedLinksCache.delete(notebook.id)
      await loadSources()
      showNotification('Notebook created and source added')
    }
  }
  catch (error) {
    console.error('Failed to add page:', error)
    showNotification('Notebook created')
  }
}

async function handleCreateNotebookAndAddLink(linkUrl: string): Promise<void> {
  const name = await showNotebookDialog('New Notebook')
  if (!name) return

  const notebook = createNotebook(name)
  await saveNotebook(notebook)
  currentNotebookId = notebook.id
  await setActiveNotebookId(notebook.id)
  await loadNotebooks()
  await loadNotebooksList()
  elements.notebookSelect.value = notebook.id
  notifyNotebooksChanged()

  showNotification('Creating notebook and extracting content...')

  // Now extract and add the link
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: 'EXTRACT_FROM_URL',
      payload: linkUrl,
    })

    // Type guard to ensure response has expected properties
    if (isUrlExtractResponse(response)) {
      const url = response.url ?? linkUrl
      const title = response.title ?? 'Untitled'
      const content = response.content ?? ''

      const source = createSource(
        notebook.id,
        'tab',
        url,
        title,
        content,
        response.links,
      )
      await saveSource(source)
      // Clear suggested links cache so new sources trigger a refresh
      suggestedLinksCache.delete(notebook.id)
      await loadSources()
      showNotification('Notebook created and source added')
    }
  }
  catch (error) {
    console.error('Failed to add link:', error)
    showNotification('Notebook created but failed to add link')
  }
}

async function handleCreateNotebookAndAddSelectionLinks(links: string[]): Promise<void> {
  const name = await showNotebookDialog('New Notebook')
  if (!name) return

  const notebook = createNotebook(name)
  await saveNotebook(notebook)
  currentNotebookId = notebook.id
  await setActiveNotebookId(notebook.id)
  await loadNotebooks()
  await loadNotebooksList()
  elements.notebookSelect.value = notebook.id
  notifyNotebooksChanged()

  const linkCount = links.length
  showNotification(`Creating notebook and extracting ${linkCount} link${linkCount === 1 ? '' : 's'}...`)

  // Extract and add each link
  let addedCount = 0
  for (const linkUrl of links) {
    try {
      const response: unknown = await chrome.runtime.sendMessage({
        type: 'EXTRACT_FROM_URL',
        payload: linkUrl,
      })

      // Type guard to ensure response has expected properties
      if (isUrlExtractResponse(response)) {
        const url = response.url ?? linkUrl
        const title = response.title ?? 'Untitled'
        const content = response.content ?? ''

        const source = createSource(
          notebook.id,
          'tab',
          url,
          title,
          content,
          response.links,
        )
        await saveSource(source)
        addedCount++
      }
    }
    catch (error) {
      console.error(`Failed to add link ${linkUrl}:`, error)
      // Continue with other links even if one fails
    }
  }

  // Clear suggested links cache so new sources trigger a refresh
  suggestedLinksCache.delete(notebook.id)
  await loadSources()
  showNotification(`Notebook created with ${addedCount} source${addedCount === 1 ? '' : 's'}`)
}

// ============================================================================
// Tool Permissions UI
// ============================================================================

/**
 * Initialize tool permissions UI
 */
async function initToolPermissionsUI(): Promise<void> {
  const config = await getToolPermissions()
  renderToolPermissions(config)
}

/**
 * Render the tool permissions list
 */
function renderToolPermissions(config: ToolPermissionsConfig): void {
  const container = elements.toolPermissionsList
  container.innerHTML = ''

  const toolNames = Object.keys(config.permissions).sort()

  for (const toolName of toolNames) {
    const permission = config.permissions[toolName]
    const isSessionApproved = config.sessionApprovals.includes(toolName)

    const item = document.createElement('div')
    item.className = 'tool-permission-item'

    // Determine status
    let statusClass = 'disabled'
    let statusText = 'Disabled'
    if (permission.visible) {
      if (permission.autoApproved) {
        statusClass = 'auto-approved'
        statusText = 'Auto-Approved'
      }
      else if (isSessionApproved) {
        statusClass = 'session-approved'
        statusText = 'Session-Approved'
      }
      else if (permission.requiresApproval) {
        statusClass = 'requires-approval'
        statusText = 'Requires Approval'
      }
      else {
        statusClass = 'auto-approved'
        statusText = 'Auto-Approved'
      }
    }

    // Format tool name for display
    const displayName = toolName
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, s => s.toUpperCase())

    item.innerHTML = `
      <div class="tool-permission-header">
        <div class="tool-permission-name">
          <strong>${escapeHtml(displayName)}</strong>
          <span class="tool-permission-status ${statusClass}">${statusText}</span>
        </div>
      </div>
      <div class="tool-permission-controls">
        <div class="tool-permission-control">
          <input
            type="checkbox"
            id="tool-enabled-${toolName}"
            data-tool-name="${toolName}"
            data-action="visible"
            ${permission.visible ? 'checked' : ''}
          />
          <label for="tool-enabled-${toolName}">Enabled</label>
        </div>
        <div class="tool-permission-control">
          <input
            type="checkbox"
            id="tool-no-approval-${toolName}"
            data-tool-name="${toolName}"
            data-action="noApproval"
            ${!permission.requiresApproval ? 'checked' : ''}
            ${!permission.visible ? 'disabled' : ''}
          />
          <label for="tool-no-approval-${toolName}">Auto approve</label>
        </div>
      </div>
    `

    container.appendChild(item)
  }
}

/**
 * Handle toggling tool enabled state
 */
async function handleToggleToolVisible(toolName: string, visible: boolean): Promise<void> {
  const config = await getToolPermissions()

  // Update permission
  config.permissions[toolName].visible = visible

  // If disabling, also clear any auto-approval
  if (!visible) {
    config.permissions[toolName].autoApproved = false
  }

  // If enabling but has no approval requirement, mark as auto-approved
  if (visible && !config.permissions[toolName].requiresApproval) {
    config.permissions[toolName].autoApproved = true
  }

  config.lastModified = Date.now()
  await saveToolPermissions(config)
  renderToolPermissions(config)
}

/**
 * Handle toggling whether tool requires approval
 */
async function handleToggleToolRequiresApproval(toolName: string, requiresApproval: boolean): Promise<void> {
  const config = await getToolPermissions()

  // Update permission
  config.permissions[toolName].requiresApproval = requiresApproval

  // If removing approval requirement, mark as auto-approved
  if (!requiresApproval) {
    config.permissions[toolName].autoApproved = true
  }

  config.lastModified = Date.now()
  await saveToolPermissions(config)
  renderToolPermissions(config)
}

/**
 * Handle resetting tool permissions to defaults
 */
async function handleResetToolPermissions(): Promise<void> {
  // Reset to defaults by clearing and reloading
  const { storage } = await import('../lib/storage.ts')
  await storage.setSetting('toolPermissions', null)

  const config = await getToolPermissions()
  renderToolPermissions(config)

  showNotification('Tool permissions reset to defaults')
}

/**
 * Save tool permissions configuration
 */
async function saveToolPermissions(config: ToolPermissionsConfig): Promise<void> {
  const { storage } = await import('../lib/storage.ts')
  await storage.setSetting('toolPermissions', config)
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners(): void {
  // Navigation
  elements.navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab
      if (tab) switchTab(tab)
    })
  })

  // Header buttons
  elements.headerLibraryBtn.addEventListener('click', () =>
    switchTab('library'),
  )
  elements.headerSettingsBtn.addEventListener('click', () =>
    switchTab('settings'),
  )

  // Add Sources tab
  elements.addCurrentTabBtn.addEventListener('click', () => {
    void handleAddCurrentTab()
  })
  elements.importTabs.addEventListener('click', () => {
    void handleImportTabs()
  })
  elements.importTabGroups.addEventListener('click', () => {
    void handleImportTabGroups()
  })
  elements.importBookmarks.addEventListener('click', () => {
    void handleImportBookmarks()
  })
  elements.importHistory.addEventListener('click', () => {
    void handleImportHistory()
  })

  // Chat tab
  elements.notebookSelect.addEventListener('change', () => {
    void handleNotebookChange()
  })
  elements.aiModelBtn.addEventListener('click', toggleAIModelDropdown)
  elements.newNotebookBtn.addEventListener('click', () => {
    void handleNewNotebook()
  })

  // Close AI model dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.aiModelDropdown?.classList.contains('hidden')) {
      const target = e.target
      if (target instanceof Node
        && !elements.aiModelBtn.contains(target)
        && !elements.aiModelDropdown.contains(target)) {
        closeAIModelDropdown()
      }
    }

    // Close autocomplete dropdown when clicking outside
    if (!elements.autocompleteDropdown.classList.contains('hidden')) {
      const target = e.target
      if (target instanceof Node
        && !elements.queryInput.contains(target)
        && !elements.autocompleteDropdown.contains(target)) {
        hideAutocomplete()
      }
    }
  })
  elements.queryBtn.addEventListener('click', () => {
    void handleQuery()
  })
  elements.queryInput.addEventListener('input', handleAutocompleteInput)
  elements.queryInput.addEventListener('keydown', (e) => {
    // Handle autocomplete keyboard navigation first
    handleAutocompleteKeydown(e)

    // Handle Enter key for query submission
    if (e.key === 'Enter' && !e.defaultPrevented) {
      // Hide autocomplete before submitting
      hideAutocomplete()
      void handleQuery()
    }
  })
  elements.addPageBtn.addEventListener('click', () => {
    void handleAddCurrentTab()
  })
  elements.clearChatBtn?.addEventListener('click', () => {
    void handleClearChat()
  })
  elements.chatMessages?.addEventListener('click', handleCitationClick)
  elements.regenerateSummaryBtn?.addEventListener(
    'click',
    () => {
      void handleRegenerateSummary()
    },
  )

  // Refresh all sources
  elements.refreshAllSourcesBtn?.addEventListener('click', () => {
    void handleRefreshAllSources()
  })

  // Suggested links
  elements.refreshLinksBtn?.addEventListener('click', () => {
    void handleRefreshSuggestedLinks()
  })
  elements.suggestedLinksList?.addEventListener('click', (e) => {
    void handleSuggestedLinkClick(e)
  })

  // Transform tab
  elements.transformPodcast?.addEventListener('click', () => {
    void handleTransform('podcast')
  })
  elements.transformQuiz?.addEventListener('click', () => {
    void handleTransform('quiz')
  })
  elements.transformTakeaways?.addEventListener('click', () => {
    void handleTransform('takeaways')
  })
  elements.transformEmail?.addEventListener('click', () => {
    void handleTransform('email')
  })
  elements.transformSlidedeck?.addEventListener('click', () => {
    void handleTransform('slidedeck')
  })
  elements.transformReport?.addEventListener('click', () => {
    void handleTransform('report')
  })
  elements.transformDatatable?.addEventListener('click', () => {
    void handleTransform('datatable')
  })
  elements.transformMindmap?.addEventListener('click', () => {
    void handleTransform('mindmap')
  })
  elements.transformFlashcards?.addEventListener('click', () => {
    void handleTransform('flashcards')
  })
  elements.transformTimeline?.addEventListener('click', () => {
    void handleTransform('timeline')
  })
  elements.transformGlossary?.addEventListener('click', () => {
    void handleTransform('glossary')
  })
  elements.transformComparison?.addEventListener('click', () => {
    void handleTransform('comparison')
  })
  elements.transformFaq?.addEventListener('click', () => {
    void handleTransform('faq')
  })
  elements.transformActionitems?.addEventListener('click', () => {
    void handleTransform('actionitems')
  })
  elements.transformExecutivebrief?.addEventListener('click', () => {
    void handleTransform('executivebrief')
  })
  elements.transformStudyguide?.addEventListener('click', () => {
    void handleTransform('studyguide')
  })
  elements.transformProscons?.addEventListener('click', () => {
    void handleTransform('proscons')
  })
  elements.transformCitations?.addEventListener('click', () => {
    void handleTransform('citations')
  })
  elements.transformOutline?.addEventListener('click', () => {
    void handleTransform('outline')
  })

  // Settings tab
  elements.permTabs.addEventListener('change', () => {
    void handlePermissionToggle('tabs')
  })
  elements.permTabGroups.addEventListener('change', () => {
    void handlePermissionToggle('tabGroups')
  })
  elements.permBookmarks.addEventListener('change', () => {
    void handlePermissionToggle('bookmarks')
  })
  elements.permHistory.addEventListener('change', () => {
    void handlePermissionToggle('history')
  })
  elements.resetToolPermissionsBtn.addEventListener('click', () => {
    void handleResetToolPermissions()
  })

  // Tool Permissions
  elements.toolPermissionsList.addEventListener('change', (e) => {
    const target = e.target
    if (
      target instanceof HTMLInputElement
      && target.dataset.toolName
      && target.dataset.action
    ) {
      const toolName = target.dataset.toolName
      const action = target.dataset.action

      if (action === 'visible') {
        void handleToggleToolVisible(toolName, target.checked)
      }
      else if (action === 'noApproval') {
        // Checkbox is "Auto approve", so checked = no approval needed
        void handleToggleToolRequiresApproval(toolName, !target.checked)
      }
    }
  })

  elements.toolBasedContext.addEventListener('change', () => {
    const mode = elements.toolBasedContext.checked ? 'agentic' : 'classic'
    void setContextMode(mode)
    void updateChromeToolsWarning()
  })
  elements.clearAllDataBtn.addEventListener('click', () => {
    void handleClearAllData()
  })

  // Old AI settings event listeners - replaced by provider-config-ui.ts
  /*
  elements.aiProvider.addEventListener("change", handleProviderChange);
  elements.aiModel.addEventListener("change", handleModelChange);
  elements.aiModel.addEventListener("focus", () => toggleDropdown(true));
  elements.aiModel.addEventListener("input", () => {
    if (!dropdownOpen) {
      toggleDropdown(true);
    } else {
      populateModelDropdown();
    }
  });
  elements.aiModel.addEventListener("keydown", handleKeyDown);
  elements.modelDropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
    // Focus input so arrow keys work for accessibility
    elements.aiModel.focus();
  });
  // Prevent clicks inside dropdown from closing it (set up once during initialization)
  elements.modelDropdownMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  elements.apiKey.addEventListener("change", handleApiKeyChange);
  elements.testApiBtn.addEventListener("click", handleTestApi);
  elements.aiTemperature.addEventListener("input", handleTemperatureChange);
  elements.aiMaxTokens.addEventListener("change", handleMaxTokensChange);
  elements.aiBaseUrl.addEventListener("change", handleBaseUrlChange);
  */

  // Picker Modal
  elements.pickerClose?.addEventListener('click', closePicker)
  elements.pickerCancel?.addEventListener('click', closePicker)
  elements.pickerBackdrop?.addEventListener('click', closePicker)
  elements.pickerAdd?.addEventListener('click', () => {
    void handlePickerAdd()
  })
  elements.pickerSearch?.addEventListener('input', handlePickerSearch)
}

// ============================================================================
// Tab Navigation
// ============================================================================

function switchTab(tabName: string): void {
  // Update nav items
  elements.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.tab === tabName)
  })

  // Update tab content
  elements.tabContents.forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabName}`)
  })

  // Refresh data when switching tabs
  if (tabName === 'library') {
    void loadNotebooksList()
  }
  else if (tabName === 'chat') {
    void loadSources()
    void loadChatHistory()
  }
  else if (tabName === 'transform') {
    void loadSources()
  }
}

// ============================================================================
// Notebooks
// ============================================================================

async function loadNotebooks(): Promise<void> {
  const notebooks = await getNotebooks()

  elements.notebookSelect.innerHTML
    = '<option value="">Select a notebook...</option>'

  for (const notebook of notebooks) {
    const option = document.createElement('option')
    option.value = notebook.id
    option.textContent = notebook.name
    elements.notebookSelect.appendChild(option)
  }

  if (currentNotebookId) {
    elements.notebookSelect.value = currentNotebookId
  }
}

// Current selected model config ID for the dropdown
let currentSelectedModelConfigId: string | undefined = undefined

/**
 * Create a checkmark SVG element
 */
function createCheckmarkSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.classList.add('ai-model-item-check', 'hidden')

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  polyline.setAttribute('points', '20 6 9 17 4 12')
  svg.appendChild(polyline)

  return svg
}

/**
 * Load AI model configs into the dropdown
 */
async function loadAIConfigs(): Promise<void> {
  const modelConfigs = await getModelConfigs()
  const defaultConfig = await getDefaultModelConfig()

  // Clear existing items
  while (elements.aiModelList.firstChild) {
    elements.aiModelList.removeChild(elements.aiModelList.firstChild)
  }

  // Add "Default" option which uses the default model config
  const defaultItem = createModelItem(
    '',
    defaultConfig ? `Default (${defaultConfig.name})` : 'Default',
    true,
  )
  elements.aiModelList.appendChild(defaultItem)

  // Add all model configs
  for (const config of modelConfigs) {
    const item = createModelItem(config.id, config.name, false)
    elements.aiModelList.appendChild(item)
  }

  // Update selection based on current notebook
  await updateAIConfigForNotebook()
}

/**
 * Create a model item element for the dropdown
 */
function createModelItem(id: string, name: string, isDefault: boolean): HTMLElement {
  const item = document.createElement('div')
  item.className = 'ai-model-item'
  item.dataset.modelId = id

  const checkmark = createCheckmarkSvg()

  const content = document.createElement('div')
  content.className = 'ai-model-item-content'

  const nameEl = document.createElement('div')
  nameEl.className = 'ai-model-item-name'
  nameEl.textContent = name
  content.appendChild(nameEl)

  if (isDefault) {
    const defaultLabel = document.createElement('div')
    defaultLabel.className = 'ai-model-item-default'
    defaultLabel.textContent = 'Uses your default AI profile'
    content.appendChild(defaultLabel)
  }

  item.appendChild(checkmark)
  item.appendChild(content)

  item.addEventListener('click', () => {
    void handleModelItemClick(id)
  })

  return item
}

/**
 * Toggle the AI model dropdown visibility
 */
function toggleAIModelDropdown(): void {
  const isHidden = elements.aiModelDropdown.classList.contains('hidden')
  if (isHidden) {
    elements.aiModelDropdown.classList.remove('hidden')
    elements.aiModelBtn.classList.add('active')
  }
  else {
    closeAIModelDropdown()
  }
}

/**
 * Close the AI model dropdown
 */
function closeAIModelDropdown(): void {
  elements.aiModelDropdown.classList.add('hidden')
  elements.aiModelBtn.classList.remove('active')
}

/**
 * Handle clicking on a model item in the dropdown
 */
async function handleModelItemClick(modelId: string): Promise<void> {
  if (!currentNotebookId) {
    closeAIModelDropdown()
    return
  }

  // Update storage
  const notebook = await getNotebook(currentNotebookId)
  if (notebook) {
    notebook.modelConfigId = modelId || undefined
    await saveNotebook(notebook)
  }

  // Update UI
  currentSelectedModelConfigId = modelId || undefined
  updateModelDropdownSelection()
  closeAIModelDropdown()
}

/**
 * Update the visual selection state in the dropdown
 */
function updateModelDropdownSelection(): void {
  const items = elements.aiModelList.querySelectorAll('.ai-model-item')
  items.forEach((item) => {
    if (!(item instanceof HTMLElement)) return
    const el = item
    const modelId = el.dataset.modelId || ''
    const isSelected = modelId === (currentSelectedModelConfigId || '')

    el.classList.toggle('selected', isSelected)
    const checkmark = el.querySelector('.ai-model-item-check')
    if (checkmark) {
      checkmark.classList.toggle('hidden', !isSelected)
    }
  })
}

/**
 * Update the AI config based on the current notebook's setting
 */
async function updateAIConfigForNotebook(): Promise<void> {
  if (!currentNotebookId) {
    currentSelectedModelConfigId = undefined
    updateModelDropdownSelection()
    return
  }

  const notebook = await getNotebook(currentNotebookId)
  currentSelectedModelConfigId = notebook?.modelConfigId || undefined
  updateModelDropdownSelection()
}

async function loadNotebooksList(): Promise<void> {
  const notebooks = await getNotebooks()

  if (notebooks.length === 0) {
    elements.notebooksList.innerHTML = `
      <div class="empty-state">
        <p>No notebooks yet. Create one to get started.</p>
      </div>
    `
    return
  }

  elements.notebooksList.innerHTML = ''

  for (const notebook of notebooks) {
    const sources = await getSourcesByNotebook(notebook.id)
    const div = document.createElement('div')
    div.className = 'notebook-item'

    // Build notebook item using DOM methods for security
    const iconDiv = document.createElement('div')
    iconDiv.className = 'notebook-icon'
    iconDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>`

    const infoDiv = document.createElement('div')
    infoDiv.className = 'notebook-info'
    const nameDiv = document.createElement('div')
    nameDiv.className = 'notebook-name'
    nameDiv.textContent = notebook.name
    const metaDiv = document.createElement('div')
    metaDiv.className = 'notebook-meta'
    metaDiv.textContent = `${sources.length} sources`
    infoDiv.appendChild(nameDiv)
    infoDiv.appendChild(metaDiv)

    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'notebook-actions'

    const exportBtn = document.createElement('button')
    exportBtn.className = 'icon-btn btn-export-notebook'
    exportBtn.dataset.id = notebook.id
    exportBtn.title = 'Export notebook'
    exportBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>`

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'icon-btn btn-delete-notebook'
    deleteBtn.dataset.id = notebook.id
    deleteBtn.title = 'Delete notebook'
    deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>`

    actionsDiv.appendChild(exportBtn)
    actionsDiv.appendChild(deleteBtn)

    div.appendChild(iconDiv)
    div.appendChild(infoDiv)
    div.appendChild(actionsDiv)

    infoDiv.addEventListener('click', () => {
      void selectNotebook(notebook.id)
    })

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      void handleExportNotebook(notebook.id)
    })

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      void handleDeleteNotebook(notebook.id, notebook.name)
    })

    elements.notebooksList.appendChild(div)
  }
}

async function handleDeleteNotebook(id: string, name: string): Promise<void> {
  const confirmed = await showConfirmDialog(
    'Delete Notebook',
    `Are you sure you want to delete "${name}"? This will also delete all sources in this notebook.`,
  )

  if (!confirmed) return

  await deleteNotebook(id)

  // If we deleted the active notebook, clear it
  if (currentNotebookId === id) {
    currentNotebookId = null
    await loadNotebooks()
  }

  await loadNotebooksList()
  await loadSources()
  notifyNotebooksChanged()
  showNotification('Notebook deleted')
}

async function handleExportNotebook(id: string): Promise<void> {
  try {
    const notebook = await getNotebook(id)
    if (!notebook) {
      showNotification('Notebook not found')
      return
    }

    const sources = await getSourcesByNotebook(id)
    const chatHistory = await getChatHistory(id)
    const transformations = await getTransformations(id)

    const exportData: NotebookExport = {
      notebook,
      sources,
      chatHistory,
      transformations,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    }

    // Show format selection dialog
    const format = await showExportFormatDialog()
    if (!format) return

    exportNotebook(exportData, format)
    showNotification(`Exported as ${format.toUpperCase()}`)
  }
  catch (error) {
    console.error('Export failed:', error)
    showNotification('Export failed')
  }
}

async function showExportFormatDialog(): Promise<ExportFormat | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'dialog'
    dialog.innerHTML = `
      <h3>Export Format</h3>
      <p>Choose the format for your export:</p>
      <div class="dialog-actions" style="flex-direction: column; gap: 8px;">
        <button class="btn btn-primary btn-export-md" style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Markdown (.md)
        </button>
        <button class="btn btn-outline btn-export-json" style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          JSON (.json)
        </button>
        <button class="btn btn-outline btn-export-cancel" style="width: 100%;">Cancel</button>
      </div>
    `

    const mdBtn = dialog.querySelector('.btn-export-md')
    const jsonBtn = dialog.querySelector('.btn-export-json')
    const cancelBtn = dialog.querySelector('.btn-export-cancel')

    mdBtn?.addEventListener('click', () => {
      dialog.close()
      dialog.remove()
      resolve('markdown')
    })

    jsonBtn?.addEventListener('click', () => {
      dialog.close()
      dialog.remove()
      resolve('json')
    })

    cancelBtn?.addEventListener('click', () => {
      dialog.close()
      dialog.remove()
      resolve(null)
    })

    dialog.addEventListener('close', () => {
      dialog.remove()
      resolve(null)
    })

    document.body.appendChild(dialog)
    dialog.showModal()
  })
}

async function handleNewNotebook(): Promise<void> {
  const name = await showNotebookDialog('New Notebook')
  if (!name) return

  const notebook = createNotebook(name)
  await saveNotebook(notebook)
  currentNotebookId = notebook.id
  await setActiveNotebookId(notebook.id)
  await loadNotebooks()
  await loadNotebooksList()
  elements.notebookSelect.value = notebook.id
  notifyNotebooksChanged()
  showNotification('Notebook created')
}

async function handleNotebookChange(): Promise<void> {
  const id = elements.notebookSelect.value
  currentNotebookId = id || null
  await setActiveNotebookId(currentNotebookId)
  await updateAIConfigForNotebook()
  await loadSources()
  await loadChatHistory()
  await loadTransformHistory(currentNotebookId)
}

async function selectNotebook(id: string): Promise<void> {
  currentNotebookId = id
  await setActiveNotebookId(id)
  await loadNotebooks()
  elements.notebookSelect.value = id
  await updateAIConfigForNotebook()
  switchTab('chat')
  await loadSources()
  await loadChatHistory()
  await loadTransformHistory(id)
}

// ============================================================================
// Sources
// ============================================================================

async function loadSources(): Promise<void> {
  if (!currentNotebookId) {
    elements.activeSources.innerHTML = `
      <div class="empty-state">
        <p>Select or create a notebook to add sources.</p>
      </div>
    `
    elements.sourceCount.textContent = '0'
    elements.sourcesList.innerHTML = ''
    hideSummary()
    hideSuggestedLinksSection()
    return
  }

  const sources = await getSourcesByNotebook(currentNotebookId)
  elements.sourceCount.textContent = sources.length.toString()

  // Render in Chat tab (compact)
  renderSourcesList(elements.activeSources, sources)

  // Render in Add tab (recent sources)
  renderSourcesList(elements.sourcesList, sources.slice(0, 5))

  // Load or generate summary (don't await - let it load in background)
  loadOrGenerateSummary(sources).catch(err =>
    console.warn('[Summary] Failed to load:', err),
  )

  // Load suggested links (don't await - let it load in background)
  loadSuggestedLinks(sources).catch(err =>
    console.warn('[SuggestedLinks] Failed to load:', err),
  )
}

function renderSourcesList(container: HTMLElement, sources: Source[]): void {
  if (sources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No sources added yet.</p>
      </div>
    `
    return
  }

  container.innerHTML = ''

  for (const source of sources) {
    const div = document.createElement('div')
    div.className = 'source-item'

    const domain = new URL(source.url).hostname.replace('www.', '')
    const initial = source.title.charAt(0).toUpperCase()

    // Check if source can be refreshed (has URL and is not manual/text type)
    const canRefresh = source.type !== 'manual' && source.type !== 'text'

    div.innerHTML = `
      <div class="source-icon">${DOMPurify.sanitize(initial)}</div>
      <div class="source-info">
        <div class="source-title">
          <span class="source-title-text">${DOMPurify.sanitize(source.title)}</span>
          <a href="${DOMPurify.sanitize(source.url)}" target="_blank" rel="noopener noreferrer" class="source-external" title="Open in new tab">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
          ${
            canRefresh
              ? `<button class="source-refresh-btn" data-id="${DOMPurify.sanitize(source.id)}" title="Refresh content">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>`
              : ''
          }
        </div>
        <div class="source-url">${DOMPurify.sanitize(domain)}</div>
      </div>
      <div class="source-actions">
        <button class="icon-btn btn-remove" data-id="${DOMPurify.sanitize(
          source.id,
        )}" title="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `

    const removeBtn = div.querySelector('.btn-remove')
    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      void handleRemoveSource(source.id)
    })

    const refreshBtn = div.querySelector('.source-refresh-btn')
    refreshBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      void handleRefreshSource(source.id, refreshBtn as HTMLButtonElement)
    })

    container.appendChild(div)
  }
}

// ============================================================================
// Summary
// ============================================================================

function hideSummary(): void {
  elements.summarySection.style.display = 'none'
}

function showSummary(): void {
  elements.summarySection.style.display = 'block'
  elements.summarySection.open = true
}

function showSummaryLoading(): void {
  showSummary()
  elements.notebookSummary.innerHTML = `
    <div class="summary-loading">
      <span class="loading-spinner"></span>
      <span>Generating summary...</span>
    </div>
  `
}

function showSummaryError(message: string): void {
  showSummary()
  elements.notebookSummary.innerHTML = `
    <div class="summary-error">${escapeHtml(message)}</div>
  `
}

function showSummaryContent(content: string): void {
  showSummary()
  // Render markdown content
  const rendered = renderMarkdown(content)
  elements.notebookSummary.innerHTML = rendered
}

function sourceIdsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((id, i) => id === sortedB[i])
}

async function loadOrGenerateSummary(sources: Source[]): Promise<void> {
  if (!currentNotebookId) {
    hideSummary()
    return
  }

  // Hide summary if no sources
  if (sources.length === 0) {
    hideSummary()
    return
  }

  const sourceIds = sources.map(s => s.id)

  // Check if we have a cached summary with matching source IDs
  const cachedSummary = await getSummary(currentNotebookId)

  if (cachedSummary && sourceIdsMatch(cachedSummary.sourceIds, sourceIds)) {
    // Use cached summary
    showSummaryContent(cachedSummary.content)
    return
  }

  // Need to generate a new summary
  await generateAndSaveSummary(sources, sourceIds)
}

async function generateAndSaveSummary(
  sources: Source[],
  sourceIds: string[],
): Promise<void> {
  if (!currentNotebookId) return

  showSummaryLoading()

  try {
    const content = await generateSummary(sources)

    // Save the summary
    const summary = createSummary(currentNotebookId, sourceIds, content)
    await saveSummary(summary)

    // Display it
    showSummaryContent(content)
  }
  catch (error) {
    const message
      = error instanceof Error ? error.message : 'Failed to generate summary'
    showSummaryError(message)
  }
}

async function handleRegenerateSummary(): Promise<void> {
  if (!currentNotebookId) return

  const sources = await getSourcesByNotebook(currentNotebookId)
  if (sources.length === 0) {
    hideSummary()
    return
  }

  const sourceIds = sources.map(s => s.id)
  await generateAndSaveSummary(sources, sourceIds)
}

// ============================================================================
// Suggested Links
// ============================================================================

/**
 * Show the suggested links section
 */
function showSuggestedLinksSection(): void {
  elements.suggestedLinksSection?.style.setProperty('display', 'block')
}

/**
 * Hide the suggested links section
 */
function hideSuggestedLinksSection(): void {
  elements.suggestedLinksSection?.style.setProperty('display', 'none')
}

/**
 * Show loading state in suggested links
 */
function showSuggestedLinksLoading(): void {
  if (!elements.suggestedLinksContent) return
  const loading = elements.suggestedLinksContent.querySelector('.suggested-links-loading') as HTMLElement
  const empty = elements.suggestedLinksContent.querySelector('.suggested-links-empty') as HTMLElement
  if (loading) loading.style.display = 'flex'
  if (empty) empty.style.display = 'none'
  if (elements.suggestedLinksList) elements.suggestedLinksList.innerHTML = ''
}

/**
 * Hide loading state in suggested links
 */
function hideSuggestedLinksLoading(): void {
  if (!elements.suggestedLinksContent) return
  const loading = elements.suggestedLinksContent.querySelector('.suggested-links-loading') as HTMLElement
  if (loading) loading.style.display = 'none'
}

/**
 * Show empty state in suggested links
 */
function showSuggestedLinksEmpty(): void {
  if (!elements.suggestedLinksContent) return
  const empty = elements.suggestedLinksContent.querySelector('.suggested-links-empty') as HTMLElement
  if (empty) empty.style.display = 'block'
  if (elements.suggestedLinksList) elements.suggestedLinksList.innerHTML = ''
}

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  }
  catch {
    return url
  }
}

/**
 * Render suggested links in the UI
 * Note: All dynamic content is sanitized with DOMPurify to prevent XSS
 */
function renderSuggestedLinks(links: SuggestedLink[]): void {
  hideSuggestedLinksLoading()

  if (links.length === 0) {
    showSuggestedLinksEmpty()
    if (elements.suggestedLinksCount) elements.suggestedLinksCount.textContent = '0'
    return
  }

  if (!elements.suggestedLinksContent) return
  const empty = elements.suggestedLinksContent.querySelector('.suggested-links-empty') as HTMLElement
  if (empty) empty.style.display = 'none'

  if (elements.suggestedLinksCount) elements.suggestedLinksCount.textContent = String(links.length)

  if (!elements.suggestedLinksList) return

  // Build HTML with all dynamic content sanitized via DOMPurify
  elements.suggestedLinksList.innerHTML = links
    .map((link) => {
      const domain = extractDomain(link.url)
      const scorePercent = Math.round(link.relevanceScore * 100)
      return `
        <div class="suggested-link-item" data-url="${DOMPurify.sanitize(link.url)}">
          <div class="suggested-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <div class="suggested-link-info">
            <div class="suggested-link-title">
              <span class="suggested-link-title-text">${DOMPurify.sanitize(link.title)}</span>
            </div>
            <div class="suggested-link-description">${DOMPurify.sanitize(link.description)}</div>
            <div class="suggested-link-url">${DOMPurify.sanitize(domain)}</div>
          </div>
          <div class="suggested-link-actions">
            <button class="icon-btn suggested-link-open" title="Open link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button class="icon-btn btn-primary suggested-link-add" title="Add as source">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div class="suggested-link-score">${scorePercent}%</div>
          </div>
        </div>
      `
    })
    .join('')
}

/**
 * Load and display suggested links for the current notebook
 */
async function loadSuggestedLinks(sources: Source[], forceRefresh = false): Promise<void> {
  if (!currentNotebookId) return

  // Check if sources have any links
  if (!hasExtractableLinks(sources)) {
    hideSuggestedLinksSection()
    return
  }

  // Show the section
  showSuggestedLinksSection()

  // Check cache first (unless forcing refresh)
  const cacheKey = currentNotebookId

  if (!forceRefresh && suggestedLinksCache.has(cacheKey)) {
    const cached = suggestedLinksCache.get(cacheKey)
    if (cached) {
      renderSuggestedLinks(cached)
      return
    }
  }

  // Don't fetch if already loading
  if (suggestedLinksLoading) return

  suggestedLinksLoading = true
  showSuggestedLinksLoading()

  try {
    const links = await filterLinksWithAI(sources, 10)
    suggestedLinksCache.set(cacheKey, links)
    renderSuggestedLinks(links)
  }
  catch (error) {
    console.error('[SuggestedLinks] Failed to load:', error)
    showSuggestedLinksEmpty()
  }
  finally {
    suggestedLinksLoading = false
  }
}

/**
 * Handle refresh button click
 */
async function handleRefreshSuggestedLinks(): Promise<void> {
  if (!currentNotebookId) return

  const sources = await getSourcesByNotebook(currentNotebookId)
  if (sources.length === 0) {
    hideSuggestedLinksSection()
    return
  }

  // Clear cache and reload
  suggestedLinksCache.delete(currentNotebookId)
  await loadSuggestedLinks(sources, true)
}

/**
 * Handle clicks on suggested link items
 */
async function handleSuggestedLinkClick(event: Event): Promise<void> {
  const target = event.target as HTMLElement
  const linkItem = target.closest('.suggested-link-item') as HTMLElement
  if (!linkItem) return

  const url = linkItem.dataset.url
  if (!url) return

  // Check if open button was clicked
  if (target.closest('.suggested-link-open')) {
    window.open(url, '_blank')
    return
  }

  // Check if add button was clicked
  if (target.closest('.suggested-link-add')) {
    await handleAddSuggestedLink(url, linkItem)
    return
  }
}

/**
 * Add a suggested link as a new source
 */
async function handleAddSuggestedLink(url: string, linkItem: HTMLElement): Promise<void> {
  if (!currentNotebookId) return

  // Disable the add button
  const addBtn = linkItem.querySelector('.suggested-link-add') as HTMLButtonElement
  if (addBtn) addBtn.disabled = true

  // Show loading state
  linkItem.style.opacity = '0.5'

  try {
    // Request content extraction from background script
    const response: unknown = await chrome.runtime.sendMessage({
      type: 'EXTRACT_FROM_URL',
      payload: { url, notebookId: currentNotebookId },
    })

    // Type guard for response
    if (isSuccessfulUrlExtractResponse(response)) {
      // Remove the item from the list since it's now a source
      linkItem.remove()

      // Update count (with null checks)
      if (elements.suggestedLinksList && elements.suggestedLinksCount) {
        const remaining = elements.suggestedLinksList.querySelectorAll('.suggested-link-item').length
        elements.suggestedLinksCount.textContent = String(remaining)

        // Update cache
        const cached = suggestedLinksCache.get(currentNotebookId)
        if (cached) {
          suggestedLinksCache.set(
            currentNotebookId,
            cached.filter(link => link.url !== url),
          )
        }

        // Show empty state if no more links
        if (remaining === 0) {
          showSuggestedLinksEmpty()
        }
      }
    }
    else {
      // Failed to add - restore state
      linkItem.style.opacity = '1'
      if (addBtn) addBtn.disabled = false
    }
  }
  catch (error) {
    console.error('[SuggestedLinks] Failed to add link:', error)
    linkItem.style.opacity = '1'
    if (addBtn) addBtn.disabled = false
  }
}

async function handleAddCurrentTab(): Promise<void> {
  if (!currentNotebookId) {
    const name = await showNotebookDialog('Create a notebook first')
    if (!name) return

    const notebook = createNotebook(name)
    await saveNotebook(notebook)
    currentNotebookId = notebook.id
    await setActiveNotebookId(notebook.id)
    await loadNotebooks()
    elements.notebookSelect.value = notebook.id
  }

  // After the guard, currentNotebookId is guaranteed to be set
  const notebookId = currentNotebookId
  if (!notebookId) return

  elements.addCurrentTabBtn.disabled = true

  try {
    // Check for multiple highlighted tabs
    const highlightedTabs = await chrome.tabs.query({
      highlighted: true,
      currentWindow: true,
    })
    const tabsToAdd = highlightedTabs.filter(
      tab => tab.url && !tab.url.startsWith('chrome://'),
    )

    if (tabsToAdd.length > 1) {
      // Multiple tabs selected - send message directly to content scripts
      elements.addCurrentTabBtn.textContent = `Adding ${tabsToAdd.length} tabs...`

      let addedCount = 0
      for (const tab of tabsToAdd) {
        if (!tab.id || !tab.url) continue

        try {
          // Send message directly to the content script in the tab
          const result: unknown = await chrome.tabs.sendMessage(tab.id, {
            action: 'extractContent',
          })

          // Type guard to ensure result has expected properties
          if (isTabExtractContentResponse(result)) {
            const source = createSource(
              notebookId,
              'tab',
              result.url ?? tab.url,
              result.title ?? tab.title ?? 'Untitled',
              result.markdown ?? '',
              result.links,
            )
            await saveSource(source)
            addedCount++
          }
        }
        catch (error) {
          console.error(`Failed to add tab ${tab.url}:`, error)
          // Fallback: add with just title/url if content script not available
          const source = createSource(
            notebookId,
            'tab',
            tab.url,
            tab.title || 'Untitled',
            `Content from: ${tab.url}`,
          )
          await saveSource(source)
          addedCount++
        }
      }

      // Clear suggested links cache so new sources trigger a refresh
      suggestedLinksCache.delete(notebookId)
      await loadSources()
      showNotification(
        `Added ${addedCount} source${addedCount > 1 ? 's' : ''}`,
      )
    }
    else {
      // Single tab - use existing logic
      elements.addCurrentTabBtn.textContent = 'Adding...'
      const response: unknown = await chrome.runtime.sendMessage({
        type: 'EXTRACT_CONTENT',
      })

      // Type guard to ensure response has expected properties
      if (isUrlExtractResponse(response)) {
        const url = response.url ?? ''
        const title = response.title ?? ''
        const content = response.content ?? ''

        const source = createSource(
          notebookId,
          'tab',
          url,
          title,
          content,
          response.links,
        )
        await saveSource(source)
        // Clear suggested links cache so new sources trigger a refresh
        suggestedLinksCache.delete(notebookId)
        await loadSources()
      }
    }
  }
  catch (error) {
    console.error('Failed to add tab(s):', error)
  }
  finally {
    elements.addCurrentTabBtn.disabled = false
    void updateAddTabButton()
  }
}

async function updateAddTabButton(): Promise<void> {
  try {
    const highlightedTabs = await chrome.tabs.query({
      highlighted: true,
      currentWindow: true,
    })
    const validTabs = highlightedTabs.filter(
      tab => tab.url && !tab.url.startsWith('chrome://'),
    )

    if (validTabs.length > 1) {
      elements.addCurrentTabBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add ${validTabs.length} Selected Tabs
      `
    }
    else {
      elements.addCurrentTabBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Current Tab
      `
    }
  }
  catch {
    // Keep default text if query fails
  }
}

async function handleRemoveSource(sourceId: string): Promise<void> {
  await deleteSource(sourceId)
  await loadSources()
}

async function handleRefreshSource(sourceId: string, button: HTMLButtonElement): Promise<void> {
  // Add refreshing state
  button.classList.add('refreshing')
  button.disabled = true

  try {
    const result = await chrome.runtime.sendMessage<Message, { success: boolean, error?: string }>({
      type: 'REFRESH_SOURCE',
      payload: { sourceId },
    })

    if (result?.success) {
      showNotification('Source refreshed')
    }
    else {
      showNotification(result?.error || 'Failed to refresh source')
    }
  }
  catch (error) {
    console.error('Failed to refresh source:', error)
    showNotification('Failed to refresh source')
  }
  finally {
    button.classList.remove('refreshing')
    button.disabled = false
  }
}

async function handleRefreshAllSources(): Promise<void> {
  if (!currentNotebookId) return

  const btn = elements.refreshAllSourcesBtn
  btn.classList.add('refreshing')
  btn.disabled = true

  try {
    const result = await chrome.runtime.sendMessage<Message, { success: boolean, refreshedCount: number, errors: string[] }>({
      type: 'REFRESH_ALL_SOURCES',
      payload: { notebookId: currentNotebookId },
    })

    if (result?.success) {
      if (result.refreshedCount > 0) {
        showNotification(`Refreshed ${result.refreshedCount} source${result.refreshedCount > 1 ? 's' : ''}`)
      }
      else {
        showNotification('No sources to refresh')
      }
      // Reload sources to show updated content
      await loadSources()
    }
    else {
      showNotification('Failed to refresh sources')
    }
  }
  catch (error) {
    console.error('Failed to refresh all sources:', error)
    showNotification('Failed to refresh sources')
  }
  finally {
    btn.classList.remove('refreshing')
    btn.disabled = false
  }
}

// ============================================================================
// Import Options
// ============================================================================

async function handleImportTabs(): Promise<void> {
  if (!permissions.tabs) {
    const granted = await requestPermission('tabs')
    if (!granted) return
    permissions = await checkPermissions()
    updatePermissionUI()
  }

  pickerType = 'tab'
  elements.pickerTitle.textContent = 'Select Tabs'
  elements.pickerList.innerHTML
    = '<div class="picker-loading">Loading tabs...</div>'
  openPicker()

  try {
    const tabs = await chrome.tabs.query({})
    pickerItems = tabs
      .filter(tab => tab.url && !tab.url.startsWith('chrome://'))
      .map(tab => ({
        id: tab.id?.toString() || '',
        url: tab.url || '',
        title: tab.title || 'Untitled',
        favicon: tab.favIconUrl,
      }))
    renderPickerItems()
  }
  catch (error) {
    console.error('Failed to load tabs:', error)
    elements.pickerList.innerHTML
      = '<div class="picker-empty">Failed to load tabs</div>'
  }
}

async function handleImportTabGroups(): Promise<void> {
  // Tab groups require both tabs and tabGroups permissions
  if (!permissions.tabGroups) {
    const granted = await requestPermission('tabGroups')
    if (!granted) return
    permissions = await checkPermissions()
    updatePermissionUI()
  }

  // Also need tabs permission to query tabs in groups
  if (!permissions.tabs) {
    const granted = await requestPermission('tabs')
    if (!granted) return
    permissions = await checkPermissions()
    updatePermissionUI()
  }

  pickerType = 'tabGroup'
  elements.pickerTitle.textContent = 'Select Tab Groups'
  elements.pickerList.innerHTML
    = '<div class="picker-loading">Loading tab groups...</div>'
  openPicker()

  try {
    const groups = await chrome.tabGroups.query({})

    if (groups.length === 0) {
      elements.pickerList.innerHTML
        = '<div class="picker-empty">No tab groups found. Create a tab group first by right-clicking a tab.</div>'
      return
    }

    // Get tab counts for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const tabsInGroup = await chrome.tabs.query({ groupId: group.id })
        return {
          ...group,
          tabCount: tabsInGroup.length,
        }
      }),
    )

    pickerItems = groupsWithCounts.map(group => ({
      id: group.id.toString(),
      url: '', // Tab groups don't have URLs
      title: group.title || `Unnamed ${group.color} group`,
      color: group.color,
      tabCount: group.tabCount,
    }))

    renderPickerItems()
  }
  catch (error) {
    console.error('Failed to load tab groups:', error)
    elements.pickerList.innerHTML
      = '<div class="picker-empty">Failed to load tab groups</div>'
  }
}

async function handleImportBookmarks(): Promise<void> {
  if (!permissions.bookmarks) {
    const granted = await requestPermission('bookmarks')
    if (!granted) return
    permissions = await checkPermissions()
    updatePermissionUI()
  }

  pickerType = 'bookmark'
  elements.pickerTitle.textContent = 'Select Bookmarks'
  elements.pickerList.innerHTML
    = '<div class="picker-loading">Loading bookmarks...</div>'
  openPicker()

  try {
    const bookmarkTree = await chrome.bookmarks.getTree()
    pickerItems = flattenBookmarks(bookmarkTree)
    renderPickerItems()
  }
  catch (error) {
    console.error('Failed to load bookmarks:', error)
    elements.pickerList.innerHTML
      = '<div class="picker-empty">Failed to load bookmarks</div>'
  }
}

function flattenBookmarks(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): PickerItem[] {
  const items: PickerItem[] = []

  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]): void {
    for (const node of nodes) {
      if (node.url) {
        items.push({
          id: node.id,
          url: node.url,
          title: node.title || 'Untitled',
        })
      }
      if (node.children) {
        traverse(node.children)
      }
    }
  }

  traverse(nodes)
  return items
}

async function handleImportHistory(): Promise<void> {
  if (!permissions.history) {
    const granted = await requestPermission('history')
    if (!granted) return
    permissions = await checkPermissions()
    updatePermissionUI()
  }

  pickerType = 'history'
  elements.pickerTitle.textContent = 'Select from History'
  elements.pickerList.innerHTML
    = '<div class="picker-loading">Loading history...</div>'
  openPicker()

  try {
    const historyItems = await chrome.history.search({
      text: '',
      maxResults: 100,
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
    })
    pickerItems = historyItems
      .filter(item => item.url && item.title)
      .map(item => ({
        id: item.id || item.url || '',
        url: item.url || '',
        title: item.title || 'Untitled',
      }))
    renderPickerItems()
  }
  catch (error) {
    console.error('Failed to load history:', error)
    elements.pickerList.innerHTML
      = '<div class="picker-empty">Failed to load history</div>'
  }
}

async function updateTabCount(): Promise<void> {
  try {
    if (permissions.tabs) {
      const tabs = await chrome.tabs.query({})
      elements.tabsCount.textContent = `Choose from ${tabs.length} active tabs`
    }
  }
  catch {
    // Ignore if permission not granted
  }
}

// ============================================================================
// Picker Modal
// ============================================================================

function openPicker(): void {
  selectedPickerItems.clear()
  elements.pickerSearch.value = ''
  updatePickerSelectedCount()
  elements.pickerModal.classList.remove('hidden')
}

function closePicker(): void {
  elements.pickerModal.classList.add('hidden')
  pickerItems = []
  selectedPickerItems.clear()
  pickerType = null
}

async function refreshPickerIfShowingTabs(): Promise<void> {
  // Only refresh if picker is open and showing tabs
  if (pickerType !== 'tab') return
  if (elements.pickerModal.classList.contains('hidden')) return

  try {
    const tabs = await chrome.tabs.query({})
    const currentFilter = elements.pickerSearch.value

    pickerItems = tabs
      .filter(tab => tab.url && !tab.url.startsWith('chrome://'))
      .map(tab => ({
        id: tab.id?.toString() || '',
        url: tab.url || '',
        title: tab.title || 'Untitled',
        favicon: tab.favIconUrl,
      }))

    // Remove any selected items that no longer exist
    const currentIds = new Set(pickerItems.map(item => item.id))
    for (const selectedId of selectedPickerItems) {
      if (!currentIds.has(selectedId)) {
        selectedPickerItems.delete(selectedId)
      }
    }

    renderPickerItems(currentFilter)
    updatePickerSelectedCount()
  }
  catch (error) {
    console.error('Failed to refresh tabs:', error)
  }
}

function renderPickerItems(filter: string = ''): void {
  const filteredItems = filter
    ? pickerItems.filter(
        item =>
          item.title.toLowerCase().includes(filter.toLowerCase())
          || item.url.toLowerCase().includes(filter.toLowerCase()),
      )
    : pickerItems

  if (filteredItems.length === 0) {
    elements.pickerList.innerHTML
      = '<div class="picker-empty">No items found</div>'
    return
  }

  elements.pickerList.innerHTML = ''

  for (const item of filteredItems) {
    const div = document.createElement('div')
    div.className = `picker-item${
      selectedPickerItems.has(item.id) ? ' selected' : ''
    }`
    div.dataset.id = item.id

    const initial = item.title.charAt(0).toUpperCase()

    // Handle tab groups differently
    if (pickerType === 'tabGroup') {
      const colorClass = item.color ? `tab-group-color-${item.color}` : ''
      div.innerHTML = `
        <div class="picker-checkbox">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="picker-icon ${colorClass}" style="background-color: var(--tab-group-${
          item.color || 'grey'
        });">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          </svg>
        </div>
        <div class="picker-info">
          <div class="picker-title">${escapeHtml(item.title)}</div>
          <div class="picker-url">${item.tabCount} tab${
            item.tabCount !== 1 ? 's' : ''
          }</div>
        </div>
      `
    }
    else {
      const domain = getDomain(item.url)
      div.innerHTML = `
        <div class="picker-checkbox">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="picker-icon">
          ${
            item.favicon
              ? `<img src="${escapeHtml(item.favicon)}" alt="">`
              : initial
          }
        </div>
        <div class="picker-info">
          <div class="picker-title">${escapeHtml(item.title)}</div>
          <div class="picker-url">${escapeHtml(domain)}</div>
        </div>
      `

      // Attach error handler safely (no inline JS)
      if (item.favicon) {
        const img = div.querySelector('.picker-icon img')
        if (img instanceof HTMLImageElement) {
          img.addEventListener('error', () => {
            img.style.display = 'none'
            if (img.parentNode) {
              img.parentNode.textContent = initial
            }
          })
        }
      }
    }

    div.addEventListener('click', () => togglePickerItem(item.id))
    elements.pickerList.appendChild(div)
  }
}

function togglePickerItem(id: string): void {
  if (selectedPickerItems.has(id)) {
    selectedPickerItems.delete(id)
  }
  else {
    selectedPickerItems.add(id)
  }

  // Update UI
  const item = elements.pickerList.querySelector(`[data-id="${id}"]`)
  item?.classList.toggle('selected', selectedPickerItems.has(id))
  updatePickerSelectedCount()
}

function updatePickerSelectedCount(): void {
  const count = selectedPickerItems.size
  elements.pickerSelectedCount.textContent = `${count} selected`
  elements.pickerAdd.disabled = count === 0
}

function handlePickerSearch(): void {
  const filter = elements.pickerSearch.value.trim()
  renderPickerItems(filter)
}

async function handlePickerAdd(): Promise<void> {
  if (selectedPickerItems.size === 0) return

  // Ensure notebook exists
  if (!currentNotebookId) {
    const name = await showNotebookDialog('Create a notebook first')
    if (!name) return

    const notebook = createNotebook(name)
    await saveNotebook(notebook)
    currentNotebookId = notebook.id
    await setActiveNotebookId(notebook.id)
    await loadNotebooks()
    elements.notebookSelect.value = notebook.id
  }

  // After the guard, currentNotebookId is guaranteed to be set
  const notebookId = currentNotebookId
  if (!notebookId) return

  const selectedItems = pickerItems.filter(item =>
    selectedPickerItems.has(item.id),
  )
  elements.pickerAdd.disabled = true
  elements.pickerAdd.textContent = 'Adding...'

  let addedCount = 0

  // Handle tab groups specially - need to get all tabs in the group
  if (pickerType === 'tabGroup') {
    for (const groupItem of selectedItems) {
      try {
        const groupId = parseInt(groupItem.id, 10)
        const tabsInGroup = await chrome.tabs.query({ groupId })

        for (const tab of tabsInGroup) {
          if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) continue

          try {
            // Send message directly to content script
            const result: unknown = await chrome.tabs.sendMessage(tab.id, {
              action: 'extractContent',
            })

            // Type guard to ensure result has expected properties
            if (isTabExtractContentResponse(result)) {
              const source = createSource(
                notebookId,
                'tab',
                result.url ?? tab.url,
                result.title ?? tab.title ?? 'Untitled',
                result.markdown ?? '',
                result.links,
              )
              await saveSource(source)
              addedCount++
            }
          }
          catch (error) {
            console.error(`Failed to extract from tab ${tab.url}:`, error)
            // Fallback: add with just title/url
            const source = createSource(
              notebookId,
              'tab',
              tab.url,
              tab.title || 'Untitled',
              `Content from: ${tab.url}`,
            )
            await saveSource(source)
            addedCount++
          }
        }
      }
      catch (error) {
        console.error(`Failed to process tab group ${groupItem.id}:`, error)
      }
    }
  }
  else {
    // Handle regular items (tabs, bookmarks, history)
    for (const item of selectedItems) {
      try {
        // Extract content from the URL
        const response: unknown = await chrome.runtime.sendMessage({
          type: 'EXTRACT_FROM_URL',
          payload: item.url,
        })

        // Type guard to ensure response has expected properties
        if (isUrlExtractResponse(response)) {
          const url = response.url ?? item.url
          const title = response.title ?? item.title
          const content = response.content ?? ''

          const source = createSource(
            notebookId,
            pickerType || 'tab',
            url,
            title,
            content,
            response.links,
          )
          await saveSource(source)
          addedCount++
        }
      }
      catch (error) {
        console.error(`Failed to add ${item.url}:`, error)
        // If extraction fails, add with just the title/url
        const source = createSource(
          notebookId,
          pickerType || 'tab',
          item.url,
          item.title,
          `Content from: ${item.url}`,
        )
        await saveSource(source)
        addedCount++
      }
    }
  }

  closePicker()
  // Clear suggested links cache so new sources trigger a refresh
  suggestedLinksCache.delete(notebookId)
  await loadSources()

  if (addedCount > 0) {
    showNotification(`Added ${addedCount} source${addedCount > 1 ? 's' : ''}`)
  }

  elements.pickerAdd.disabled = false
  elements.pickerAdd.textContent = 'Add Selected'
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  }
  catch {
    return url
  }
}

// ============================================================================
// Slash Commands
// ============================================================================

/**
 * Available slash commands with descriptions
 */
interface SlashCommand {
  command: string
  description: string
  usage: string
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: 'compact',
    description: 'Summarize chat history',
    usage: '/compact [optional custom instructions]',
  },
]

/**
 * Simple fuzzy match scoring function
 * Returns higher score for better matches
 */
function fuzzyMatchScore(text: string, query: string): number {
  if (!query) return 0

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Exact match at start - highest priority
  if (lowerText.startsWith(lowerQuery)) {
    return 100
  }

  // Exact match anywhere
  if (lowerText.includes(lowerQuery)) {
    return 50
  }

  // Character sequence match
  let queryIndex = 0
  let score = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 1
      queryIndex++
    }
  }

  // If we matched all characters in order
  if (queryIndex === lowerQuery.length) {
    return Math.min(score, 49)
  }

  return -1 // No match
}

/**
 * Parse a slash command from user input
 * Returns null if input is not a slash command
 */
function parseSlashCommand(input: string): { command: string, args: string } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }

  // Split on first space to get command and args
  const parts = trimmed.slice(1).split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1).join(' ')

  return { command, args }
}

/**
 * Execute a slash command
 * Returns true if command was handled, false otherwise
 */
async function executeSlashCommand(
  command: string,
  args: string,
): Promise<boolean> {
  switch (command) {
    case 'compact':
      return await handleCompactCommand(args)
    default:
      showNotification(`Unknown command: /${command}`, 3000)
      return false
  }
}

/**
 * /compact - Summarize chat history
 * Usage: /compact [optional custom summarization instructions]
 */
async function handleCompactCommand(customInstructions: string): Promise<boolean> {
  if (!currentNotebookId) {
    showNotification('Please select a notebook first')
    return true
  }

  const history = await getChatHistory(currentNotebookId)
  if (history.length === 0) {
    showNotification('No chat history to compact')
    return true
  }

  elements.chatStatus.textContent = 'Compacting chat history...'
  elements.queryBtn.disabled = true

  try {
    // Build a summary from all messages (filter out tool-result events)
    const conversationText = history
      .filter(e => e.type === 'user' || e.type === 'assistant')
      .map(e => `${e.type}: ${e.content}`)
      .join('\n\n')

    // Prepend instructions to the content for summarization
    const contentToSummarize = customInstructions
      ? `Instructions: ${customInstructions}\n\nConversation:\n${conversationText}`
      : conversationText

    // Create a temporary source object for summarization
    const now = Date.now()
    const chatHistorySource: Source = {
      id: 'chat-history',
      notebookId: currentNotebookId,
      type: 'text',
      url: '',
      title: 'Chat History',
      content: contentToSummarize,
      syncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
      metadata: { wordCount: contentToSummarize.split(/\s+/).length },
    }

    // Use the existing generateSummary function
    const summary = await generateSummary([chatHistorySource])

    // Create a system event with the summary
    const summaryEvent = createAssistantEvent(
      currentNotebookId,
      `**Chat Summary**\n\n${summary}`,
    )
    await saveChatEvent(summaryEvent)

    // Reload chat history to show the summary
    await loadChatHistory()

    showNotification('Chat history compacted')
  }
  catch (error) {
    console.error('Compact failed:', error)
    const errorMessage
      = error instanceof Error ? error.message : 'Failed to compact chat'
    showNotification(`Compact failed: ${errorMessage}`, 4000)
  }
  finally {
    elements.queryBtn.disabled = false
    elements.chatStatus.textContent
      = 'Ask questions to synthesize information from your sources.'
  }

  return true
}

// ============================================================================
// Autocomplete
// ============================================================================

let autocompleteSelectedIndex = -1
let autocompleteFilteredCommands: SlashCommand[] = []
let autocompleteScores: number[] = []

/**
 * Show autocomplete dropdown with filtered commands
 */
function showAutocomplete(commands: SlashCommand[], scores: number[]): void {
  autocompleteFilteredCommands = commands
  autocompleteScores = scores
  autocompleteSelectedIndex = -1

  if (commands.length === 0) {
    hideAutocomplete()
    return
  }

  // Render autocomplete items
  elements.autocompleteDropdown.innerHTML = ''
  for (const cmd of commands) {
    const item = document.createElement('div')
    item.className = 'autocomplete-item'

    const commandSpan = document.createElement('span')
    commandSpan.className = 'autocomplete-item-command'
    commandSpan.textContent = `/${cmd.command}`

    const descriptionSpan = document.createElement('span')
    descriptionSpan.className = 'autocomplete-item-description'
    descriptionSpan.textContent = cmd.description

    item.appendChild(commandSpan)
    item.appendChild(descriptionSpan)

    item.addEventListener('click', () => {
      selectAutocompleteItem(cmd)
    })

    elements.autocompleteDropdown.appendChild(item)
  }

  elements.autocompleteDropdown.classList.remove('hidden')
}

/**
 * Hide autocomplete dropdown
 */
function hideAutocomplete(): void {
  elements.autocompleteDropdown.classList.add('hidden')
  autocompleteSelectedIndex = -1
  autocompleteFilteredCommands = []
  autocompleteScores = []
  elements.autocompleteGhost.textContent = ''
}

/**
 * Select an autocomplete item and insert it into the input
 * @param cmd - The command to select
 * @param submit - Whether to submit the query after selection (default: false)
 */
function selectAutocompleteItem(cmd: SlashCommand, submit = false): void {
  elements.queryInput.value = `/${cmd.command} `
  elements.autocompleteGhost.textContent = ''
  hideAutocomplete()
  elements.queryInput.focus()

  if (submit) {
    // Trigger query submission after a brief delay to allow input to update
    setTimeout(() => {
      void handleQuery()
    }, 0)
  }
}

/**
 * Handle input event for autocomplete
 */
function handleAutocompleteInput(): void {
  const value = elements.queryInput.value

  // Only show autocomplete for slash commands
  if (!value.startsWith('/')) {
    hideAutocomplete()
    return
  }

  // Extract the partial command (after / but before any space)
  const match = value.match(/^\/(\w*)/)
  if (!match) {
    hideAutocomplete()
    elements.autocompleteGhost.textContent = ''
    return
  }

  const partialCommand = match[1]

  // Show all commands if no input after slash
  if (partialCommand === '') {
    showAutocomplete(SLASH_COMMANDS, SLASH_COMMANDS.map(() => 0))
    elements.autocompleteGhost.textContent = ''
    return
  }

  // Score all commands based on fuzzy match
  const scoredCommands = SLASH_COMMANDS.map(cmd => ({
    cmd,
    score: fuzzyMatchScore(cmd.command, partialCommand),
  }))

  // Filter to commands that match (score >= 0)
  const matched = scoredCommands.filter(({ score }) => score >= 0)

  // Sort by score (highest first)
  matched.sort((a, b) => b.score - a.score)

  // Extract commands and scores separately
  const filteredCommands = matched.map(({ cmd }) => cmd)
  const filteredScores = matched.map(({ score }) => score)

  // Show ghost text for high-certainty matches (exact prefix or exact match)
  if (filteredCommands.length === 1 && filteredScores[0] >= 50) {
    const bestMatch = filteredCommands[0]
    // Show full usage (including parameters) in ghost text
    const fullUsage = bestMatch.usage

    // Create a canvas to measure text width
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (context) {
      const inputStyle = window.getComputedStyle(elements.queryInput)
      context.font = inputStyle.font
      const typedWidth = context.measureText(value).width

      // Calculate position from input's computed styles
      const paddingLeft = parseFloat(inputStyle.paddingLeft)
      const paddingTop = parseFloat(inputStyle.paddingTop)

      // Set ghost text position using computed padding values
      elements.autocompleteGhost.style.left = `${paddingLeft + typedWidth}px`
      elements.autocompleteGhost.style.top = `${paddingTop}px`
      elements.autocompleteGhost.textContent = fullUsage.slice(value.length)
    }
  }
  else {
    elements.autocompleteGhost.textContent = ''
  }

  showAutocomplete(filteredCommands, filteredScores)
}

/**
 * Handle keyboard navigation for autocomplete
 */
function handleAutocompleteKeydown(e: KeyboardEvent): void {
  // Check if autocomplete is visible
  const isAutocompleteVisible = !elements.autocompleteDropdown.classList.contains('hidden')

  switch (e.key) {
    case 'ArrowDown':
      if (isAutocompleteVisible) {
        e.preventDefault()
        autocompleteSelectedIndex = Math.min(
          autocompleteSelectedIndex + 1,
          autocompleteFilteredCommands.length - 1,
        )
        updateAutocompleteSelection()
      }
      break

    case 'ArrowUp':
      if (isAutocompleteVisible) {
        e.preventDefault()
        autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, -1)
        updateAutocompleteSelection()
      }
      break

    case 'Enter':
      if (isAutocompleteVisible) {
        // High certainty: single match with high score (exact or prefix match)
        const isHighCertainty
          = autocompleteFilteredCommands.length === 1
            && autocompleteScores[0] >= 50

        if (isHighCertainty) {
          e.preventDefault()
          selectAutocompleteItem(autocompleteFilteredCommands[0], true)
        }
        // User explicitly selected an item with arrows
        else if (autocompleteSelectedIndex >= 0) {
          e.preventDefault()
          selectAutocompleteItem(autocompleteFilteredCommands[autocompleteSelectedIndex], true)
        }
        // Otherwise let the event bubble through to normal submission
      }
      break

    case 'Tab':
      // Check for ghost text first (high-certainty autocomplete)
      if (elements.autocompleteGhost.textContent) {
        e.preventDefault()
        // Complete only the command part (not the usage parameters)
        // Ghost text shows usage suffix, extract just the command name
        const value = elements.queryInput.value
        const ghostText = elements.autocompleteGhost.textContent
        const fullSuggestion = value + ghostText

        // Extract just the command name (up to first space or end)
        const commandMatch = fullSuggestion.match(/^\/\S+/)
        if (commandMatch) {
          elements.queryInput.value = commandMatch[0] + ' '
        }
        elements.autocompleteGhost.textContent = ''
        hideAutocomplete()
        elements.queryInput.focus()
      }
      // Fall through to dropdown selection if no ghost text
      else if (isAutocompleteVisible) {
        e.preventDefault()
        // Select first item if nothing selected, or current selection
        const indexToSelect = autocompleteSelectedIndex >= 0 ? autocompleteSelectedIndex : 0
        if (autocompleteFilteredCommands[indexToSelect]) {
          selectAutocompleteItem(autocompleteFilteredCommands[indexToSelect], false)
        }
      }
      break

    case 'ArrowRight':
      // Accept ghost text if caret is at end of input
      if (elements.autocompleteGhost.textContent
        && elements.queryInput.selectionStart === elements.queryInput.value.length) {
        e.preventDefault()
        // Complete only the command part (not the usage parameters)
        const value = elements.queryInput.value
        const ghostText = elements.autocompleteGhost.textContent
        const fullSuggestion = value + ghostText

        // Extract just the command name (up to first space or end)
        const commandMatch = fullSuggestion.match(/^\/\S+/)
        if (commandMatch) {
          elements.queryInput.value = commandMatch[0] + ' '
        }
        elements.autocompleteGhost.textContent = ''
        // Keep cursor at end
        elements.queryInput.setSelectionRange(elements.queryInput.value.length, elements.queryInput.value.length)
      }
      break

    case 'Escape':
      if (isAutocompleteVisible) {
        e.preventDefault()
        hideAutocomplete()
      }
      break
  }
}

/**
 * Update visual selection in autocomplete dropdown
 */
function updateAutocompleteSelection(): void {
  const items = elements.autocompleteDropdown.querySelectorAll('.autocomplete-item')
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === autocompleteSelectedIndex)
  })

  // Scroll selected item into view
  if (autocompleteSelectedIndex >= 0) {
    const selectedItem = items[autocompleteSelectedIndex]
    if (selectedItem instanceof HTMLElement) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }
}

// ============================================================================
// Chat History & Query
// ============================================================================

async function loadChatHistory(): Promise<void> {
  if (!currentNotebookId) {
    elements.chatMessages.innerHTML = `
      <div class="empty-state">
        <p>Select a notebook to view chat history.</p>
      </div>
    `
    return
  }

  const events = await getChatHistory(currentNotebookId)

  if (events.length === 0) {
    elements.chatMessages.innerHTML = `
      <div class="empty-state">
        <p>Ask a question to get started.</p>
      </div>
    `
    return
  }

  // Fetch sources for citation rendering
  const sources = await getSourcesByNotebook(currentNotebookId)

  elements.chatMessages.innerHTML = ''

  for (const event of events) {
    appendChatEvent(event, sources)
  }

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight
}

/**
 * Append a chat event to the UI. Handles user, assistant, and tool-result events.
 */
function appendChatEvent(
  event: ChatEvent,
  sources: Source[] = [],
  isStreaming: boolean = false,
): HTMLDivElement {
  // Remove empty state if present
  const emptyState = elements.chatMessages.querySelector('.empty-state')
  if (emptyState) {
    emptyState.remove()
  }

  const existingElement = document.getElementById(`msg-${event.id}`)
  if (existingElement) {
    // Update existing element based on event type
    if (event.type === 'assistant' || event.type === 'user') {
      const contentEl = existingElement.querySelector('.chat-message-content')
      if (contentEl) {
        contentEl.innerHTML = formatMarkdown(event.content)
      }
      // Update citations if present
      if (event.type === 'assistant' && event.citations && event.citations.length > 0 && !isStreaming) {
        let citationsEl = existingElement.querySelector('.chat-citations')
        if (!citationsEl) {
          citationsEl = document.createElement('div')
          citationsEl.className = 'chat-citations'
          existingElement.appendChild(citationsEl)
        }
        citationsEl.innerHTML = renderCitations(event.citations, sources)
      }
    }
    if (existingElement instanceof HTMLDivElement) {
      return existingElement
    }
    throw new Error('existingElement is not an HTMLDivElement')
  }

  // Create new element based on event type
  if (event.type === 'user') {
    return appendUserEvent(event)
  }
  else if (event.type === 'assistant') {
    return appendAssistantEvent(event, sources, isStreaming)
  }
  else if (event.type === 'tool-result') {
    return appendToolResultEventToChat(event)
  }

  // Fallback (shouldn't happen - all ChatEvent types are handled above)
  // This satisfies TypeScript's exhaustiveness check
  const _exhaustiveCheck: never = event
  // Cast to string for error message since `never` cannot be used in template literals
  throw new Error(`Unknown event type: ${String(_exhaustiveCheck)}`)
}

/**
 * Append a user event to the chat.
 */
function appendUserEvent(event: ChatEvent & { type: 'user' }): HTMLDivElement {
  const div = document.createElement('div')
  div.id = `msg-${event.id}`
  div.className = 'chat-message user'

  const timeStr = formatRelativeTime(event.timestamp)

  div.innerHTML = `
    <div class="chat-message-role">You</div>
    <div class="chat-message-content">${formatMarkdown(event.content)}</div>
    <div class="chat-message-time">${timeStr}</div>
  `

  elements.chatMessages.appendChild(div)
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight

  return div
}

/**
 * Append an assistant event to the chat.
 */
function appendAssistantEvent(
  event: ChatEvent & { type: 'assistant' },
  sources: Source[] = [],
  isStreaming: boolean = false,
): HTMLDivElement {
  const div = document.createElement('div')
  div.id = `msg-${event.id}`
  div.className = 'chat-message assistant'

  const timeStr = formatRelativeTime(event.timestamp)

  div.innerHTML = `
    <div class="chat-message-role">Assistant</div>
    <div class="chat-message-content">${formatMarkdown(event.content)}</div>
    ${
      event.citations && event.citations.length > 0 && !isStreaming
        ? `
      <div class="chat-citations">
        ${renderCitations(event.citations, sources)}
      </div>
    `
        : ''
    }
    <div class="chat-message-time">${timeStr}</div>
  `

  // If there are tool calls, append them
  if (event.toolCalls && event.toolCalls.length > 0) {
    let toolCallsContainer = div.querySelector('.assistant-tool-calls')
    if (!toolCallsContainer) {
      toolCallsContainer = document.createElement('div')
      toolCallsContainer.className = 'assistant-tool-calls'
      const timeEl = div.querySelector('.chat-message-time')
      if (timeEl) {
        div.insertBefore(toolCallsContainer, timeEl)
      }
    }

    for (const toolCall of event.toolCalls) {
      const toolCallEl = document.createElement('div')
      toolCallEl.className = 'assistant-tool-call'
      toolCallEl.dataset.toolCallId = toolCall.toolCallId

      const argsStr = JSON.stringify(toolCall.args, null, 2)
      toolCallEl.innerHTML = `
        <div class="tool-call-header">
          <span class="tool-call-name">${escapeHtml(toolCall.toolName)}</span>
          <span class="tool-call-status done">Called</span>
        </div>
        ${argsStr.length > 0 ? `<pre class="tool-call-args">${escapeHtml(argsStr)}</pre>` : ''}
      `
      toolCallsContainer.appendChild(toolCallEl)
    }
  }

  elements.chatMessages.appendChild(div)
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight

  return div
}

/**
 * Append a tool result event to the chat.
 */
function appendToolResultEventToChat(event: ChatEvent & { type: 'tool-result' }): HTMLDivElement {
  const div = document.createElement('div')
  div.id = `msg-${event.id}`
  div.className = 'chat-message tool-result'

  const timeStr = formatRelativeTime(event.timestamp)
  const resultStr = typeof event.result === 'string'
    ? event.result
    : JSON.stringify(event.result, null, 2)

  div.innerHTML = `
    <div class="chat-message-role">📊 Result</div>
    <div class="chat-message-content">
      <div class="tool-result-source">from ${escapeHtml(event.toolName)}</div>
      <div class="tool-result-data"><pre>${escapeHtml(resultStr)}</pre></div>
      ${event.error ? `<div class="tool-result-error">${escapeHtml(event.error)}</div>` : ''}
      ${event.duration ? `<div class="tool-result-duration">${event.duration}ms</div>` : ''}
    </div>
    <div class="chat-message-time">${timeStr}</div>
  `

  elements.chatMessages.appendChild(div)
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight

  return div
}

interface GroupedCitation {
  sourceId: string
  sourceTitle: string
  sourceUrl: string
  excerpts: string[]
}

function renderCitations(citations: Citation[], sources: Source[]): string {
  if (citations.length === 0) return ''

  // Group citations by sourceId
  const groupedMap = new Map<string, GroupedCitation>()

  for (const citation of citations) {
    const source = sources.find(s => s.id === citation.sourceId)
    const sourceUrl = source?.url || ''

    if (groupedMap.has(citation.sourceId)) {
      const group = groupedMap.get(citation.sourceId)
      if (group) {
        // Only add unique excerpts
        if (!group.excerpts.includes(citation.excerpt)) {
          group.excerpts.push(citation.excerpt)
        }
      }
    }
    else {
      groupedMap.set(citation.sourceId, {
        sourceId: citation.sourceId,
        sourceTitle: citation.sourceTitle,
        sourceUrl,
        excerpts: [citation.excerpt],
      })
    }
  }

  const grouped = Array.from(groupedMap.values())

  return `
    <div class="chat-citations-title">Sources cited (${grouped.length} source${
      grouped.length !== 1 ? 's' : ''
    })</div>
    ${grouped
      .map((group, sourceIndex) => {
        const sourceNumber = sourceIndex + 1

        if (group.excerpts.length === 1) {
          // Single excerpt - show simple format
          return `
          <div class="citation-item" data-source-id="${
            group.sourceId
          }" data-source-url="${escapeHtml(
            group.sourceUrl,
          )}" data-excerpt="${escapeHtml(group.excerpts[0])}">
            <div class="citation-number">${sourceNumber}</div>
            <div class="citation-content">
              <div class="citation-source">${escapeHtml(
                group.sourceTitle,
              )}</div>
              <div class="citation-excerpt">${escapeHtml(
                group.excerpts[0],
              )}</div>
            </div>
          </div>
        `
        }
        else {
          // Multiple excerpts - show grouped format with sub-labels
          return `
          <div class="citation-group">
            <div class="citation-group-header">
              <div class="citation-number">${sourceNumber}</div>
              <div class="citation-source">${escapeHtml(
                group.sourceTitle,
              )}</div>
              <div class="citation-excerpt-count">${
                group.excerpts.length
              } references</div>
            </div>
            <div class="citation-group-excerpts">
              ${group.excerpts
                .map((excerpt, excerptIndex) => {
                  const subLabel = String.fromCharCode(97 + excerptIndex) // a, b, c, ...
                  return `
                <div class="citation-item citation-sub-item" data-source-id="${
                  group.sourceId
                }" data-source-url="${escapeHtml(
                  group.sourceUrl,
                )}" data-excerpt="${escapeHtml(excerpt)}">
                  <div class="citation-number citation-sub-number">${sourceNumber}${subLabel}</div>
                  <div class="citation-content">
                    <div class="citation-excerpt">${escapeHtml(excerpt)}</div>
                  </div>
                </div>
              `
                })
                .join('')}
            </div>
          </div>
        `
        }
      })
      .join('')}
  `
}

function createTextFragmentUrl(baseUrl: string, excerpt: string): string {
  // Clean up the excerpt for text fragment
  // Take first ~100 chars to avoid overly long fragments
  let text = excerpt.trim()
  if (text.length > 100) {
    // Try to cut at a word boundary
    text = text.substring(0, 100)
    const lastSpace = text.lastIndexOf(' ')
    if (lastSpace > 50) {
      text = text.substring(0, lastSpace)
    }
  }

  // Remove any existing fragment
  const urlWithoutFragment = baseUrl.split('#')[0]

  // Encode the text for URL
  const encodedText = encodeURIComponent(text)

  return `${urlWithoutFragment}#:~:text=${encodedText}`
}

function handleCitationClick(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const citationItem = target.closest('.citation-item')

  if (!(citationItem instanceof HTMLElement)) return

  const sourceUrl = citationItem.dataset.sourceUrl
  const excerpt = citationItem.dataset.excerpt

  if (!sourceUrl) {
    showNotification('Source URL not available')
    return
  }

  // Skip if excerpt is generic
  if (!excerpt || excerpt === 'Referenced in response') {
    // Just open the URL without text fragment
    void chrome.tabs.create({ url: sourceUrl })
    return
  }

  // Create URL with text fragment
  const fragmentUrl = createTextFragmentUrl(sourceUrl, excerpt)
  void chrome.tabs.create({ url: fragmentUrl })
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/**
 * Append a tool call to the assistant's message (inline, not separate)
 */
function appendToolCallToAssistant(
  messageDiv: HTMLDivElement,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
): HTMLDivElement {
  // Check if we already have a tool-calls container
  let toolCallsContainer = messageDiv.querySelector('.assistant-tool-calls')
  if (!toolCallsContainer) {
    toolCallsContainer = document.createElement('div')
    toolCallsContainer.className = 'assistant-tool-calls'
    // Insert before the timestamp
    const timeEl = messageDiv.querySelector('.chat-message-time')
    if (timeEl) {
      messageDiv.insertBefore(toolCallsContainer, timeEl)
    }
    else {
      messageDiv.appendChild(toolCallsContainer)
    }
  }

  const toolCallEl = document.createElement('div')
  toolCallEl.className = 'assistant-tool-call'
  toolCallEl.dataset.toolCallId = toolCallId
  toolCallEl.dataset.toolName = toolName

  const argsStr = JSON.stringify(args, null, 2)

  toolCallEl.innerHTML = `
    <div class="tool-call-header">
      <span class="tool-call-icon">🔧</span>
      <span class="tool-call-name">${escapeHtml(toolName)}</span>
      <span class="tool-call-status calling">Calling...</span>
    </div>
    <div class="tool-call-args"><pre>${escapeHtml(argsStr)}</pre></div>
  `

  toolCallsContainer.appendChild(toolCallEl)
  return toolCallEl
}

/**
 * Update a tool call's status to show it completed
 */
function updateToolCallStatus(
  toolCallEl: HTMLDivElement,
  status: 'calling' | 'done' | 'error',
): void {
  const statusEl = toolCallEl.querySelector('.tool-call-status')
  if (statusEl) {
    statusEl.className = `tool-call-status ${status}`
    statusEl.textContent = status === 'calling'
      ? 'Calling...'
      : status === 'done'
        ? 'Called'
        : 'Error'
  }
}

async function handleQuery(): Promise<void> {
  const query = elements.queryInput.value.trim()
  if (!query) return

  // Allow chat without a notebook - use empty string as notebook ID for transient chats
  const notebookId = currentNotebookId || ''

  // Check for slash commands first
  const slashCommand = parseSlashCommand(query)
  if (slashCommand) {
    elements.queryInput.value = ''
    await executeSlashCommand(slashCommand.command, slashCommand.args)
    return
  }

  // Get sources if we have a notebook, otherwise empty array
  const sources = notebookId ? await getSourcesByNotebook(notebookId) : []
  // Allow chat without sources or notebook - user can still ask questions

  elements.queryInput.value = ''
  elements.queryBtn.disabled = true
  elements.chatStatus.textContent = 'Preparing...'

  // Save user message
  const userEvent = createUserEvent(notebookId, query)
  await saveChatEvent(userEvent)
  appendChatEvent(userEvent, sources)

  // Get conversation history (includes the message we just saved)
  const history = await getChatHistory(notebookId)

  // Check cache first
  const sourceIds = sources.map(s => s.id)
  const cacheKey = createCacheKey(query, sourceIds)
  const cached = await getCachedResponse(cacheKey)

  if (cached && !navigator.onLine) {
    // Use cached response when offline
    const assistantEvent = createAssistantEvent(
      notebookId,
      cached.response,
      { citations: cached.citations },
    )
    await saveChatEvent(assistantEvent)
    appendChatEvent(assistantEvent, sources)
    elements.queryBtn.disabled = false
    elements.chatStatus.innerHTML
      = 'Response loaded from cache <span class="offline-indicator">Offline</span>'
    return
  }

  // Create placeholder for assistant message
  const assistantEvent = createAssistantEvent(notebookId, '')
  const messageDiv = appendChatEvent(assistantEvent, sources, true)

  try {
    // Get context mode and source tools
    const contextMode = await getContextMode()
    const tools = contextMode === 'agentic' ? await getSourceTools() : undefined

    const stream = streamChat(sources, query, history, {
      tools,
      contextMode,
      onStatus: (status) => {
        elements.chatStatus.textContent = status
      },
    })
    let fullContent = ''
    let citations: Citation[] = []
    let streamResult: IteratorResult<
      StreamEvent,
      { content: string, citations: Citation[] }
    >

    // Track tool calls and their timestamps for persistence
    const toolCalls: import('../types/index.js').ToolCall[] = []
    const pendingToolCalls = new Map<string, HTMLDivElement>()

    // Consume the stream
    while (true) {
      streamResult = await stream.next()
      if (streamResult.done) {
        // Stream finished - get final result with citations
        fullContent = streamResult.value.content
        citations = streamResult.value.citations
        break
      }

      const event = streamResult.value

      // Handle different stream event types
      if (event.type === 'text') {
        fullContent += event.content
        // Update message content as it streams
        const contentEl = messageDiv.querySelector('.chat-message-content')
        if (contentEl) {
          contentEl.innerHTML = formatMarkdown(fullContent)
        }
      }
      else if (event.type === 'tool-call') {
        // Track tool call for persistence
        toolCalls.push({
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          timestamp: Date.now(),
        })

        // Append tool call to assistant's message (not separate entry)
        const toolCallEl = appendToolCallToAssistant(
          messageDiv,
          event.toolCallId,
          event.toolName,
          event.args,
        )
        pendingToolCalls.set(event.toolCallId, toolCallEl)
      }
      else if (event.type === 'tool-result') {
        // Update tool call status
        const toolCallEl = pendingToolCalls.get(event.toolCallId)
        if (toolCallEl) {
          updateToolCallStatus(toolCallEl, 'done')
        }

        // Persist tool result as separate event
        const toolResultEvent = createToolResultEvent(
          notebookId,
          event.toolCallId,
          event.toolName,
          event.result,
        )
        await saveChatEvent(toolResultEvent)

        // Create separate timeline entry for result
        if (toolResultEvent.type === 'tool-result') {
          appendToolResultEventToChat(toolResultEvent)
        }
      }

      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight
    }

    // Update the assistant event with final content, citations, and tool calls
    if (assistantEvent.type === 'assistant') {
      assistantEvent.content = fullContent
      if (citations.length > 0) {
        assistantEvent.citations = citations
      }
      if (toolCalls.length > 0) {
        assistantEvent.toolCalls = toolCalls
      }
    }
    await saveChatEvent(assistantEvent)

    // Re-render with citations
    const contentEl = messageDiv.querySelector('.chat-message-content')
    if (contentEl) {
      contentEl.innerHTML = formatMarkdown(fullContent)
    }

    // Add citations if present
    if (citations.length > 0) {
      const citationsDiv = document.createElement('div')
      citationsDiv.className = 'chat-citations'
      citationsDiv.innerHTML = renderCitations(citations, sources)
      messageDiv.insertBefore(
        citationsDiv,
        messageDiv.querySelector('.chat-message-time'),
      )
    }

    // Cache the response for offline use (only if we have a notebook)
    if (notebookId) {
      const cachedResponse = createCachedResponse(
        notebookId,
        query,
        sourceIds,
        fullContent,
        citations,
      )
      await saveCachedResponse(cachedResponse)
    }

    elements.chatStatus.textContent
      = 'Ask questions to synthesize information from your sources.'
  }
  catch (error) {
    console.error('Query failed:', error)
    const userFriendlyError = formatErrorForUser(error)

    // Check if we have a cached response to fall back to
    if (cached) {
      if (assistantEvent.type === 'assistant') {
        assistantEvent.content = cached.response
        assistantEvent.citations = cached.citations
      }
      await saveChatEvent(assistantEvent)

      const contentEl = messageDiv.querySelector('.chat-message-content')
      if (contentEl) {
        contentEl.innerHTML = formatMarkdown(cached.response)
      }

      if (cached.citations.length > 0) {
        const citationsDiv = document.createElement('div')
        citationsDiv.className = 'chat-citations'
        citationsDiv.innerHTML = renderCitations(cached.citations, sources)
        messageDiv.insertBefore(
          citationsDiv,
          messageDiv.querySelector('.chat-message-time'),
        )
      }

      elements.chatStatus.innerHTML = 'Response loaded from cache (API error)'
      showNotification('Using cached response due to API error')
    }
    else {
      // Show error in the message with user-friendly formatting
      const errorContent = `Failed to generate response: ${userFriendlyError}`
      if (assistantEvent.type === 'assistant') {
        assistantEvent.content = errorContent
      }
      await saveChatEvent(assistantEvent)

      const contentEl = messageDiv.querySelector('.chat-message-content')
      if (contentEl) {
        contentEl.innerHTML = `<p class="error">${escapeHtml(errorContent)}</p>`
      }
      elements.chatStatus.textContent = userFriendlyError
    }
  }
  finally {
    elements.queryBtn.disabled = false
  }
}

async function handleClearChat(): Promise<void> {
  if (!currentNotebookId) return

  const confirmed = await showConfirmDialog(
    'Clear Chat History',
    'Are you sure you want to clear all chat messages for this notebook?',
  )

  if (!confirmed) return

  await clearChatHistory(currentNotebookId)
  await loadChatHistory()
  showNotification('Chat history cleared')
}

// ============================================================================
// Transformations
// ============================================================================

// Track sandboxes for proper cleanup when cards are removed
const cardSandboxes = new WeakMap<HTMLElement, SandboxRenderer>()
// Track all active sandboxes for theme updates (using a Set for easy iteration)
const activeSandboxes = new Set<SandboxRenderer>()

// Helper to get the theme value to send to sandbox
function getSandboxTheme(): 'light' | 'dark' | null {
  const preference = getPreference()
  // If system, return null so sandbox uses its own media query detection
  // Otherwise return the explicit theme
  return preference === 'system' ? null : preference
}

// Subscribe to theme changes to update all sandboxes
onThemeChange(() => {
  const theme = getSandboxTheme()
  activeSandboxes.forEach((sandbox) => {
    sandbox.setTheme(theme)
  })
})
// Track transform metadata for each card (for save/delete operations)
interface TransformCardMeta {
  id: string | null // null until saved
  notebookId: string
  type: TransformationType
  title: string
  content: string
  sourceIds: string[]
  isInteractive: boolean
}
const cardMetadata = new WeakMap<HTMLElement, TransformCardMeta>()
const MAX_TRANSFORM_HISTORY = 10

// SVG icons for transform card actions
const ICONS = {
  copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>`,
  save: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>`,
  saved: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>`,
  openNewTab: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>`,
  delete: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>`,
}

// Helper to create a transform result card element
function createTransformResultCard(
  title: string,
  notebookId: string,
  type: TransformationType,
  sourceIds: string[],
): {
  card: HTMLDivElement
  sandbox: SandboxRenderer
  setContent: (content: string, isInteractive: boolean) => void
} {
  const card = document.createElement('div')
  card.className = 'transform-result'

  const header = document.createElement('div')
  header.className = 'transform-result-header'

  const titleEl = document.createElement('h3')
  titleEl.textContent = title

  const actions = document.createElement('div')
  actions.className = 'transform-result-actions'

  // Save button (disabled until generation completes)
  const saveBtn = document.createElement('button')
  saveBtn.className = 'icon-btn'
  saveBtn.title = 'Save'
  saveBtn.innerHTML = ICONS.save
  saveBtn.disabled = true

  // Open in new tab button (disabled until generation completes)
  const openTabBtn = document.createElement('button')
  openTabBtn.className = 'icon-btn'
  openTabBtn.title = 'Open in new tab'
  openTabBtn.innerHTML = ICONS.openNewTab
  openTabBtn.disabled = true

  // Copy button (disabled until generation completes)
  const copyBtn = document.createElement('button')
  copyBtn.className = 'icon-btn'
  copyBtn.title = 'Copy'
  copyBtn.innerHTML = ICONS.copy
  copyBtn.disabled = true

  // Delete/Close button
  const closeBtn = document.createElement('button')
  closeBtn.className = 'icon-btn'
  closeBtn.title = 'Remove'
  closeBtn.innerHTML = ICONS.close

  actions.appendChild(saveBtn)
  actions.appendChild(openTabBtn)
  actions.appendChild(copyBtn)
  actions.appendChild(closeBtn)

  header.appendChild(titleEl)
  header.appendChild(actions)

  const contentContainer = document.createElement('div')
  contentContainer.className = 'transform-content'

  card.appendChild(header)
  card.appendChild(contentContainer)

  // Create sandbox renderer for this card
  const sandbox = new SandboxRenderer(contentContainer)
  cardSandboxes.set(card, sandbox)
  activeSandboxes.add(sandbox)

  // Set the theme when sandbox is ready
  void sandbox.waitForReady().then(() => {
    sandbox.setTheme(getSandboxTheme())
  })

  // Initialize metadata (content will be set later)
  const meta: TransformCardMeta = {
    id: null,
    notebookId,
    type,
    title,
    content: '',
    sourceIds,
    isInteractive: false,
  }
  cardMetadata.set(card, meta)

  // Function to update content after generation and enable action buttons
  const setContent = (content: string, isInteractive: boolean) => {
    meta.content = content
    meta.isInteractive = isInteractive
    // Enable the action buttons now that content is ready
    saveBtn.disabled = false
    openTabBtn.disabled = false
    copyBtn.disabled = false
  }

  // Wire up save button
  saveBtn.addEventListener('click', () => {
    (async () => {
      const cardMeta = cardMetadata.get(card)
      if (!cardMeta || !cardMeta.content) {
        showNotification('Nothing to save yet')
        return
      }

      if (cardMeta.id) {
        showNotification('Already saved')
        return
      }

      const transformation = createTransformation(
        cardMeta.notebookId,
        cardMeta.type,
        cardMeta.title,
        cardMeta.content,
        cardMeta.sourceIds,
      )

      await saveTransformation(transformation)
      cardMeta.id = transformation.id

      // Update UI to show saved state
      saveBtn.innerHTML = ICONS.saved
      saveBtn.title = 'Saved'
      saveBtn.classList.add('saved')
      card.classList.add('transform-saved')

      // Change close button to delete button
      closeBtn.innerHTML = ICONS.delete
      closeBtn.title = 'Delete'

      showNotification('Transform saved')
    })().catch((error) => {
      console.error('Failed to save transform:', error)
      showNotification('Failed to save transform')
    })
  })

  // Wire up open in new tab button
  openTabBtn.addEventListener('click', () => {
    try {
      const cardMeta = cardMetadata.get(card)
      if (!cardMeta || !cardMeta.content) {
        showNotification('Nothing to open yet')
        return
      }

      openTransformInNewTab(cardMeta)
    }
    catch (error) {
      console.error('Failed to open in new tab:', error)
      showNotification('Failed to open in new tab')
    }
  })

  // Wire up copy button
  copyBtn.addEventListener('click', () => {
    copyToClipboard(contentContainer.textContent || '')
  })

  // Wire up close/delete button
  closeBtn.addEventListener('click', () => {
    (async () => {
      const cardMeta = cardMetadata.get(card)

      // If saved, delete from storage
      if (cardMeta?.id) {
        await deleteTransformation(cardMeta.id)
        showNotification('Transform deleted')
      }

      removeTransformCard(card)
    })().catch((error) => {
      console.error('Failed to delete transform:', error)
      showNotification('Failed to delete transform')
    })
  })

  return { card, sandbox, setContent }
}

// Open transform content in a new browser tab
function openTransformInNewTab(meta: TransformCardMeta): void {
  let fullHtml: string

  if (meta.isInteractive) {
    // For interactive content, embed in a sandboxed iframe for security
    // This prevents AI-generated scripts from running with extension privileges
    const escapedContent = meta.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)} - FolioLM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #1a1a2e; }
    body {
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e4e4e7;
    }
    header {
      padding: 16px 24px;
      background: #252538;
      border-bottom: 1px solid #3f3f5a;
    }
    h1 { font-size: 20px; color: #fff; }
    .iframe-container { flex: 1; padding: 24px; }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 12px;
      background: #fff;
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(meta.title)}</h1>
  </header>
  <div class="iframe-container">
    <iframe sandbox="allow-scripts" srcdoc="${escapedContent}"></iframe>
  </div>
</body>
</html>`
  }
  else {
    // For markdown content, sanitize with DOMPurify before insertion
    const renderedContent = renderMarkdown(meta.content)
    const sanitizedContent = DOMPurify.sanitize(renderedContent, {
      USE_PROFILES: { html: true },
    })
    fullHtml = generateFullPageHtml(meta.title, sanitizedContent)
  }

  // Sanitize the entire document for non-interactive content
  if (!meta.isInteractive) {
    fullHtml = DOMPurify.sanitize(fullHtml, {
      WHOLE_DOCUMENT: true,
      USE_PROFILES: { html: true },
    })
  }

  const blob = new Blob([fullHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)

  chrome.tabs.create({ url }, (tab) => {
    // Clean up blob URL when tab finishes loading (not a fixed timeout)
    if (!tab?.id) {
      URL.revokeObjectURL(url)
      return
    }

    const tabId = tab.id
    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        URL.revokeObjectURL(url)
        chrome.tabs.onUpdated.removeListener(listener)
      }
    }

    chrome.tabs.onUpdated.addListener(listener)

    // Fallback cleanup after 30 seconds in case onUpdated never fires
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      URL.revokeObjectURL(url)
    }, 30000)
  })
}

// Generate a full HTML page for viewing markdown transforms
function generateFullPageHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - FolioLM</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e4e4e7;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 24px 0;
      font-size: 28px;
      color: #fff;
      border-bottom: 1px solid #3f3f5a;
      padding-bottom: 12px;
    }
    .content {
      background: #252538;
      border-radius: 12px;
      padding: 32px;
    }
    .content h1, .content h2, .content h3, .content h4 {
      color: #fff;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .content h1:first-child, .content h2:first-child {
      margin-top: 0;
    }
    .content p {
      margin: 0 0 16px 0;
    }
    .content ul, .content ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
    }
    .content code {
      background: #1a1a2e;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    }
    .content pre {
      background: #1a1a2e;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .content pre code {
      background: none;
      padding: 0;
    }
    .content blockquote {
      border-left: 3px solid #8b5cf6;
      margin: 0 0 16px 0;
      padding-left: 16px;
      color: #a1a1aa;
    }
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .content th, .content td {
      border: 1px solid #3f3f5a;
      padding: 12px;
      text-align: left;
    }
    .content th {
      background: #1a1a2e;
    }
    .content a {
      color: #8b5cf6;
    }
    @media print {
      body { background: white; color: black; }
      .container { max-width: 100%; }
      .content { background: white; border: 1px solid #ccc; }
      .content h1, .content h2, .content h3, .content h4 { color: black; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <div class="content">
      ${content}
    </div>
  </div>
</body>
</html>`
}

// Helper to properly remove a transform card and clean up its sandbox
function removeTransformCard(card: HTMLElement): void {
  const sandbox = cardSandboxes.get(card)
  if (sandbox) {
    activeSandboxes.delete(sandbox)
    sandbox.destroy()
    cardSandboxes.delete(card)
  }
  cardMetadata.delete(card)
  card.remove()
}

// Clear all transform cards from history
function clearTransformHistory(): void {
  const cards = [...elements.transformHistory.children]
  for (const card of cards) {
    if (card instanceof HTMLElement) {
      removeTransformCard(card)
    }
  }
}

// Interactive transform types that return HTML
const INTERACTIVE_TRANSFORM_TYPES: TransformationType[] = [
  'quiz',
  'flashcards',
  'timeline',
  'slidedeck',
  'mindmap',
  'studyguide',
]

// Load saved transforms for a notebook and display them
async function loadTransformHistory(notebookId: string | null): Promise<void> {
  console.log('[loadTransformHistory] Called with notebookId:', notebookId)

  // Clear existing transforms first
  clearTransformHistory()

  if (!notebookId) {
    console.log('[loadTransformHistory] No notebookId, returning')
    return
  }

  const transformations = await getTransformations(notebookId)
  console.log('[loadTransformHistory] Found transformations:', transformations.length, transformations)

  // Create cards for each saved transform (already sorted by createdAt desc)
  for (const transformation of transformations) {
    console.log('[loadTransformHistory] Creating card for:', transformation.title, transformation.id)
    const { card, sandbox, setContent } = createTransformResultCard(
      transformation.title,
      transformation.notebookId,
      transformation.type,
      transformation.sourceIds,
    )

    // Get the metadata and update it with saved state
    const meta = cardMetadata.get(card)
    if (meta) {
      meta.id = transformation.id
      meta.content = transformation.content

      // Determine if this is interactive content
      const isInteractive = INTERACTIVE_TRANSFORM_TYPES.includes(transformation.type)
        && (transformation.content.trim().startsWith('<!DOCTYPE') || transformation.content.trim().startsWith('<html'))
      meta.isInteractive = isInteractive

      // Update the setContent tracker
      setContent(transformation.content, isInteractive)
    }

    // Mark the card as saved (update UI to show saved state)
    card.classList.add('transform-saved')

    // Update save button to show saved state
    const saveBtn = card.querySelector<HTMLButtonElement>('.icon-btn[title="Save"]')
    if (saveBtn) {
      saveBtn.innerHTML = ICONS.saved
      saveBtn.title = 'Saved'
      saveBtn.classList.add('saved')
    }

    // Update close button to delete button
    const closeBtn = card.querySelector<HTMLButtonElement>('.icon-btn[title="Remove"]')
    if (closeBtn) {
      closeBtn.innerHTML = ICONS.delete
      closeBtn.title = 'Delete'
    }

    // Append to DOM BEFORE rendering - the sandbox iframe needs to be in the DOM to load
    elements.transformHistory.appendChild(card)

    // Render the content (must be after card is in DOM for sandbox iframe to load)
    // Use the same rendering path as new transforms to ensure consistent display
    try {
      if (meta?.isInteractive) {
        // Interactive HTML content (quiz, flashcards, etc.) - needs script execution
        await sandbox.renderInteractive(transformation.content)
      }
      else {
        // Standard markdown content - render with proper markdown parser
        await sandbox.render(renderMarkdown(transformation.content))
      }
      console.log('[loadTransformHistory] Rendered content for:', transformation.title)
    }
    catch (err) {
      console.error('[loadTransformHistory] Failed to render:', transformation.title, err)
    }
  }
}

// Enforce the max history limit by removing oldest cards
function enforceTransformHistoryLimit(): void {
  const cards = elements.transformHistory.children
  while (cards.length > MAX_TRANSFORM_HISTORY) {
    const oldestCard = cards[cards.length - 1]
    if (oldestCard instanceof HTMLElement) {
      removeTransformCard(oldestCard)
    }
  }
}

async function handleTransform(type: TransformationType): Promise<void> {
  if (!currentNotebookId) {
    showNotification('Please select a notebook first')
    return
  }

  const sources = await getSourcesByNotebook(currentNotebookId)
  if (sources.length === 0) {
    showNotification('Add some sources first')
    return
  }

  const titles: Record<TransformationType, string> = {
    podcast: 'Podcast Script',
    quiz: 'Study Quiz',
    takeaways: 'Key Takeaways',
    email: 'Email Summary',
    slidedeck: 'Slide Deck',
    report: 'Report',
    datatable: 'Data Table',
    mindmap: 'Mind Map',
    flashcards: 'Flashcards',
    timeline: 'Timeline',
    glossary: 'Glossary',
    comparison: 'Comparison Chart',
    faq: 'FAQ',
    actionitems: 'Action Items',
    executivebrief: 'Executive Brief',
    studyguide: 'Study Guide',
    proscons: 'Pros & Cons',
    citations: 'Citation List',
    outline: 'Outline',
  }

  // Get source IDs for saving the transformation later
  const sourceIds = sources.map(s => s.id)

  // Create a new result card and prepend it to the history container
  const { card, sandbox, setContent } = createTransformResultCard(
    titles[type],
    currentNotebookId,
    type,
    sourceIds,
  )
  elements.transformHistory.prepend(card)

  // Enforce the history limit (remove oldest cards if over limit)
  enforceTransformHistoryLimit()

  // Scroll to the new card
  card.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Show loading state
  await sandbox.render('<em>Generating...</em>')

  // Disable all transform buttons during generation
  const buttons = [
    elements.transformPodcast,
    elements.transformQuiz,
    elements.transformTakeaways,
    elements.transformEmail,
    elements.transformSlidedeck,
    elements.transformReport,
    elements.transformDatatable,
    elements.transformMindmap,
    elements.transformFlashcards,
    elements.transformTimeline,
    elements.transformGlossary,
    elements.transformComparison,
    elements.transformFaq,
    elements.transformActionitems,
    elements.transformExecutivebrief,
    elements.transformStudyguide,
    elements.transformProscons,
    elements.transformCitations,
    elements.transformOutline,
  ]
  buttons.forEach(btn => btn && (btn.disabled = true))

  try {
    let result: string

    switch (type) {
      case 'podcast':
        result = await generatePodcastScript(sources, await getTransformConfig('podcast', currentNotebookId))
        break
      case 'quiz':
        result = await generateQuiz(sources, await getTransformConfig('quiz', currentNotebookId))
        break
      case 'takeaways':
        result = await generateKeyTakeaways(sources, await getTransformConfig('takeaways', currentNotebookId))
        break
      case 'email':
        result = await generateEmailSummary(sources, await getTransformConfig('email', currentNotebookId))
        break
      case 'slidedeck':
        result = await generateSlideDeck(sources, await getTransformConfig('slidedeck', currentNotebookId))
        break
      case 'report':
        result = await generateReport(sources, await getTransformConfig('report', currentNotebookId))
        break
      case 'datatable':
        result = await generateDataTable(sources, await getTransformConfig('datatable', currentNotebookId))
        break
      case 'mindmap':
        result = await generateMindMap(sources, await getTransformConfig('mindmap', currentNotebookId))
        break
      case 'flashcards':
        result = await generateFlashcards(sources, await getTransformConfig('flashcards', currentNotebookId))
        break
      case 'timeline':
        result = await generateTimeline(sources, await getTransformConfig('timeline', currentNotebookId))
        break
      case 'glossary':
        result = await generateGlossary(sources, await getTransformConfig('glossary', currentNotebookId))
        break
      case 'comparison':
        result = await generateComparison(sources, await getTransformConfig('comparison', currentNotebookId))
        break
      case 'faq':
        result = await generateFAQ(sources, await getTransformConfig('faq', currentNotebookId))
        break
      case 'actionitems':
        result = await generateActionItems(sources, await getTransformConfig('actionitems', currentNotebookId))
        break
      case 'executivebrief':
        result = await generateExecutiveBrief(sources, await getTransformConfig('executivebrief', currentNotebookId))
        break
      case 'studyguide':
        result = await generateStudyGuide(sources, await getTransformConfig('studyguide', currentNotebookId))
        break
      case 'proscons':
        result = await generateProsCons(sources, await getTransformConfig('proscons', currentNotebookId))
        break
      case 'citations':
        result = await generateCitationList(sources, await getTransformConfig('citations', currentNotebookId))
        break
      case 'outline':
        result = await generateOutline(sources, await getTransformConfig('outline', currentNotebookId))
        break
    }

    // Determine if this is an interactive transform that returns HTML
    const interactiveTypes: TransformationType[] = [
      'quiz',
      'flashcards',
      'timeline',
      'slidedeck',
      'mindmap',
      'studyguide',
    ]

    const isInteractive = interactiveTypes.includes(type) && isHtmlContent(result)

    // Store the content for save/open-in-new-tab functionality
    setContent(result, isInteractive)

    // Render AI-generated content in sandbox for defense-in-depth
    if (isInteractive) {
      // Interactive HTML content (quiz, flashcards, etc.)
      await sandbox.renderInteractive(result)
    }
    else {
      // Standard markdown content - render with proper markdown parser
      await sandbox.render(renderMarkdown(result))
    }
  }
  catch (error) {
    console.error('Transform failed:', error)
    const errorMessage
      = error instanceof Error ? error.message : 'Unknown error'
    const errorHtml = `
      <p class="error">Failed to generate: ${escapeHtml(errorMessage)}</p>
      <p>Please check your API key in Settings.</p>
    `
    await sandbox.render(errorHtml)
  }
  finally {
    buttons.forEach(btn => btn && (btn.disabled = false))
  }
}

// ============================================================================
// Settings
// ============================================================================

function updatePermissionUI(): void {
  elements.permTabs.checked = permissions.tabs
  elements.permTabGroups.checked = permissions.tabGroups
  elements.permBookmarks.checked = permissions.bookmarks
  elements.permHistory.checked = permissions.history

  elements.importTabs.disabled = false
  elements.importTabGroups.disabled = false
  elements.importBookmarks.disabled = false
  elements.importHistory.disabled = false
}

// Old settings UI - replaced by provider-config-ui.ts
/*
function updateSettingsUI(): void {
  if (!aiSettings) return;

  elements.aiProvider.value = aiSettings.provider;
  handleProviderChange();
  elements.aiModel.value = aiSettings.model;

  const apiKey = aiSettings.apiKeys[aiSettings.provider];
  if (apiKey) {
    elements.apiKey.value = apiKey;
  }

  // Load advanced settings
  const temperature = aiSettings.temperature ?? 1;
  elements.aiTemperature.value = temperature.toString();
  elements.temperatureValue.textContent = temperature.toFixed(1);

  if (aiSettings.maxTokens) {
    elements.aiMaxTokens.value = aiSettings.maxTokens.toString();
  } else {
    elements.aiMaxTokens.value = "";
  }

  if (aiSettings.baseURL) {
    elements.aiBaseUrl.value = aiSettings.baseURL;
  } else {
    elements.aiBaseUrl.value = "";
  }
}
*/

async function handlePermissionToggle(
  permission: 'tabs' | 'tabGroups' | 'bookmarks' | 'history',
): Promise<void> {
  // Map permission names to element property names
  const elementMap: Record<string, keyof typeof elements> = {
    tabs: 'permTabs',
    tabGroups: 'permTabGroups',
    bookmarks: 'permBookmarks',
    history: 'permHistory',
  }

  const checkbox = elements[elementMap[permission]]

  if (checkbox instanceof HTMLInputElement && checkbox.checked) {
    const granted = await requestPermission(permission)
    checkbox.checked = granted
  }

  permissions = await checkPermissions()
  updatePermissionUI()
  void updateTabCount()
}

/**
 * Handle clearing all data (notebooks, sources, chat history, AI profiles)
 */
async function handleClearAllData(): Promise<void> {
  const confirmed = await showConfirmDialog(
    'Clear All Data',
    'This will permanently delete all notebooks, sources, chat history, and AI profiles. This action cannot be undone.',
  )

  if (!confirmed) return

  try {
    // Clear all IndexedDB data
    await clearAllData()

    // Clear chrome.storage.local model cache (provider model lists)
    await chrome.storage.local.clear()

    // Reload the sidepanel to refresh UI
    location.reload()
  }
  catch (error) {
    console.error('Failed to clear all data:', error)
    showNotification('Failed to clear all data. Please try again.')
  }
}

// ============================================================================
// Model Dropdown
// ============================================================================

// Old model dropdown - replaced by provider-config-ui.ts
/*
let dropdownOpen = false;
let highlightedIndex = -1;

function setHighlightedIndex(index: number, items: HTMLElement[]): void {
  // Remove previous highlight
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].classList.remove("highlighted");
  }

  highlightedIndex = index;

  // Add new highlight
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].classList.add("highlighted");
    items[highlightedIndex].scrollIntoView({ block: "nearest" });
  }
}

function getDropdownItems(): HTMLElement[] {
  return Array.from(
    elements.modelDropdownMenu.querySelectorAll(".dropdown-item")
  ) as HTMLElement[];
}

function handleKeyDown(e: KeyboardEvent): void {
  let items = getDropdownItems();

  if (items.length === 0 && e.key !== "ArrowDown" && e.key !== "ArrowUp")
    return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!dropdownOpen) {
        toggleDropdown(true);
        // Re-query items after dropdown is opened and populated
        items = getDropdownItems();
        setHighlightedIndex(0, items);
      } else {
        const newIndex =
          highlightedIndex < items.length - 1 ? highlightedIndex + 1 : 0;
        setHighlightedIndex(newIndex, items);
      }
      break;

    case "ArrowUp":
      e.preventDefault();
      if (!dropdownOpen) {
        toggleDropdown(true);
        // Re-query items after dropdown is opened and populated
        items = getDropdownItems();
        setHighlightedIndex(items.length - 1, items);
      } else {
        const newIndex =
          highlightedIndex > 0 ? highlightedIndex - 1 : items.length - 1;
        setHighlightedIndex(newIndex, items);
      }
      break;

    case "Enter":
      e.preventDefault();

      // If something is highlighted, select it
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        const selectedItem = items[highlightedIndex];
        const modelValue = selectedItem.querySelector(".model-id")?.textContent;
        if (modelValue) {
          elements.aiModel.value = modelValue;
          handleModelChange();
          toggleDropdown(false);
        }
        return;
      }

      // If dropdown is open, check if first item is a match before auto-selecting
      if (dropdownOpen && items.length > 0) {
        const firstItem = items[0];
        const firstScore = firstItem.dataset.score
          ? parseInt(firstItem.dataset.score, 10)
          : -1;

        // Only auto-select if it's an actual match (score >= 0)
        if (firstScore >= 0) {
          const modelValue = firstItem.querySelector(".model-id")?.textContent;
          if (modelValue) {
            elements.aiModel.value = modelValue;
            handleModelChange();
            toggleDropdown(false);
          }
        } else {
          // No matches - just close dropdown and keep custom value
          toggleDropdown(false);
        }
      }
      break;

    case "Escape":
      e.preventDefault();
      toggleDropdown(false);
      break;
  }
}

function toggleDropdown(show?: boolean): void {
  dropdownOpen = show !== undefined ? show : !dropdownOpen;
  elements.modelDropdownMenu.hidden = !dropdownOpen;
  elements.aiModel.setAttribute("aria-expanded", dropdownOpen.toString());

  if (dropdownOpen) {
    populateModelDropdown();
    setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 0);
  } else {
    highlightedIndex = -1;
    document.removeEventListener("click", handleOutsideClick);
  }
}

function handleOutsideClick(e: MouseEvent): void {
  if (!elements.modelDropdown.contains(e.target as Node)) {
    toggleDropdown(false);
  }
}

// Simple fuzzy match scoring function
function fuzzyMatchScore(text: string, query: string): number {
  if (!query) return 0;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match at start - highest priority
  if (lowerText.startsWith(lowerQuery)) {
    return 100;
  }

  // Exact match anywhere
  if (lowerText.includes(lowerQuery)) {
    return 50;
  }

  // Character sequence match
  let queryIndex = 0;
  let score = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }

  // If we matched all characters in order
  if (queryIndex === lowerQuery.length) {
    return Math.min(score, 49);
  }

  return -1; // No match
}

function populateModelDropdown(): void {
  const provider = elements.aiProvider.value as AISettings["provider"];
  const query = elements.aiModel.value.trim();

  const modelOptions: Record<string, { value: string; label: string }[]> = {
    anthropic: [
      { value: "claude-sonnet-4-5-20250514", label: "Claude 4.5 Sonnet" },
      { value: "claude-opus-4-5-20250514", label: "Claude 4.5 Opus" },
      { value: "claude-haiku-4-5-20250514", label: "Claude 4.5 Haiku" },
    ],
    openai: [
      { value: "gpt-5", label: "GPT-5" },
      { value: "gpt-5-mini", label: "GPT-5 Mini" },
      { value: "gpt-5.1-instant", label: "GPT-5.1 Instant" },
    ],
    "openai-compatible": [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      { value: "claude-sonnet-4-5-20250514", label: "Claude 4.5 Sonnet (via OpenRouter)" },
      { value: "claude-opus-4-5-20251101", label: "Claude 4.5 Opus (via OpenRouter)" },
    ],
    google: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
      { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
    ],
    chrome: [{ value: "built-in", label: "Chrome Built-in AI" }],
  };

  const models = modelOptions[provider] || [];

  // Score and sort models based on fuzzy match
  const scoredModels = models.map((model) => {
    const labelScore = fuzzyMatchScore(model.label, query);
    const valueScore = fuzzyMatchScore(model.value, query);
    const score = Math.max(labelScore, valueScore);
    return { model, score };
  });

  // Sort by score (highest first), with no matches at the end
  scoredModels.sort((a, b) => {
    if (a.score === -1 && b.score === -1) return 0;
    if (a.score === -1) return 1;
    if (b.score === -1) return -1;
    return b.score - a.score;
  });

  elements.modelDropdownMenu.innerHTML = "";

  // Reset highlight when repopulating due to typing
  highlightedIndex = -1;

  for (const { model, score } of scoredModels) {
    const item = document.createElement("div");
    item.className = "dropdown-item";

    // Store score for keyboard navigation
    item.dataset.score = score.toString();

    // Dim unmatched items slightly
    if (score === -1 && query) {
      item.style.opacity = "0.5";
    }

    if (model.value === elements.aiModel.value) {
      item.classList.add("selected");
    }

    // Add ARIA role for accessibility
    item.setAttribute("role", "option");

    // Create label and ID spans with textContent to prevent XSS
    const labelSpan = document.createElement("span");
    labelSpan.className = "model-label";
    labelSpan.textContent = model.label;

    const idSpan = document.createElement("span");
    idSpan.className = "model-id";
    idSpan.textContent = model.value;

    item.appendChild(labelSpan);
    item.appendChild(idSpan);

    item.addEventListener("click", () => {
      elements.aiModel.value = model.value;
      handleModelChange();
      toggleDropdown(false);
    });

    elements.modelDropdownMenu.appendChild(item);
  }
}
*/

// ============================================================================
// Settings
// ============================================================================

// Old AI settings handlers - replaced by provider-config-ui.ts
/*
async function handleProviderChange(): Promise<void> {
  const provider = elements.aiProvider.value as AISettings["provider"];

  const apiKeyRow = elements.apiKey.parentElement;
  const apiKeyLabel = apiKeyRow?.previousElementSibling as HTMLElement;
  if (apiKeyRow) {
    apiKeyRow.style.display = provider === "chrome" ? "none" : "flex";
  }
  if (apiKeyLabel) {
    apiKeyLabel.style.display = provider === "chrome" ? "none" : "block";
  }

  // Update API key link based on provider
  const apiKeyLinks: Record<string, { url: string; text: string }> = {
    anthropic: {
      url: "https://console.anthropic.com/settings/keys",
      text: "Get a Claude API key",
    },
    openai: {
      url: "https://platform.openai.com/api-keys",
      text: "Get an OpenAI API key",
    },
    "openai-compatible": {
      url: "https://openrouter.ai/keys",
      text: "Get an API key (e.g., OpenRouter)",
    },
    google: {
      url: "https://aistudio.google.com/apikey",
      text: "Get a Gemini API key",
    },
  };

  const linkInfo = apiKeyLinks[provider];
  if (linkInfo) {
    elements.apiKeyLink.href = linkInfo.url;
    elements.apiKeyLink.textContent = linkInfo.text;
    elements.apiKeyLink.style.display = "inline-block";
  } else {
    elements.apiKeyLink.style.display = "none";
  }

  // Load saved API key for this provider
  if (aiSettings) {
    const savedKey = aiSettings.apiKeys[provider] || "";
    elements.apiKey.value = savedKey;
  }

  // Set model to the last model in the list for this provider
  const modelOptions: Record<string, string> = {
    anthropic: "claude-haiku-4-5-20250514",
    openai: "gpt-5.1-instant",
    google: "gemini-3-flash-preview",
    chrome: "built-in",
  };
  const defaultModel = modelOptions[provider] || "";
  elements.aiModel.value = defaultModel;

  await setProvider(provider);
  await setModel(defaultModel);
  aiSettings = await getAISettings();
  populateModelDropdown();
}

async function handleModelChange(): Promise<void> {
  const model = elements.aiModel.value;
  await setModel(model);
  aiSettings = await getAISettings();
}

async function handleApiKeyChange(): Promise<void> {
  const apiKey = elements.apiKey.value.trim();
  const provider = elements.aiProvider.value;
  await setApiKey(provider, apiKey);
  aiSettings = await getAISettings();
}

async function handleTestApi(): Promise<void> {
  const provider = elements.aiProvider.value;
  const apiKey = elements.apiKey.value.trim();

  if (!apiKey && provider !== "chrome") {
    showNotification("Please enter an API key");
    return;
  }

  // Save the API key first
  await handleApiKeyChange();

  elements.testApiBtn.disabled = true;
  elements.testApiBtn.textContent = "Testing...";

  try {
    const result = await testConnection();
    if (result.success) {
      showNotification("Connection successful!");
    } else {
      showNotification(`Connection failed: ${result.error}`, 4000);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    showNotification(`Connection failed: ${errorMessage}`, 4000);
  } finally {
    elements.testApiBtn.disabled = false;
    elements.testApiBtn.textContent = "Test";
  }
}

function handleTemperatureChange(): void {
  const value = parseFloat(elements.aiTemperature.value);
  elements.temperatureValue.textContent = value.toFixed(1);
  setTemperature(value);
}

async function handleMaxTokensChange(): Promise<void> {
  const value = elements.aiMaxTokens.value.trim();
  const maxTokens = value ? parseInt(value, 10) : undefined;
  await setMaxTokens(maxTokens);
  aiSettings = await getAISettings();
}

async function handleBaseUrlChange(): Promise<void> {
  const value = elements.aiBaseUrl.value.trim();
  const baseURL = value || undefined;
  await setBaseURL(baseURL);
  aiSettings = await getAISettings();
}
*/

// ============================================================================
// Utilities
// ============================================================================

function copyToClipboard(text: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification('Copied to clipboard')
    })
    .catch((err) => {
      console.error('Failed to copy:', err)
    })
}

// ============================================================================
// Notifications & Dialogs
// ============================================================================

function showNotification(message: string, duration: number = 2000): void {
  if (!elements.notification) return
  elements.notification.textContent = message
  elements.notification.classList.add('show')
  setTimeout(() => {
    elements.notification.classList.remove('show')
  }, duration)
}

function showNotebookDialog(
  title: string = 'New Notebook',
): Promise<string | null> {
  return new Promise((resolve) => {
    elements.notebookDialogTitle.textContent = title
    elements.notebookNameInput.value = ''
    elements.notebookDialog.showModal()

    const handleCancel = () => {
      elements.notebookDialog.close()
      cleanup()
      resolve(null)
    }

    const handleConfirm = () => {
      const name = elements.notebookNameInput.value.trim()
      elements.notebookDialog.close()
      cleanup()
      resolve(name || null)
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      }
    }

    const cleanup = () => {
      elements.notebookDialogCancel.removeEventListener('click', handleCancel)
      elements.notebookDialogConfirm.removeEventListener(
        'click',
        handleConfirm,
      )
      elements.notebookNameInput.removeEventListener('keydown', handleKeydown)
    }

    elements.notebookDialogCancel.addEventListener('click', handleCancel)
    elements.notebookDialogConfirm.addEventListener('click', handleConfirm)
    elements.notebookNameInput.addEventListener('keydown', handleKeydown)
    elements.notebookNameInput.focus()
  })
}

function showConfirmDialog(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    elements.confirmDialogTitle.textContent = title
    elements.confirmDialogMessage.textContent = message
    elements.confirmDialog.showModal()

    const handleCancel = () => {
      elements.confirmDialog.close()
      cleanup()
      resolve(false)
    }

    const handleConfirm = () => {
      elements.confirmDialog.close()
      cleanup()
      resolve(true)
    }

    const cleanup = () => {
      elements.confirmDialogCancel.removeEventListener('click', handleCancel)
      elements.confirmDialogConfirm.removeEventListener('click', handleConfirm)
    }

    elements.confirmDialogCancel.addEventListener('click', handleCancel)
    elements.confirmDialogConfirm.addEventListener('click', handleConfirm)
  })
}

// ============================================================================
// Onboarding
// ============================================================================

// Store handler references for proper cleanup
let onboardingSkipHandler: (() => void) | null = null
let onboardingNextHandler: (() => void) | null = null
let chromeAIDownloadTriggered = false

/**
 * Trigger Chrome's built-in AI model download during onboarding.
 * This is called on user gestures (Next/Skip clicks) to start the
 * ~1.5GB model download in the background.
 *
 * The download requires a user gesture to start, so we trigger it
 * on the first interaction during onboarding. The download continues
 * in the background without blocking the UI.
 */
function triggerChromeAIDownloadOnGesture(): void {
  // Only trigger once per session
  if (chromeAIDownloadTriggered) {
    return
  }
  chromeAIDownloadTriggered = true

  console.log('[Onboarding] Triggering Chrome AI model download on user gesture')

  startModelDownloadAsync(
    // Progress callback
    (progress) => {
      console.log(`[Onboarding] Chrome AI download progress: ${(progress * 100).toFixed(1)}%`)
    },
    // Completion callback
    (result) => {
      if (result.success) {
        console.log(`[Onboarding] Chrome AI model ready (status: ${result.status})`)
      }
      else {
        console.log(`[Onboarding] Chrome AI model not available: ${result.error || result.status}`)
      }
    },
  )
}

function showOnboarding(): void {
  onboardingStep = 0
  renderOnboardingStep()
  elements.onboardingOverlay.classList.remove('hidden')

  // Setup event listeners
  onboardingSkipHandler = () => {
    // Trigger Chrome AI download on user gesture
    triggerChromeAIDownloadOnGesture()
    void completeOnboarding()
  }
  onboardingNextHandler = () => {
    // Trigger Chrome AI download on user gesture
    triggerChromeAIDownloadOnGesture()
    nextOnboardingStep()
  }
  elements.onboardingSkip.addEventListener('click', onboardingSkipHandler)
  elements.onboardingNext.addEventListener('click', onboardingNextHandler)
}

function renderOnboardingStep(): void {
  const step = ONBOARDING_STEPS[onboardingStep]
  if (!step) return

  elements.onboardingIcon.innerHTML = step.icon
  elements.onboardingTitle.textContent = step.title
  elements.onboardingDescription.textContent = step.description

  // Update dots
  elements.onboardingDots.innerHTML = ONBOARDING_STEPS.map((_, index) => {
    const activeClass = index === onboardingStep ? 'active' : ''
    return `<div class="onboarding-dot ${activeClass}"></div>`
  }).join('')

  // Update button text
  const isLastStep = onboardingStep === ONBOARDING_STEPS.length - 1
  elements.onboardingNext.textContent = isLastStep ? 'Get Started' : 'Next'
}

function nextOnboardingStep(): void {
  if (onboardingStep < ONBOARDING_STEPS.length - 1) {
    onboardingStep++
    renderOnboardingStep()
  }
  else {
    void completeOnboarding()
  }
}

async function completeOnboarding(): Promise<void> {
  await markOnboardingComplete()
  elements.onboardingOverlay.classList.add('hidden')

  // Clean up event listeners and state
  if (onboardingSkipHandler) {
    elements.onboardingSkip.removeEventListener('click', onboardingSkipHandler)
    onboardingSkipHandler = null
  }
  if (onboardingNextHandler) {
    elements.onboardingNext.removeEventListener('click', onboardingNextHandler)
    onboardingNextHandler = null
  }
  // Reset download flag so it can trigger again if onboarding restarts
  chromeAIDownloadTriggered = false

  // Switch to settings tab to prompt AI setup
  switchTab('settings')
  showNotification('Welcome to FolioLM! Set up an AI profile to get started.')
}

// ============================================================================
// Helper Functions for TSX Integration
// ============================================================================

/**
 * Get the current notebook's sources.
 * Used by TSX handlers that need access to the current sources.
 */
async function getCurrentSources(): Promise<Source[]> {
  if (!currentNotebookId) {
    return []
  }
  return await getSourcesByNotebook(currentNotebookId)
}

// ============================================================================
// Exported Handlers for TSX Integration
// ============================================================================

/**
 * Exported handlers for use by TSX components.
 * These functions bridge the TSX UI with the business logic in this module.
 */
export const handlers = {
  // Tab navigation
  switchTab,

  // Notebook management
  handleNewNotebook,
  handleNotebookChange,
  selectNotebook,
  handleDeleteNotebook,
  handleExportNotebook,

  // Source management
  handleAddCurrentTab,
  handleImportTabs,
  handleImportTabGroups,
  handleImportBookmarks,
  handleImportHistory,
  handleRemoveSource,

  // Chat & Query
  handleQuery,
  handleClearChat,
  handleCitationClick,

  // Summary & Suggested Links
  handleRegenerateSummary: async () => {
    const sources = await getCurrentSources()
    await loadOrGenerateSummary(sources)
  },
  handleRefreshSuggestedLinks: async () => {
    const sources = await getCurrentSources()
    await loadSuggestedLinks(sources, true)
  },

  // Transformations
  handleTransform,

  // Settings & Permissions
  handlePermissionToggle,
  handleClearAllData,

  // AI Profile tools
  handleToggleToolVisible,
  handleToggleToolRequiresApproval,
  handleResetToolPermissions,

  // Autocomplete
  handleAutocompleteInput,
  handleAutocompleteKeydown,

  // Dialogs
  showNotebookDialog,
  showConfirmDialog,

  // Notifications
  showNotification,

  // Onboarding
  showOnboarding,
}

// Export state getters for TSX components
export const getState = {
  getCurrentNotebookId: () => currentNotebookId,
  getPermissions: () => permissions,
  getCurrentSources,
}

// ============================================================================
// Start
// ============================================================================

// Export init to be called after DOM is rendered (from main.tsx)
// This prevents race condition where event listeners are attached before DOM exists
export { init as initControllers }

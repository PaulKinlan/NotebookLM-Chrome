/**
 * Global State Store using Preact Signals
 *
 * Signals provide fine-grained reactivity without prop drilling.
 * Components can read signal values directly or use them in computed values.
 */

import { signal, computed } from '@preact/signals'
import type {
  Notebook,
  Source,
  PermissionStatus,
  ThemePreference,
  ResolvedTheme,
  ChatEvent as ChatEventType,
  TransformationType,
} from '../../types/index.ts'
import type { TransformResult } from '../hooks/useTransform.ts'

// ============================================================================
// Pending Transform Types
// ============================================================================

/**
 * Represents a transformation that is currently in progress
 */
export interface PendingTransform {
  /** Unique ID for this pending transform */
  id: string
  /** Transform type being generated */
  type: TransformationType
  /** Notebook this transform belongs to */
  notebookId: string
  /** Source IDs being transformed */
  sourceIds: string[]
  /** When the transform started */
  startTime: number
}

// ============================================================================
// Notebook Signals
// ============================================================================

/** ID of the currently selected notebook */
export const currentNotebookId = signal<string | null>(null)

/** All available notebooks */
export const notebooks = signal<Notebook[]>([])

/** Loading state for notebooks operations */
export const notebooksLoading = signal(false)

/** The currently selected notebook object (computed) */
export const currentNotebook = computed(() =>
  notebooks.value.find(n => n.id === currentNotebookId.value) || null,
)

/** Whether a notebook is currently selected (computed) */
export const hasNotebook = computed(() => currentNotebookId.value !== null)

// ============================================================================
// Navigation Signals
// ============================================================================

export type TabName = 'add' | 'chat' | 'transform' | 'library' | 'settings'

/** Valid tab names for type checking */
const validTabs: TabName[] = ['add', 'chat', 'transform', 'library', 'settings']

function isValidTab(value: unknown): value is TabName {
  return typeof value === 'string' && validTabs.includes(value as TabName)
}

/** Currently active tab */
export const activeTab = signal<TabName>('add')

/**
 * Initialize the active tab from storage.
 * Call this on app startup to restore the previous tab.
 */
export async function initActiveTab(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('activeTab')
    if (isValidTab(result.activeTab)) {
      activeTab.value = result.activeTab
    }
  }
  catch (error) {
    console.error('Failed to load active tab from storage:', error)
  }
}

/**
 * Navigate to a tab with a view transition (crossfade effect).
 * Uses the View Transitions API for smooth panel transitions.
 * Persists the tab selection to storage.
 */
export function navigateToTab(tab: TabName): void {
  // Skip if already on this tab
  if (activeTab.value === tab) {
    return
  }

  // Use View Transitions API if available (Chrome 111+)
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      activeTab.value = tab
    })
  }
  else {
    // Fallback for environments without View Transitions API
    activeTab.value = tab
  }

  // Persist to storage (fire and forget)
  chrome.storage.local.set({ activeTab: tab }).catch(console.error)
}

// ============================================================================
// Notification Signals
// ============================================================================

/** Current notification message (null = none) */
export const notification = signal<string | null>(null)

/** Whether a notification is currently visible (computed) */
export const notificationVisible = computed(() => notification.value !== null)

/** Show a notification message */
export function showNotification(message: string): void {
  notification.value = message
  setTimeout(() => {
    notification.value = null
  }, 3000)
}

/** Clear the current notification */
export function clearNotification(): void {
  notification.value = null
}

// ============================================================================
// Theme Signals
// ============================================================================

/** User's theme preference */
export const themePreference = signal<ThemePreference>('system')

/** Currently resolved theme (what's actually displayed) */
export const resolvedTheme = signal<ResolvedTheme>('dark')

// ============================================================================
// Permission Signals
// ============================================================================

/** Current Chrome extension permissions */
export const permissions = signal<PermissionStatus>({
  tabs: false,
  tabGroups: false,
  bookmarks: false,
  history: false,
})

// ============================================================================
// Source Signals
// ============================================================================

/** Sources for the current notebook */
export const sources = signal<Source[]>([])

/** Loading state for sources operations */
export const sourcesLoading = signal(false)

/** Number of sources (computed) */
export const sourceCount = computed(() => sources.value.length)

/** Whether there are any sources (computed) */
export const hasSources = computed(() => sources.value.length > 0)

/** Source counts by notebook ID (for library view) */
export const sourceCountsByNotebook = signal<Record<string, number>>({})

// ============================================================================
// Chat Signals
// ============================================================================

/** Chat messages for the current notebook */
export const chatMessages = signal<ChatEventType[]>([])

/** Whether a chat query is in progress */
export const chatQuerying = signal(false)

/** Current chat status message */
export const chatStatus = signal('')

/** Number of chat messages (computed) */
export const chatMessageCount = computed(() => chatMessages.value.length)

/** Whether there are any chat messages (computed) */
export const hasChatMessages = computed(() => chatMessages.value.length > 0)

// ============================================================================
// Dialog Signals
// ============================================================================

export interface NotebookDialogState {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialName: string
}

// ============================================================================
// Pending Context Menu Action Types
// ============================================================================

/**
 * Represents a pending action from context menu that requires notebook creation
 */
export type PendingContextMenuAction
  = | { type: 'ADD_PAGE', tabId: number }
    | { type: 'ADD_LINK', linkUrl: string }
    | { type: 'ADD_SELECTION_LINKS', links: string[] }
    | null

/** Pending context menu action that should execute after notebook creation */
export const pendingContextMenuAction = signal<PendingContextMenuAction>(null)

export interface ConfirmDialogState {
  isOpen: boolean
  title: string | null
  message: string | null
}

/** Notebook dialog state */
export const notebookDialog = signal<NotebookDialogState>({
  isOpen: false,
  mode: 'create',
  initialName: '',
})

/** Confirm dialog state */
export const confirmDialog = signal<ConfirmDialogState | null>(null)

/** Confirm dialog callback (stored separately to avoid circular reference) */
export const confirmCallback = signal<(() => void) | null>(null)

// ============================================================================
// Summary Signals
// ============================================================================

/** Summary content for the current notebook */
export const summaryContent = signal<string | null>(null)

/** Whether the summary section should be shown */
export const showSummary = signal(false)

// ============================================================================
// FAB (Floating Action Button) Signals
// ============================================================================

/** Whether the FAB is hidden */
export const fabHidden = signal(false)

// ============================================================================
// Onboarding Signals
// ============================================================================

/** Whether onboarding is complete */
export const onboardingComplete = signal(false)

/** Current onboarding step (0-indexed) */
export const onboardingStep = signal(0)

/** Whether onboarding overlay should be hidden */
export const onboardingHidden = signal(false)

// ============================================================================
// Transform Signals
// ============================================================================

/** Transform history for the current notebook */
export const transformHistory = signal<TransformResult[]>([])

/** Pending transforms currently being generated */
export const pendingTransforms = signal<PendingTransform[]>([])

/** Whether any transformation is in progress (computed for backwards compat) */
export const transforming = computed(() => pendingTransforms.value.length > 0)

/** Number of transforms in history (computed) */
export const transformCount = computed(() => transformHistory.value.length)

/** Whether there are any transforms (computed) */
export const hasTransforms = computed(() => transformHistory.value.length > 0)

/** Number of pending transforms (computed) */
export const pendingTransformCount = computed(() => pendingTransforms.value.length)

// ============================================================================
// Initial Tab State (passed from main.tsx)
// ============================================================================

/** Initial tab to show on first render (set from main.tsx) */
export const initialTab = signal<TabName>('add')

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
} from '../../types/index.ts'
import type { TransformResult } from '../hooks/useTransform.ts'

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

/** Currently active tab */
export const activeTab = signal<TabName>('add')

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

/** Whether a transformation is in progress */
export const transforming = signal(false)

/** Number of transforms in history (computed) */
export const transformCount = computed(() => transformHistory.value.length)

/** Whether there are any transforms (computed) */
export const hasTransforms = computed(() => transformHistory.value.length > 0)

// ============================================================================
// Initial Tab State (passed from main.tsx)
// ============================================================================

/** Initial tab to show on first render (set from main.tsx) */
export const initialTab = signal<TabName>('add')

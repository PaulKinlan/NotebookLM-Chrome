/**
 * Global State Store Barrel Export
 *
 * Re-exports all signals and types from the signals module.
 * This file serves as the public API for the store.
 */

export {
  // Notebook Signals
  currentNotebookId,
  notebooks,
  notebooksLoading,
  currentNotebook,
  hasNotebook,

  // Navigation Signals
  type TabName,
  activeTab,
  navigateToTab,

  // Notification Signals
  notification,
  notificationVisible,
  showNotification,
  clearNotification,

  // Theme Signals
  themePreference,
  resolvedTheme,

  // Permission Signals
  permissions,

  // Source Signals
  sources,
  sourcesLoading,
  sourceCount,
  hasSources,
  sourceCountsByNotebook,

  // Chat Signals
  chatMessages,
  chatQuerying,
  chatStatus,
  chatMessageCount,
  hasChatMessages,

  // Dialog Signals
  type NotebookDialogState,
  type ConfirmDialogState,
  type PendingContextMenuAction,
  notebookDialog,
  confirmDialog,
  confirmCallback,
  pendingContextMenuAction,

  // Summary Signals
  summaryContent,
  showSummary,

  // FAB Signals
  fabHidden,

  // Onboarding Signals
  onboardingComplete,
  onboardingStep,
  onboardingHidden,

  // Transform Signals
  type PendingTransform,
  transformHistory,
  pendingTransforms,
  transforming,
  transformCount,
  hasTransforms,
  pendingTransformCount,

  // Initial Tab State
  initialTab,
} from './signals.ts'

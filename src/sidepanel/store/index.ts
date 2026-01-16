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

  // Chat Signals
  chatMessages,
  chatQuerying,
  chatStatus,
  chatMessageCount,
  hasChatMessages,

  // Dialog Signals
  type NotebookDialogState,
  type ConfirmDialogState,
  notebookDialog,
  confirmDialog,
  confirmCallback,

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
  transformHistory,
  transforming,
  transformCount,
  hasTransforms,

  // Initial Tab State
  initialTab,
} from './signals.ts'

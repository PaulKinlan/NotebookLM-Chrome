/**
 * Side Panel Barrel
 *
 * Re-exports from controllers and services for cleaner import paths.
 */

// Business logic controllers (all handlers and state)
export { handlers, getState, initControllers } from './controllers'

// Services - selective exports to avoid naming conflicts

// Notebooks
export {
  getAllNotebooks,
  getNotebookById,
  createNewNotebook,
  deleteNotebook,
  updateNotebook,
  getCurrentNotebookIdState,
  setCurrentNotebook,
  switchNotebook,
  getSources,
  getCurrentNotebookSources,
  addSourceToNotebook,
  removeSource,
  getNotebookSummary,
  saveNotebookSummary,
  getNotebookOptions,
  createAndSelectNotebook,
} from './services/notebooks'

// Permissions
export {
  checkAllPermissions,
  togglePermission,
  requestPermissionIfNeeded,
} from './services/permissions'

// Sources
export type { PickerItem, PickerState } from './services/sources'
export {
  addCurrentTab,
  getTabs,
  importTabs,
  getTabGroups,
  importTabGroups,
  getBookmarks,
  importBookmarks,
  getHistory,
  importHistory,
} from './services/sources'

// UI
export {
  showNotification,
  hideNotification,
  showConfirmDialog,
  showNotebookDialog,
  showPickerModal,
  hidePickerModal,
  showOnboarding,
  hideOnboarding,
  setOnboardingStep,
} from './services/ui'
export type { DialogOptions, NotebookDialogOptions, OnboardingStep } from './services/ui'

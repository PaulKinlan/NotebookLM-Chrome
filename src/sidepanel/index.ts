/**
 * Side Panel Barrel
 *
 * Re-exports from services for cleaner import paths.
 */

// Chrome Bridge (Chrome extension event listeners)
export { initChromeBridge, checkPendingActions, type ChromeBridgeCallbacks } from './chrome-bridge'
export type { TabExtractContentResponse, UrlExtractResponse } from './chrome-bridge'

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
  addHighlightedTabs,
  getTabs,
  importTabs,
  getTabGroups,
  importTabGroups,
  getBookmarks,
  importBookmarks,
  getHistory,
  importHistory,
} from './services/sources'
export type { AddCurrentTabResult } from './services/sources'

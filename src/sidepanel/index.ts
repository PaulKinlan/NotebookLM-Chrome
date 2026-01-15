/**
 * Side Panel Barrel
 *
 * Re-exports hooks and services for cleaner import paths.
 */

// Custom Preact hooks (replaces controllers.ts)
export {
  useDialog,
  useNotebook,
  useSources,
  useChat,
  usePermissions,
  useToolPermissions,
  useTransform,
  usePickerModal,
  useOnboarding,
  type PermissionType,
} from './hooks'

// NOTE: useNavigation and useNotification have been replaced by signals
// Import from store instead:
// import { activeTab, showNotification, type TabName } from './store'

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

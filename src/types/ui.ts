// ============================================================================
// UI Settings, Permissions, Message Passing
// ============================================================================

/**
 * Theme preference options
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow system preference (prefers-color-scheme)
 */
export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * Resolved theme (what's actually applied to the UI)
 */
export type ResolvedTheme = 'light' | 'dark'

/**
 * UI Settings stored in chrome.storage.local
 */
export interface UISettings {
  themePreference: ThemePreference
}

/**
 * Chrome extension permissions
 */
export interface PermissionStatus {
  tabs: boolean
  tabGroups: boolean
  bookmarks: boolean
  history: boolean
}

// ============================================================================
// Message Passing
// ============================================================================

export type MessageType
  = | 'EXTRACT_CONTENT'
    | 'EXTRACT_FROM_URL'
    | 'CONTENT_EXTRACTED'
    | 'ADD_SOURCE'
    | 'REMOVE_SOURCE'
    | 'GET_SOURCES'
    | 'QUERY_SOURCES'
    | 'REQUEST_PERMISSION'
    | 'REBUILD_CONTEXT_MENUS'
    | 'SOURCE_ADDED'
    | 'SOURCE_REFRESHED'
    | 'REFRESH_SOURCE'
    | 'REFRESH_ALL_SOURCES'
    | 'CREATE_NOTEBOOK'
    | 'CREATE_NOTEBOOK_AND_ADD_PAGE'
    | 'CREATE_NOTEBOOK_AND_ADD_LINK'
    | 'CREATE_NOTEBOOK_AND_ADD_IMAGE'
    | 'CREATE_NOTEBOOK_AND_ADD_SELECTION'
    | 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS'
  // Browser tools messages
    | 'LIST_WINDOWS'
    | 'LIST_TABS'
    | 'LIST_TAB_GROUPS'
    | 'READ_PAGE_CONTENT'
  // Background transformation messages
    | 'START_TRANSFORM'
    | 'CANCEL_TRANSFORM'
    | 'GET_PENDING_TRANSFORMS'
    | 'TRANSFORM_STARTED'
    | 'TRANSFORM_PROGRESS'
    | 'TRANSFORM_COMPLETE'
    | 'TRANSFORM_ERROR'

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

/**
 * usePermissions Hook
 *
 * Manages Chrome extension permissions state.
 * Handles requesting and checking optional permissions (tabs, bookmarks, history).
 */

import { useState, useEffect } from 'preact/hooks'
import { checkPermissions, requestPermission } from '../../lib/permissions.ts'

export interface PermissionStatus {
  tabs: boolean
  tabGroups: boolean
  bookmarks: boolean
  history: boolean
}

export interface UsePermissionsReturn {
  /** Current permission states */
  permissions: PermissionStatus
  /** Check if a specific permission is granted */
  hasPermission: (type: keyof PermissionStatus) => boolean
  /** Request a permission if not already granted */
  ensurePermission: (type: keyof PermissionStatus) => Promise<boolean>
  /** Reload all permissions */
  reloadPermissions: () => Promise<void>
  /** Check if any optional permissions are granted */
  hasAnyOptionalPermissions: () => boolean
}

/**
 * Hook for managing Chrome extension permissions
 *
 * @example
 * ```tsx
 * function PermissionButton() {
 *   const { permissions, ensurePermission } = usePermissions()
 *
 *   const handleRequestTabs = async () => {
 *     const granted = await ensurePermission('tabs')
 *     if (granted) {
 *       // Do something with tabs permission
 *     }
 *   }
 *
 *   return <button onClick={handleRequestTabs}>
 *     {permissions.tabs ? 'Tabs granted' : 'Grant tabs permission'}
 *   </button>
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    tabs: false,
    tabGroups: false,
    bookmarks: false,
    history: false,
  })

  // Load permissions on mount
  useEffect(() => {
    void reloadPermissions()
  }, [])

  const reloadPermissions = async (): Promise<void> => {
    const updated = await checkPermissions()
    setPermissions(updated)
  }

  const hasPermission = (type: keyof PermissionStatus): boolean => {
    return permissions[type]
  }

  const ensurePermission = async (type: keyof PermissionStatus): Promise<boolean> => {
    // Already have permission
    if (permissions[type]) {
      return true
    }

    // Request permission
    const granted = await requestPermission(type)

    if (granted) {
      // Reload all permissions after granting
      const updated = await checkPermissions()
      setPermissions(updated)
      return true
    }

    return false
  }

  const hasAnyOptionalPermissions = (): boolean => {
    return Object.values(permissions).some(value => value === true)
  }

  return {
    permissions,
    hasPermission,
    ensurePermission,
    reloadPermissions,
    hasAnyOptionalPermissions,
  }
}

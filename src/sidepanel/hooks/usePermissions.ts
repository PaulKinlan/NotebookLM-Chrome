/**
 * usePermissions Hook
 *
 * Manages Chrome permissions (tabs, bookmarks, history).
 * TODO: Implement full permissions functionality from controllers.ts
 */

import { useState, useCallback } from 'preact/hooks'
import type { PermissionStatus } from '../../types/index.ts'
import { checkPermissions } from '../../lib/permissions.ts'

export type PermissionType = keyof PermissionStatus

export interface UsePermissionsReturn {
  /** Current permission states */
  permissions: PermissionStatus
  /** Check if a permission is granted */
  hasPermission: (type: PermissionType) => boolean
  /** Refresh all permissions */
  refreshPermissions: () => Promise<void>
}

/**
 * Hook for managing Chrome permissions
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    tabs: false,
    bookmarks: false,
    history: false,
    tabGroups: false,
  })

  const hasPermission = useCallback((type: PermissionType): boolean => {
    return permissions[type] === true
  }, [permissions])

  const refreshPermissions = useCallback(async () => {
    // TODO: Implement full refresh logic from controllers.ts:updatePermissionUI
    const result = await checkPermissions()
    setPermissions(result)
  }, [])

  return {
    permissions,
    hasPermission,
    refreshPermissions,
  }
}

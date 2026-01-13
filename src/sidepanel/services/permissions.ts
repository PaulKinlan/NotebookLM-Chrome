/**
 * Permissions Service
 *
 * Business logic for permission management.
 */

import type { PermissionStatus } from '../../types/index'
import { checkPermissions, requestPermission } from '../../lib/permissions'

let permissions: PermissionStatus = {
  tabs: false,
  tabGroups: false,
  bookmarks: false,
  history: false,
}

export async function checkAllPermissions(): Promise<PermissionStatus> {
  permissions = await checkPermissions()
  return permissions
}

export function getPermissions(): PermissionStatus {
  return permissions
}

export async function togglePermission(
  permission: keyof PermissionStatus,
): Promise<PermissionStatus> {
  if (permissions[permission]) {
    // Can't revoke permissions in Chrome extensions
    // User must do it through chrome://extensions
    return permissions
  }

  // Request the permission
  const granted = await requestPermission(permission)
  if (granted) {
    permissions[permission] = true
  }

  return permissions
}

export async function requestPermissionIfNeeded(
  permission: keyof PermissionStatus,
): Promise<boolean> {
  if (permissions[permission]) {
    return true
  }

  const granted = await requestPermission(permission)
  if (granted) {
    permissions[permission] = true
  }

  return granted
}

export async function initializePermissions(): Promise<void> {
  permissions = await checkPermissions()
}

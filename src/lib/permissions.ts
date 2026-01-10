import type { PermissionStatus } from '../types/index.ts';
import browser from './browser';

export async function checkPermissions(): Promise<PermissionStatus> {
  const [tabs, tabGroups, bookmarks, history] = await Promise.all([
    browser.permissions.contains({ permissions: ['tabs'] }),
    browser.permissions.contains({ permissions: ['tabGroups'] }),
    browser.permissions.contains({ permissions: ['bookmarks'] }),
    browser.permissions.contains({ permissions: ['history'] }),
  ]);

  return { tabs, tabGroups, bookmarks, history };
}

export async function requestPermission(
  permission: 'tabs' | 'tabGroups' | 'bookmarks' | 'history'
): Promise<boolean> {
  return browser.permissions.request({ permissions: [permission] });
}

export async function revokePermission(
  permission: 'tabs' | 'tabGroups' | 'bookmarks' | 'history'
): Promise<boolean> {
  return browser.permissions.remove({ permissions: [permission] });
}

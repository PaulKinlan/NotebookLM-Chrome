import type { PermissionStatus } from '../types/index.ts';

export async function checkPermissions(): Promise<PermissionStatus> {
  const [tabs, tabGroups, bookmarks, history] = await Promise.all([
    chrome.permissions.contains({ permissions: ['tabs'] }),
    chrome.permissions.contains({ permissions: ['tabGroups'] }),
    chrome.permissions.contains({ permissions: ['bookmarks'] }),
    chrome.permissions.contains({ permissions: ['history'] }),
  ]);

  return { tabs, tabGroups, bookmarks, history };
}

export async function requestPermission(
  permission: 'tabs' | 'tabGroups' | 'bookmarks' | 'history'
): Promise<boolean> {
  return chrome.permissions.request({ permissions: [permission] });
}

export async function revokePermission(
  permission: 'tabs' | 'tabGroups' | 'bookmarks' | 'history'
): Promise<boolean> {
  return chrome.permissions.remove({ permissions: [permission] });
}

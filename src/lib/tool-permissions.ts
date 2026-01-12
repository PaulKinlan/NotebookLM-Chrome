/**
 * Tool Permissions Management
 *
 * Manages global tool permissions configuration including:
 * - Which tools are visible to the LLM
 * - Which tools require approval
 * - Session-based and permanent approval tracking
 */

import type { ToolPermission, ToolPermissionsConfig, ApprovalScope } from '../types/index.ts'
import { storage } from './storage.ts'

const TOOL_PERMISSIONS_KEY = 'toolPermissions'

// Default permissions for source tools (never require approval)
const DEFAULT_SOURCE_TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  listSources: {
    toolName: 'listSources',
    visible: true,
    requiresApproval: false,
    autoApproved: true,
  },
  readSource: {
    toolName: 'readSource',
    visible: true,
    requiresApproval: false,
    autoApproved: true,
  },
  findRelevantSources: {
    toolName: 'findRelevantSources',
    visible: true,
    requiresApproval: false,
    autoApproved: true,
  },
}

// Default permissions for browser tools (require approval by default)
const DEFAULT_BROWSER_TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  listWindows: {
    toolName: 'listWindows',
    visible: true,
    requiresApproval: true,
    autoApproved: false,
  },
  listTabs: {
    toolName: 'listTabs',
    visible: true,
    requiresApproval: true,
    autoApproved: false,
  },
  listTabGroups: {
    toolName: 'listTabGroups',
    visible: true,
    requiresApproval: true,
    autoApproved: false,
  },
  readPageContent: {
    toolName: 'readPageContent',
    visible: true,
    requiresApproval: true,
    autoApproved: false,
  },
}

const DEFAULT_CONFIG: ToolPermissionsConfig = {
  permissions: {
    ...DEFAULT_SOURCE_TOOL_PERMISSIONS,
    ...DEFAULT_BROWSER_TOOL_PERMISSIONS,
  },
  sessionApprovals: [],
  lastModified: Date.now(),
}

/**
 * Get tool permissions configuration
 */
export async function getToolPermissions(): Promise<ToolPermissionsConfig> {
  const config = await storage.getSetting<ToolPermissionsConfig>(TOOL_PERMISSIONS_KEY)
  return config ?? DEFAULT_CONFIG
}

/**
 * Save tool permissions configuration
 */
export async function saveToolPermissions(config: ToolPermissionsConfig): Promise<void> {
  await storage.setSetting(TOOL_PERMISSIONS_KEY, {
    ...config,
    lastModified: Date.now(),
  })
}

/**
 * Get permission for a specific tool
 */
export async function getToolPermission(toolName: string): Promise<ToolPermission | null> {
  const config = await getToolPermissions()
  return config.permissions[toolName] || null
}

/**
 * Update permission for a specific tool
 */
export async function updateToolPermission(
  toolName: string,
  updates: Partial<Omit<ToolPermission, 'toolName'>>,
): Promise<void> {
  const config = await getToolPermissions()
  const existing = config.permissions[toolName]

  config.permissions[toolName] = {
    toolName,
    visible: updates.visible ?? existing?.visible ?? true,
    requiresApproval: updates.requiresApproval ?? existing?.requiresApproval ?? true,
    autoApproved: updates.autoApproved ?? existing?.autoApproved ?? false,
  }

  await saveToolPermissions(config)
}

/**
 * Check if a tool is currently auto-approved
 * (either permanently approved or approved for session)
 */
export async function isToolAutoApproved(toolName: string): Promise<boolean> {
  const config = await getToolPermissions()
  const permission = config.permissions[toolName]

  if (!permission || !permission.visible) {
    return false // Tool not visible
  }

  // Check if permanently approved
  if (permission.autoApproved) {
    return true
  }

  // Check if approved for session
  if (config.sessionApprovals.includes(toolName)) {
    return true
  }

  return false
}

/**
 * Add tool approval based on scope
 */
export async function addToolApproval(
  toolName: string,
  scope: ApprovalScope,
): Promise<void> {
  const config = await getToolPermissions()

  switch (scope) {
    case 'once':
      // No persistence needed - one-time approval
      break

    case 'session':
      if (!config.sessionApprovals.includes(toolName)) {
        config.sessionApprovals.push(toolName)
      }
      await saveToolPermissions(config)
      break

    case 'forever':
      // Mark as auto-approved permanently
      if (config.permissions[toolName]) {
        config.permissions[toolName].autoApproved = true
        await saveToolPermissions(config)
      }
      break
  }
}

/**
 * Clear session approvals (call on session start/end)
 */
export async function clearSessionApprovals(): Promise<void> {
  const config = await getToolPermissions()
  config.sessionApprovals = []
  await saveToolPermissions(config)
}

/**
 * Get tools that should be visible to the LLM
 */
export async function getVisibleToolNames(): Promise<string[]> {
  const config = await getToolPermissions()
  return Object.entries(config.permissions)
    .filter(([, permission]) => permission.visible)
    .map(([name]) => name)
}

/**
 * Check if a tool requires approval
 */
export async function doesToolRequireApproval(toolName: string): Promise<boolean> {
  const permission = await getToolPermission(toolName)
  if (!permission || !permission.visible) {
    return false // Non-existent or hidden tools don't require approval
  }
  return permission.requiresApproval && !permission.autoApproved
}

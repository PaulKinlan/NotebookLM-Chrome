/**
 * useToolPermissions Hook
 *
 * Manages tool permission configuration state.
 * Controls which AI tools are visible and require approval before execution.
 * Replaces imperative renderToolPermissions() in controllers.ts.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import { getToolPermissions, saveToolPermissions } from '../../lib/tool-permissions.ts'
import type { ToolPermissionsConfig } from '../../types/index.ts'
import { storage } from '../../lib/storage.ts'

export interface ToolPermissionItem {
  name: string
  displayName: string
  statusClass: 'disabled' | 'auto-approved' | 'session-approved' | 'requires-approval'
  statusText: string
  visible: boolean
  autoApprove: boolean
}

export interface UseToolPermissionsReturn {
  /** Current tool permissions state */
  toolPermissions: ToolPermissionItem[]
  /** Loading state */
  isLoading: boolean
  /** Reload permissions from storage */
  reloadPermissions: () => Promise<void>
  /** Toggle tool visibility */
  toggleVisibility: (toolName: string, visible: boolean) => Promise<void>
  /** Toggle auto-approval */
  toggleAutoApprove: (toolName: string, autoApprove: boolean) => Promise<void>
  /** Reset to defaults */
  resetToDefaults: () => Promise<void>
}

/**
 * Hook for managing tool permissions
 *
 * @example
 * ```tsx
 * function ToolPermissionsList() {
 *   const { toolPermissions, isLoading, toggleVisibility, toggleAutoApprove } = useToolPermissions()
 *
 *   if (isLoading) return <p>Loading...</p>
 *
 *   return (
 *     <div>
 *       {toolPermissions.map(tool => (
 *         <div key={tool.name}>
 *           <input
 *             type="checkbox"
 *             checked={tool.visible}
 *             onChange={(e) => toggleVisibility(tool.name, e.target.checked)}
 *           />
 *           {tool.displayName}
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useToolPermissions(): UseToolPermissionsReturn {
  const [toolPermissions, setToolPermissions] = useState<ToolPermissionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState<ToolPermissionsConfig | null>(null)

  // Load permissions on mount
  useEffect(() => {
    void loadPermissions()
  }, [])

  const loadPermissions = async () => {
    setIsLoading(true)
    try {
      const cfg = await getToolPermissions()
      setConfig(cfg)

      const items: ToolPermissionItem[] = []

      for (const toolName of Object.keys(cfg.permissions).sort()) {
        const permission = cfg.permissions[toolName]
        const isSessionApproved = cfg.sessionApprovals.includes(toolName)

        // Determine status
        let statusClass: ToolPermissionItem['statusClass'] = 'disabled'
        let statusText = 'Disabled'
        if (permission.visible) {
          if (permission.autoApproved) {
            statusClass = 'auto-approved'
            statusText = 'Auto-Approved'
          }
          else if (isSessionApproved) {
            statusClass = 'session-approved'
            statusText = 'Session-Approved'
          }
          else if (permission.requiresApproval) {
            statusClass = 'requires-approval'
            statusText = 'Requires Approval'
          }
          else {
            statusClass = 'auto-approved'
            statusText = 'Auto-Approved'
          }
        }

        // Format tool name for display
        const displayName = toolName
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/^./, s => s.toUpperCase())

        items.push({
          name: toolName,
          displayName,
          statusClass,
          statusText,
          visible: permission.visible,
          autoApprove: !permission.requiresApproval,
        })
      }

      setToolPermissions(items)
    }
    finally {
      setIsLoading(false)
    }
  }

  const toggleVisibility = async (toolName: string, visible: boolean): Promise<void> => {
    if (!config) return

    // Update permission
    config.permissions[toolName].visible = visible

    // If disabling, also clear any auto-approval
    if (!visible) {
      config.permissions[toolName].autoApproved = false
    }

    // If enabling but has no approval requirement, mark as auto-approved
    if (visible && !config.permissions[toolName].requiresApproval) {
      config.permissions[toolName].autoApproved = true
    }

    config.lastModified = Date.now()
    await saveToolPermissions(config)
    await loadPermissions()
  }

  const toggleAutoApprove = async (toolName: string, autoApprove: boolean): Promise<void> => {
    if (!config) return

    // Update permission
    config.permissions[toolName].requiresApproval = !autoApprove

    // If removing approval requirement, mark as auto-approved
    if (autoApprove) {
      config.permissions[toolName].autoApproved = true
    }
    else {
      // If adding approval requirement, mark as NOT auto-approved
      config.permissions[toolName].autoApproved = false
    }

    config.lastModified = Date.now()
    await saveToolPermissions(config)
    await loadPermissions()
  }

  const resetToDefaults = async (): Promise<void> => {
    // Reset to defaults by clearing and reloading
    await storage.setSetting('toolPermissions', null)
    await loadPermissions()
  }

  const reloadPermissions = async (): Promise<void> => {
    await loadPermissions()
  }

  return {
    toolPermissions,
    isLoading,
    reloadPermissions,
    toggleVisibility,
    toggleAutoApprove,
    resetToDefaults,
  }
}

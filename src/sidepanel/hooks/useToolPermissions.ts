/**
 * useToolPermissions Hook
 *
 * Manages AI tool permission settings (visibility, approval requirements).
 */

import { useState, useCallback, useEffect } from 'preact/hooks'
import type { ToolPermissionsConfig } from '../../types/index.ts'
import { getToolPermissions, saveToolPermissions } from '../../lib/tool-permissions.ts'

export interface UseToolPermissionsReturn {
  /** Current tool permissions configuration */
  config: ToolPermissionsConfig | null
  /** Load tool permissions from storage */
  loadConfig: () => Promise<void>
  /** Toggle tool visibility */
  toggleVisible: (toolName: string) => Promise<void>
  /** Toggle whether tool requires approval */
  toggleRequiresApproval: (toolName: string) => Promise<void>
  /** Reset all tool permissions to defaults */
  resetToDefaults: () => Promise<void>
}

/**
 * Hook for managing tool permission settings
 *
 * Returns config state and toggle functions. Components should render
 * the tool permissions list from the config.permissions object.
 */
export function useToolPermissions(): UseToolPermissionsReturn {
  const [config, setConfig] = useState<ToolPermissionsConfig | null>(null)

  const loadConfig = useCallback(async () => {
    const loaded = await getToolPermissions()
    setConfig(loaded)
  }, [])

  const toggleVisible = useCallback(async (toolName: string) => {
    const current = await getToolPermissions()

    if (current.permissions[toolName]) {
      current.permissions[toolName].visible = !current.permissions[toolName].visible
    }

    await saveToolPermissions(current)
    await loadConfig()
  }, [loadConfig])

  const toggleRequiresApproval = useCallback(async (toolName: string) => {
    const current = await getToolPermissions()

    if (current.permissions[toolName]) {
      current.permissions[toolName].requiresApproval = !current.permissions[toolName].requiresApproval
    }

    await saveToolPermissions(current)
    await loadConfig()
  }, [loadConfig])

  const resetToDefaults = useCallback(async () => {
    // Clear and reload to get defaults
    await saveToolPermissions({
      permissions: {},
      sessionApprovals: [],
      lastModified: Date.now(),
    })
    await loadConfig()
  }, [loadConfig])

  // Initialize config on mount
  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  return {
    config,
    loadConfig,
    toggleVisible,
    toggleRequiresApproval,
    resetToDefaults,
  }
}

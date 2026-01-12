/**
 * SettingsTabStateful Component
 *
 * Displays and manages application settings.
 * Replaces imperative settings rendering in controllers.ts.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import { usePermissions } from '../hooks/usePermissions.ts'
import { useNotification } from '../hooks/useNotification.ts'
import { useDialog } from '../hooks/useDialog.ts'
import { useToolPermissions } from '../hooks/useToolPermissions.ts'
import { getAISettings, setContextMode, getContextMode } from '../../lib/settings.ts'
import { clearAllData } from '../../lib/storage.ts'

type PermissionType = 'tabs' | 'tabGroups' | 'bookmarks' | 'history'

interface SettingsTabStatefulProps {
  active: boolean
}

export function SettingsTabStateful({ active }: SettingsTabStatefulProps) {
  const { permissions, ensurePermission } = usePermissions()
  const { showNotification } = useNotification()
  const { showConfirm } = useDialog()
  const {
    toolPermissions,
    isLoading: isLoadingTools,
    toggleVisibility: toggleToolVisibility,
    toggleAutoApprove: toggleToolAutoApprove,
    resetToDefaults: resetToolPermissions,
  } = useToolPermissions()

  // Context mode state
  const [isToolBasedContext, setIsToolBasedContext] = useState(false)
  const [showChromeToolsWarning, setShowChromeToolsWarning] = useState(false)

  // Load settings on mount
  useEffect(() => {
    void loadSettings()
  }, [])

  const loadSettings = async () => {
    // Load context mode
    const contextMode = await getContextMode()
    setIsToolBasedContext(contextMode === 'agentic')

    // Check for Chrome tools warning
    const aiSettings = await getAISettings()
    const isChrome = aiSettings.provider === 'chrome'
    setShowChromeToolsWarning(isChrome && contextMode === 'agentic')
  }

  // Handle permission toggle
  const handlePermissionToggle = async (type: PermissionType, checked: boolean) => {
    if (checked) {
      const granted = await ensurePermission(type)
      if (!granted) {
        showNotification(`${type} permission denied`, 'error')
      }
      else {
        showNotification(`${type} permission granted`, 'success')
      }
    }
    else {
      showNotification('Permissions cannot be revoked from here. Use Chrome extension settings.', 'info')
    }
  }

  // Handle context mode toggle
  const handleContextModeChange = async (checked: boolean) => {
    const mode = checked ? 'agentic' : 'classic'
    setIsToolBasedContext(checked)
    await setContextMode(mode)

    // Update Chrome tools warning
    const aiSettings = await getAISettings()
    const isChrome = aiSettings.provider === 'chrome'
    setShowChromeToolsWarning(isChrome && checked)
  }

  // Handle reset tool permissions
  const handleResetToolPermissions = async () => {
    await resetToolPermissions()
    showNotification('Tool permissions reset to defaults', 'success')
  }

  // Handle clear all data
  const handleClearAllData = async () => {
    const confirmed = await showConfirm({
      title: 'Clear All Data',
      message: 'This will permanently delete all notebooks, sources, chat history, and AI profiles. This action cannot be undone.',
      confirmText: 'Clear All',
      isDestructive: true,
    })

    if (!confirmed) return

    try {
      await clearAllData()
      await chrome.storage.local.clear()
      location.reload()
    }
    catch (error) {
      console.error('Failed to clear all data:', error)
      showNotification('Failed to clear all data. Please try again.', 'error')
    }
  }

  return (
    <section id="tab-settings" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Settings</h2>

      <div className="settings-group">
        <h3 className="section-title">
          AI Profiles
          <button id="add-profile-btn" className="btn btn-small btn-outline">
            + Add
          </button>
        </h3>
        <div id="profiles-list" className="profiles-list"></div>
      </div>

      <div className="settings-group" id="notebook-settings-group" style={{ display: 'none' }}>
        <h3 className="section-title">Notebook Settings</h3>
        <label className="input-label">Model Configuration</label>
        <select id="notebook-model-select">
          <option value="">Use Default</option>
        </select>
        <p className="setting-hint">Override the default AI model for this notebook.</p>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Source Context Mode</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            id="tool-based-context"
            checked={isToolBasedContext}
            onChange={(e: { target: HTMLInputElement }) => void handleContextModeChange(e.target.checked)}
          />
          <span>Tool-based Context - AI queries sources as needed</span>
        </label>
        <p className="setting-hint">
          <strong>Pre-loaded (unchecked):</strong>
          {' '}
          All sources bundled into initial context.
          <br />
          <strong>Tool-based (checked):</strong>
          {' '}
          AI uses tools to fetch sources on demand.
        </p>
        {showChromeToolsWarning && (
          <p id="chrome-tools-warning" className="setting-warning">
            <strong>Warning:</strong>
            {' '}
            Chrome Built-in AI has limited tool support. For best results with tool-based context, use a cloud provider like Anthropic or OpenAI.
          </p>
        )}
      </div>

      <div className="settings-group">
        <h3 className="section-title">Permissions</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            id="perm-tabs"
            checked={permissions.tabs}
            onChange={(e: { target: HTMLInputElement }) => void handlePermissionToggle('tabs', e.target.checked)}
          />
          <span>Tabs - View all open tabs</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            id="perm-tab-groups"
            checked={permissions.tabGroups}
            onChange={(e: { target: HTMLInputElement }) => void handlePermissionToggle('tabGroups', e.target.checked)}
          />
          <span>Tab Groups - Access tab groups</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            id="perm-bookmarks"
            checked={permissions.bookmarks}
            onChange={(e: { target: HTMLInputElement }) => void handlePermissionToggle('bookmarks', e.target.checked)}
          />
          <span>Bookmarks - Access saved bookmarks</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            id="perm-history"
            checked={permissions.history}
            onChange={(e: { target: HTMLInputElement }) => void handlePermissionToggle('history', e.target.checked)}
          />
          <span>History - Access browsing history</span>
        </label>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Tool Permissions</h3>
        <p className="setting-hint">Control which AI tools are visible and require approval before execution.</p>
        {isLoadingTools ? (
          <p>Loading tool permissions...</p>
        ) : (
          <div id="tool-permissions-list" className="tool-permissions-list">
            {toolPermissions.map((tool) => (
              <div key={tool.name} className="tool-permission-item">
                <div className="tool-permission-header">
                  <div className="tool-permission-name">
                    <strong>{tool.displayName}</strong>
                    <span className={`tool-permission-status ${tool.statusClass}`}>{tool.statusText}</span>
                  </div>
                </div>
                <div className="tool-permission-controls">
                  <div className="tool-permission-control">
                    <input
                      type="checkbox"
                      id={`tool-enabled-${tool.name}`}
                      data-tool-name={tool.name}
                      checked={tool.visible}
                      onChange={(e: { target: HTMLInputElement }) => void toggleToolVisibility(tool.name, e.target.checked)}
                    />
                    <label htmlFor={`tool-enabled-${tool.name}`}>Enabled</label>
                  </div>
                  <div className="tool-permission-control">
                    <input
                      type="checkbox"
                      id={`tool-no-approval-${tool.name}`}
                      data-tool-name={tool.name}
                      checked={tool.visible && tool.autoApprove}
                      disabled={!tool.visible}
                      onChange={(e: { target: HTMLInputElement }) => void toggleToolAutoApprove(tool.name, e.target.checked)}
                    />
                    <label htmlFor={`tool-no-approval-${tool.name}`}>Auto approve</label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="tool-permissions-footer">
          <button
            id="reset-tool-permissions-btn"
            className="btn btn-small btn-outline"
            onClick={() => void handleResetToolPermissions()}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Data Management</h3>
        <p className="setting-hint">Clear all notebooks, sources, chat history, and AI profiles. This action cannot be undone.</p>
        <button
          id="clear-all-data-btn"
          className="btn btn-danger btn-small"
          onClick={() => void handleClearAllData()}
        >
          Clear All Data
        </button>
      </div>
    </section>
  )
}

import type { ThemePreference } from '../../types/index.ts'
import { getPreference, setPreference, onThemeChange } from '../hooks/useTheme.tsx'

type PermissionType = 'tabs' | 'tabGroups' | 'bookmarks' | 'history'

interface SettingsTabProps {
  active: boolean
  onPermissionToggle: (permission: PermissionType) => void
  onClearAllData: () => void
}

export function SettingsTab(props: SettingsTabProps) {
  const { active } = props
  const currentPreference = getPreference()

  // Handle theme change
  const handleThemeChange = (newPreference: ThemePreference) => {
    void setPreference(newPreference)
  }

  // Set up initial state and listeners after DOM is created
  requestAnimationFrame(() => {
    const lightRadio = document.querySelector<HTMLInputElement>('input[name="theme"][value="light"]')
    const darkRadio = document.querySelector<HTMLInputElement>('input[name="theme"][value="dark"]')
    const systemRadio = document.querySelector<HTMLInputElement>('input[name="theme"][value="system"]')

    // Set initial checked state
    const updateRadioState = (preference: ThemePreference) => {
      if (lightRadio) lightRadio.checked = preference === 'light'
      if (darkRadio) darkRadio.checked = preference === 'dark'
      if (systemRadio) systemRadio.checked = preference === 'system'
    }

    updateRadioState(currentPreference)

    // Listen for theme changes (from other sources)
    onThemeChange((preference) => {
      updateRadioState(preference)
    })
  })

  return (
    <section id="tab-settings" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Settings</h2>

      <div className="settings-group">
        <h3 className="section-title">Appearance</h3>
        <div className="theme-selector">
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="light"
              onChange={() => handleThemeChange('light')}
            />
            <span className="theme-option-content">
              <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>Light</span>
            </span>
          </label>
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="dark"
              onChange={() => handleThemeChange('dark')}
            />
            <span className="theme-option-content">
              <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </span>
          </label>
          <label className="theme-option">
            <input
              type="radio"
              name="theme"
              value="system"
              onChange={() => handleThemeChange('system')}
            />
            <span className="theme-option-content">
              <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>System</span>
            </span>
          </label>
        </div>
        <p className="setting-hint">Choose light, dark, or follow your system preference.</p>
      </div>

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
          <input type="checkbox" id="tool-based-context" />
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
        <p id="chrome-tools-warning" className="setting-warning hidden">
          <strong>Warning:</strong>
          {' '}
          Chrome Built-in AI has limited tool support. For best results with tool-based context, use a cloud provider like Anthropic or OpenAI.
        </p>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Permissions</h3>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-tabs" />
          <span>Tabs - View all open tabs</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-tab-groups" />
          <span>Tab Groups - Access tab groups</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-bookmarks" />
          <span>Bookmarks - Access saved bookmarks</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-history" />
          <span>History - Access browsing history</span>
        </label>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Tool Permissions</h3>
        <p className="setting-hint">Control which AI tools are visible and require approval before execution.</p>
        <div id="tool-permissions-list" className="tool-permissions-list"></div>
        <div className="tool-permissions-footer">
          <button id="reset-tool-permissions-btn" className="btn btn-small btn-outline">Reset to Defaults</button>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Data Management</h3>
        <p className="setting-hint">Clear all notebooks, sources, chat history, and AI profiles. This action cannot be undone.</p>
        <button id="clear-all-data-btn" className="btn btn-danger btn-small">Clear All Data</button>
      </div>
    </section>
  )
}

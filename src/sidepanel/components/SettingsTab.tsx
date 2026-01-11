type PermissionType = 'tabs' | 'tabGroups' | 'bookmarks' | 'history';

interface SettingsTabProps {
  active: boolean;
  onPermissionToggle: (permission: PermissionType) => void;
  onClearAllData: () => void;
}

export function SettingsTab(props: SettingsTabProps) {
  const { active } = props;
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
          <input type="checkbox" id="tool-based-context" />
          <span>Tool-based Context - AI queries sources as needed</span>
        </label>
        <p className="setting-hint">
          <strong>Pre-loaded (unchecked):</strong> All sources bundled into initial context.<br />
          <strong>Tool-based (checked):</strong> AI uses tools to fetch sources on demand.
        </p>
        <p id="chrome-tools-warning" className="setting-warning hidden">
          <strong>Warning:</strong> Chrome Built-in AI has limited tool support. For best results with tool-based context, use a cloud provider like Anthropic or OpenAI.
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
  );
}

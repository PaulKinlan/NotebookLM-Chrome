type PermissionType = "tabs" | "tabGroups" | "bookmarks" | "history";

interface SettingsTabProps {
  active: boolean;
  onPermissionToggle: (permission: PermissionType) => void;
  onClearAllData: () => void;
}

export function SettingsTab(props: SettingsTabProps) {
  const { active, onPermissionToggle, onClearAllData } = props;

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

      <div className="settings-group" id="notebook-settings-group" style="display: none;">
        <h3 className="section-title">Notebook Settings</h3>
        <label className="input-label">Model Configuration</label>
        <select id="notebook-model-select">
          <option value="">Use Default</option>
        </select>
        <p className="setting-hint">Override the default AI model for this notebook.</p>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Permissions</h3>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-tabs" onChange={() => onPermissionToggle('tabs')} />
          <span>Tabs - View all open tabs</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-tab-groups" onChange={() => onPermissionToggle('tabGroups')} />
          <span>Tab Groups - Access tab groups</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-bookmarks" onChange={() => onPermissionToggle('bookmarks')} />
          <span>Bookmarks - Access saved bookmarks</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" id="perm-history" onChange={() => onPermissionToggle('history')} />
          <span>History - Access browsing history</span>
        </label>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Data Management</h3>
        <p className="setting-hint">
          Clear all notebooks, sources, chat history, and AI profiles. This action cannot be undone.
        </p>
        <button id="clear-all-data-btn" className="btn btn-danger btn-small" onClick={onClearAllData}>
          Clear All Data
        </button>
      </div>
    </section>
  );
}

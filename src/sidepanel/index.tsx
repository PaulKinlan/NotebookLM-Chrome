// ============================================================================
// TSX Entry Point
// ============================================================================
import { App } from './App';
import './index.js'; // Load all the business logic and event handlers

// Initial state
let activeTab = 'add';
let fabHidden = true;
let onboardingHidden = true;

// ============================================================================
// Render App
// ============================================================================
function renderApp(): void {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container not found');
    return;
  }

  // Clear any existing content
  appContainer.innerHTML = '';

  // Create event handlers that bridge to the existing index.ts logic
  const handlers = {
    onTabClick: (tab: string) => {
      activeTab = tab;
      updateTabVisibility();
    },
    onHeaderLibraryClick: () => {
      // Trigger library view - this will be handled by existing event listeners
      const libraryBtn = document.getElementById('header-library-btn') as HTMLButtonElement;
      libraryBtn?.click();
    },
    onHeaderSettingsClick: () => {
      const settingsBtn = document.getElementById('header-settings-btn') as HTMLButtonElement;
      settingsBtn?.click();
    },
    onNotebookChange: (id: string) => {
      const select = document.getElementById('notebook-select') as HTMLSelectElement;
      if (select) {
        select.value = id;
        select.dispatchEvent(new Event('change'));
      }
    },
    onNewNotebook: () => {
      const btn = document.getElementById('new-notebook-btn') as HTMLButtonElement;
      btn?.click();
    },
    onAddCurrentTab: () => {
      const btn = document.getElementById('add-current-tab-btn') as HTMLButtonElement;
      btn?.click();
    },
    onImportTabs: () => {
      const btn = document.getElementById('import-tabs') as HTMLButtonElement;
      btn?.click();
    },
    onImportTabGroups: () => {
      const btn = document.getElementById('import-tab-groups') as HTMLButtonElement;
      btn?.click();
    },
    onImportBookmarks: () => {
      const btn = document.getElementById('import-bookmarks') as HTMLButtonElement;
      btn?.click();
    },
    onImportHistory: () => {
      const btn = document.getElementById('import-history') as HTMLButtonElement;
      btn?.click();
    },
    onQuery: () => {
      const btn = document.getElementById('query-btn') as HTMLButtonElement;
      btn?.click();
    },
    onClearChat: () => {
      const btn = document.getElementById('clear-chat-btn') as HTMLButtonElement;
      btn?.click();
    },
    onRegenerateSummary: () => {
      const btn = document.getElementById('regenerate-summary-btn') as HTMLButtonElement;
      btn?.click();
    },
    onTransform: (type: string) => {
      const btn = document.getElementById(`transform-${type}`) as HTMLButtonElement;
      btn?.click();
    },
    onPermissionToggle: (permission: string) => {
      const checkbox = document.getElementById(`perm-${permission}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    },
    onClearAllData: () => {
      const btn = document.getElementById('clear-all-data-btn') as HTMLButtonElement;
      btn?.click();
    },
    onFabClick: () => {
      const fab = document.getElementById('fab') as HTMLButtonElement;
      fab?.click();
    },
  };

  // Render the App component
  const appElement = App({
    activeTab,
    fabHidden,
    onboardingHidden,
    ...handlers,
  });

  appContainer.appendChild(appElement);
}

// ============================================================================
// Tab Visibility Helper
// ============================================================================
function updateTabVisibility(): void {
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  navItems.forEach((item, _index) => {
    const tabName = item.getAttribute('data-tab');
    if (tabName === activeTab) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  tabContents.forEach((content) => {
    const tabId = content.id;
    if (tabId === `tab-${activeTab}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

// ============================================================================
// Initialize
// ============================================================================
// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

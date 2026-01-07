import type {
  Source,
  PermissionStatus,
  AISettings,
  ChatMessage,
  Citation,
} from "../types/index.ts";
import { checkPermissions, requestPermission } from "../lib/permissions.ts";
import {
  getNotebooks,
  saveNotebook,
  createNotebook,
  deleteNotebook,
  getActiveNotebookId,
  setActiveNotebookId,
  getSourcesByNotebook,
  saveSource,
  deleteSource,
  createSource,
  getChatHistory,
  saveChatMessage,
  createChatMessage,
  clearChatHistory,
  getCachedResponse,
  saveCachedResponse,
  createCachedResponse,
  createCacheKey,
} from "../lib/storage.ts";
import {
  streamChat,
  generatePodcastScript,
  generateQuiz,
  generateKeyTakeaways,
  generateEmailSummary,
  testConnection,
} from "../lib/ai.ts";
import {
  getAISettings,
  setApiKey,
  setProvider,
  setModel,
  setTemperature,
  setMaxTokens,
} from "../lib/settings.ts";

// ============================================================================
// State
// ============================================================================

let currentNotebookId: string | null = null;
let permissions: PermissionStatus = {
  tabs: false,
  tabGroups: false,
  bookmarks: false,
  history: false,
};
let aiSettings: AISettings | null = null;

// Picker state
interface PickerItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  color?: string; // For tab groups
  tabCount?: number; // For tab groups
}
let pickerItems: PickerItem[] = [];
let selectedPickerItems: Set<string> = new Set();
let pickerType: "tab" | "tabGroup" | "bookmark" | "history" | null = null;

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Navigation
  navItems: document.querySelectorAll(
    ".nav-item"
  ) as NodeListOf<HTMLButtonElement>,
  tabContents: document.querySelectorAll(
    ".tab-content"
  ) as NodeListOf<HTMLElement>,

  // Add Sources tab
  addCurrentTabBtn: document.getElementById(
    "add-current-tab-btn"
  ) as HTMLButtonElement,
  searchSources: document.getElementById("search-sources") as HTMLInputElement,
  importTabs: document.getElementById("import-tabs") as HTMLButtonElement,
  importTabGroups: document.getElementById(
    "import-tab-groups"
  ) as HTMLButtonElement,
  importBookmarks: document.getElementById(
    "import-bookmarks"
  ) as HTMLButtonElement,
  importHistory: document.getElementById("import-history") as HTMLButtonElement,
  tabsCount: document.getElementById("tabs-count") as HTMLSpanElement,
  sourcesList: document.getElementById("sources-list") as HTMLDivElement,

  // Chat tab
  notebookSelect: document.getElementById(
    "notebook-select"
  ) as HTMLSelectElement,
  newNotebookBtn: document.getElementById(
    "new-notebook-btn"
  ) as HTMLButtonElement,
  queryInput: document.getElementById("query-input") as HTMLInputElement,
  queryBtn: document.getElementById("query-btn") as HTMLButtonElement,
  sourceCount: document.getElementById("source-count") as HTMLSpanElement,
  activeSources: document.getElementById("active-sources") as HTMLDivElement,
  addPageBtn: document.getElementById("add-page-btn") as HTMLButtonElement,
  chatMessages: document.getElementById("chat-messages") as HTMLDivElement,
  clearChatBtn: document.getElementById("clear-chat-btn") as HTMLButtonElement,
  chatStatus: document.getElementById("chat-status") as HTMLParagraphElement,

  // Transform tab
  transformPodcast: document.getElementById(
    "transform-podcast"
  ) as HTMLButtonElement,
  transformQuiz: document.getElementById("transform-quiz") as HTMLButtonElement,
  transformTakeaways: document.getElementById(
    "transform-takeaways"
  ) as HTMLButtonElement,
  transformEmail: document.getElementById(
    "transform-email"
  ) as HTMLButtonElement,
  transformResult: document.getElementById(
    "transform-result"
  ) as HTMLDivElement,
  transformResultTitle: document.getElementById(
    "transform-result-title"
  ) as HTMLHeadingElement,
  transformContent: document.getElementById(
    "transform-content"
  ) as HTMLDivElement,
  copyTransform: document.getElementById("copy-transform") as HTMLButtonElement,
  closeTransform: document.getElementById(
    "close-transform"
  ) as HTMLButtonElement,

  // Library tab
  notebooksList: document.getElementById("notebooks-list") as HTMLDivElement,

  // Settings tab
  aiProvider: document.getElementById("ai-provider") as HTMLSelectElement,
  aiModel: document.getElementById("ai-model") as HTMLSelectElement,
  apiKey: document.getElementById("api-key") as HTMLInputElement,
  testApiBtn: document.getElementById("test-api") as HTMLButtonElement,
  apiKeyLink: document.getElementById("api-key-link") as HTMLAnchorElement,
  aiTemperature: document.getElementById("ai-temperature") as HTMLInputElement,
  temperatureValue: document.getElementById("temperature-value") as HTMLSpanElement,
  aiMaxTokens: document.getElementById("ai-max-tokens") as HTMLInputElement,
  permTabs: document.getElementById("perm-tabs") as HTMLInputElement,
  permTabGroups: document.getElementById("perm-tab-groups") as HTMLInputElement,
  permBookmarks: document.getElementById("perm-bookmarks") as HTMLInputElement,
  permHistory: document.getElementById("perm-history") as HTMLInputElement,

  // FAB
  fab: document.getElementById("fab") as HTMLButtonElement,

  // Picker Modal
  pickerModal: document.getElementById("picker-modal") as HTMLDivElement,
  pickerTitle: document.getElementById("picker-title") as HTMLHeadingElement,
  pickerSearch: document.getElementById("picker-search") as HTMLInputElement,
  pickerList: document.getElementById("picker-list") as HTMLDivElement,
  pickerSelectedCount: document.getElementById(
    "picker-selected-count"
  ) as HTMLSpanElement,
  pickerClose: document.getElementById("picker-close") as HTMLButtonElement,
  pickerCancel: document.getElementById("picker-cancel") as HTMLButtonElement,
  pickerAdd: document.getElementById("picker-add") as HTMLButtonElement,
  pickerBackdrop: document.querySelector(".modal-backdrop") as HTMLDivElement,

  // Dialogs
  notebookDialog: document.getElementById(
    "notebook-dialog"
  ) as HTMLDialogElement,
  notebookDialogTitle: document.getElementById(
    "notebook-dialog-title"
  ) as HTMLHeadingElement,
  notebookNameInput: document.getElementById(
    "notebook-name-input"
  ) as HTMLInputElement,
  notebookDialogCancel: document.getElementById(
    "notebook-dialog-cancel"
  ) as HTMLButtonElement,
  notebookDialogConfirm: document.getElementById(
    "notebook-dialog-confirm"
  ) as HTMLButtonElement,

  confirmDialog: document.getElementById("confirm-dialog") as HTMLDialogElement,
  confirmDialogTitle: document.getElementById(
    "confirm-dialog-title"
  ) as HTMLHeadingElement,
  confirmDialogMessage: document.getElementById(
    "confirm-dialog-message"
  ) as HTMLParagraphElement,
  confirmDialogCancel: document.getElementById(
    "confirm-dialog-cancel"
  ) as HTMLButtonElement,
  confirmDialogConfirm: document.getElementById(
    "confirm-dialog-confirm"
  ) as HTMLButtonElement,

  notification: document.getElementById("notification") as HTMLDivElement,
};

// ============================================================================
// Initialization
// ============================================================================

async function init(): Promise<void> {
  permissions = await checkPermissions();
  currentNotebookId = await getActiveNotebookId();
  aiSettings = await getAISettings();

  updatePermissionUI();
  updateSettingsUI();
  setupEventListeners();
  await loadNotebooks();
  await loadSources();
  await loadChatHistory();
  updateTabCount();
  updateAddTabButton();

  // Listen for tab highlight changes to update button text
  chrome.tabs.onHighlighted.addListener(() => {
    updateAddTabButton();
  });

  // Listen for tab creation/removal to update tab count in real-time
  chrome.tabs.onCreated.addListener(() => {
    updateTabCount();
    refreshPickerIfShowingTabs();
  });

  chrome.tabs.onRemoved.addListener(() => {
    updateTabCount();
    refreshPickerIfShowingTabs();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    // Only refresh when URL or title changes (not for every status update)
    if (changeInfo.url || changeInfo.title) {
      refreshPickerIfShowingTabs();
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SOURCE_ADDED") {
      loadNotebooks();
      loadSources();
      showNotification("Source added");
    } else if (message.type === "CREATE_NOTEBOOK_AND_ADD_PAGE") {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove("pendingAction").catch(() => {});
      handleCreateNotebookAndAddPage(message.payload.tabId);
    } else if (message.type === "CREATE_NOTEBOOK_AND_ADD_LINK") {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove("pendingAction").catch(() => {});
      handleCreateNotebookAndAddLink(message.payload.linkUrl);
    }
  });

  // Check for pending actions from context menu (in case side panel was just opened)
  await checkPendingAction();
}

async function checkPendingAction(): Promise<void> {
  try {
    const result = await chrome.storage.session.get("pendingAction");
    if (result.pendingAction) {
      // Clear the pending action first to prevent duplicate processing
      await chrome.storage.session.remove("pendingAction");

      const { type, payload } = result.pendingAction;
      if (type === "CREATE_NOTEBOOK_AND_ADD_PAGE" && payload.tabId) {
        handleCreateNotebookAndAddPage(payload.tabId);
      } else if (type === "CREATE_NOTEBOOK_AND_ADD_LINK" && payload.linkUrl) {
        handleCreateNotebookAndAddLink(payload.linkUrl);
      }
    }
  } catch (error) {
    console.error("Failed to check pending action:", error);
  }
}

// Notify background script to rebuild context menus when notebooks change
function notifyNotebooksChanged(): void {
  chrome.runtime.sendMessage({ type: "REBUILD_CONTEXT_MENUS" }).catch(() => {
    // Background may not be ready
  });
}

async function handleCreateNotebookAndAddPage(tabId: number): Promise<void> {
  const name = await showNotebookDialog("New Notebook");
  if (!name) return;

  const notebook = createNotebook(name);
  await saveNotebook(notebook);
  currentNotebookId = notebook.id;
  await setActiveNotebookId(notebook.id);
  await loadNotebooks();
  elements.notebookSelect.value = notebook.id;
  notifyNotebooksChanged();

  // Now extract and add the page
  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      action: "extractContent",
    });
    if (result) {
      const source = createSource(
        notebook.id,
        "tab",
        result.url,
        result.title,
        result.markdown
      );
      await saveSource(source);
      await loadSources();
      showNotification("Notebook created and source added");
    }
  } catch (error) {
    console.error("Failed to add page:", error);
    showNotification("Notebook created");
  }
}

async function handleCreateNotebookAndAddLink(linkUrl: string): Promise<void> {
  const name = await showNotebookDialog("New Notebook");
  if (!name) return;

  const notebook = createNotebook(name);
  await saveNotebook(notebook);
  currentNotebookId = notebook.id;
  await setActiveNotebookId(notebook.id);
  await loadNotebooks();
  elements.notebookSelect.value = notebook.id;
  notifyNotebooksChanged();

  showNotification("Creating notebook and extracting content...");

  // Now extract and add the link
  try {
    const response = await chrome.runtime.sendMessage({
      type: "EXTRACT_FROM_URL",
      payload: linkUrl,
    });

    if (response) {
      const source = createSource(
        notebook.id,
        "tab",
        response.url || linkUrl,
        response.title || "Untitled",
        response.content || ""
      );
      await saveSource(source);
      await loadSources();
      showNotification("Notebook created and source added");
    }
  } catch (error) {
    console.error("Failed to add link:", error);
    showNotification("Notebook created but failed to add link");
  }
}

function setupEventListeners(): void {
  // Navigation
  elements.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  // Add Sources tab
  elements.addCurrentTabBtn.addEventListener("click", handleAddCurrentTab);
  elements.importTabs.addEventListener("click", handleImportTabs);
  elements.importTabGroups.addEventListener("click", handleImportTabGroups);
  elements.importBookmarks.addEventListener("click", handleImportBookmarks);
  elements.importHistory.addEventListener("click", handleImportHistory);

  // Chat tab
  elements.notebookSelect.addEventListener("change", handleNotebookChange);
  elements.newNotebookBtn.addEventListener("click", handleNewNotebook);
  elements.queryBtn.addEventListener("click", handleQuery);
  elements.queryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleQuery();
  });
  elements.addPageBtn.addEventListener("click", handleAddCurrentTab);
  elements.clearChatBtn?.addEventListener("click", handleClearChat);
  elements.chatMessages?.addEventListener("click", handleCitationClick);

  // Transform tab
  elements.transformPodcast?.addEventListener("click", () =>
    handleTransform("podcast")
  );
  elements.transformQuiz?.addEventListener("click", () =>
    handleTransform("quiz")
  );
  elements.transformTakeaways?.addEventListener("click", () =>
    handleTransform("takeaways")
  );
  elements.transformEmail?.addEventListener("click", () =>
    handleTransform("email")
  );
  elements.copyTransform?.addEventListener("click", () => {
    copyToClipboard(elements.transformContent.textContent || "");
  });
  elements.closeTransform?.addEventListener("click", () => {
    elements.transformResult.classList.add("hidden");
  });

  // Settings tab
  elements.permTabs.addEventListener("change", () =>
    handlePermissionToggle("tabs")
  );
  elements.permTabGroups.addEventListener("change", () =>
    handlePermissionToggle("tabGroups")
  );
  elements.permBookmarks.addEventListener("change", () =>
    handlePermissionToggle("bookmarks")
  );
  elements.permHistory.addEventListener("change", () =>
    handlePermissionToggle("history")
  );
  elements.aiProvider.addEventListener("change", handleProviderChange);
  elements.aiModel.addEventListener("change", handleModelChange);
  elements.apiKey.addEventListener("change", handleApiKeyChange);
  elements.testApiBtn.addEventListener("click", handleTestApi);
  elements.aiTemperature.addEventListener("input", handleTemperatureChange);
  elements.aiMaxTokens.addEventListener("change", handleMaxTokensChange);

  // FAB
  elements.fab.addEventListener("click", () => switchTab("add"));

  // Picker Modal
  elements.pickerClose?.addEventListener("click", closePicker);
  elements.pickerCancel?.addEventListener("click", closePicker);
  elements.pickerBackdrop?.addEventListener("click", closePicker);
  elements.pickerAdd?.addEventListener("click", handlePickerAdd);
  elements.pickerSearch?.addEventListener("input", handlePickerSearch);
}

// ============================================================================
// Tab Navigation
// ============================================================================

function switchTab(tabName: string): void {
  // Update nav items
  elements.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });

  // Update tab content
  elements.tabContents.forEach((content) => {
    content.classList.toggle("active", content.id === `tab-${tabName}`);
  });

  // Show/hide FAB based on tab
  elements.fab.classList.toggle(
    "hidden",
    tabName === "add" || tabName === "settings"
  );

  // Refresh data when switching tabs
  if (tabName === "library") {
    loadNotebooksList();
  } else if (tabName === "chat") {
    loadSources();
    loadChatHistory();
  } else if (tabName === "transform") {
    loadSources();
  }
}

// ============================================================================
// Notebooks
// ============================================================================

async function loadNotebooks(): Promise<void> {
  const notebooks = await getNotebooks();

  elements.notebookSelect.innerHTML =
    '<option value="">Select a notebook...</option>';

  for (const notebook of notebooks) {
    const option = document.createElement("option");
    option.value = notebook.id;
    option.textContent = notebook.name;
    elements.notebookSelect.appendChild(option);
  }

  if (currentNotebookId) {
    elements.notebookSelect.value = currentNotebookId;
  }
}

async function loadNotebooksList(): Promise<void> {
  const notebooks = await getNotebooks();

  if (notebooks.length === 0) {
    elements.notebooksList.innerHTML = `
      <div class="empty-state">
        <p>No notebooks yet. Create one to get started.</p>
      </div>
    `;
    return;
  }

  elements.notebooksList.innerHTML = "";

  for (const notebook of notebooks) {
    const sources = await getSourcesByNotebook(notebook.id);
    const div = document.createElement("div");
    div.className = "notebook-item";
    div.innerHTML = `
      <div class="notebook-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      </div>
      <div class="notebook-info">
        <div class="notebook-name">${escapeHtml(notebook.name)}</div>
        <div class="notebook-meta">${sources.length} sources</div>
      </div>
      <button class="icon-btn btn-delete-notebook" data-id="${
        notebook.id
      }" title="Delete notebook">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    const notebookClickArea = div.querySelector(".notebook-info");
    notebookClickArea?.addEventListener("click", () =>
      selectNotebook(notebook.id)
    );

    const deleteBtn = div.querySelector(".btn-delete-notebook");
    deleteBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteNotebook(notebook.id, notebook.name);
    });

    elements.notebooksList.appendChild(div);
  }
}

async function handleDeleteNotebook(id: string, name: string): Promise<void> {
  const confirmed = await showConfirmDialog(
    "Delete Notebook",
    `Are you sure you want to delete "${name}"? This will also delete all sources in this notebook.`
  );

  if (!confirmed) return;

  await deleteNotebook(id);

  // If we deleted the active notebook, clear it
  if (currentNotebookId === id) {
    currentNotebookId = null;
    await loadNotebooks();
  }

  await loadNotebooksList();
  await loadSources();
  notifyNotebooksChanged();
  showNotification("Notebook deleted");
}

async function handleNewNotebook(): Promise<void> {
  const name = await showNotebookDialog("New Notebook");
  if (!name) return;

  const notebook = createNotebook(name);
  await saveNotebook(notebook);
  currentNotebookId = notebook.id;
  await setActiveNotebookId(notebook.id);
  await loadNotebooks();
  elements.notebookSelect.value = notebook.id;
  notifyNotebooksChanged();
  showNotification("Notebook created");
}

async function handleNotebookChange(): Promise<void> {
  const id = elements.notebookSelect.value;
  currentNotebookId = id || null;
  await setActiveNotebookId(currentNotebookId);
  await loadSources();
  await loadChatHistory();
}

async function selectNotebook(id: string): Promise<void> {
  currentNotebookId = id;
  await setActiveNotebookId(id);
  await loadNotebooks();
  elements.notebookSelect.value = id;
  switchTab("chat");
  await loadSources();
  await loadChatHistory();
}

// ============================================================================
// Sources
// ============================================================================

async function loadSources(): Promise<void> {
  if (!currentNotebookId) {
    elements.activeSources.innerHTML = `
      <div class="empty-state">
        <p>Select or create a notebook to add sources.</p>
      </div>
    `;
    elements.sourceCount.textContent = "0";
    elements.sourcesList.innerHTML = "";
    return;
  }

  const sources = await getSourcesByNotebook(currentNotebookId);
  elements.sourceCount.textContent = sources.length.toString();

  // Render in Chat tab (compact)
  renderSourcesList(elements.activeSources, sources);

  // Render in Add tab (recent sources)
  renderSourcesList(elements.sourcesList, sources.slice(0, 5));
}

function renderSourcesList(container: HTMLElement, sources: Source[]): void {
  if (sources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No sources added yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  for (const source of sources) {
    const div = document.createElement("div");
    div.className = "source-item";

    const domain = new URL(source.url).hostname.replace("www.", "");
    const initial = source.title.charAt(0).toUpperCase();

    div.innerHTML = `
      <div class="source-icon">${initial}</div>
      <div class="source-info">
        <div class="source-title">${escapeHtml(source.title)}</div>
        <div class="source-url">${escapeHtml(domain)}</div>
      </div>
      <div class="source-actions">
        <button class="icon-btn btn-remove" data-id="${
          source.id
        }" title="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    const removeBtn = div.querySelector(".btn-remove");
    removeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleRemoveSource(source.id);
    });

    container.appendChild(div);
  }
}

async function handleAddCurrentTab(): Promise<void> {
  if (!currentNotebookId) {
    const name = await showNotebookDialog("Create a notebook first");
    if (!name) return;

    const notebook = createNotebook(name);
    await saveNotebook(notebook);
    currentNotebookId = notebook.id;
    await setActiveNotebookId(notebook.id);
    await loadNotebooks();
    elements.notebookSelect.value = notebook.id;
  }

  elements.addCurrentTabBtn.disabled = true;

  try {
    // Check for multiple highlighted tabs
    const highlightedTabs = await chrome.tabs.query({
      highlighted: true,
      currentWindow: true,
    });
    const tabsToAdd = highlightedTabs.filter(
      (tab) => tab.url && !tab.url.startsWith("chrome://")
    );

    if (tabsToAdd.length > 1) {
      // Multiple tabs selected - send message directly to content scripts
      elements.addCurrentTabBtn.textContent = `Adding ${tabsToAdd.length} tabs...`;

      let addedCount = 0;
      for (const tab of tabsToAdd) {
        if (!tab.id || !tab.url) continue;

        try {
          // Send message directly to the content script in the tab
          const result = await chrome.tabs.sendMessage(tab.id, {
            action: "extractContent",
          });

          if (result) {
            const source = createSource(
              currentNotebookId!,
              "tab",
              result.url || tab.url,
              result.title || tab.title || "Untitled",
              result.markdown || ""
            );
            await saveSource(source);
            addedCount++;
          }
        } catch (error) {
          console.error(`Failed to add tab ${tab.url}:`, error);
          // Fallback: add with just title/url if content script not available
          const source = createSource(
            currentNotebookId!,
            "tab",
            tab.url,
            tab.title || "Untitled",
            `Content from: ${tab.url}`
          );
          await saveSource(source);
          addedCount++;
        }
      }

      await loadSources();
      showNotification(
        `Added ${addedCount} source${addedCount > 1 ? "s" : ""}`
      );
    } else {
      // Single tab - use existing logic
      elements.addCurrentTabBtn.textContent = "Adding...";
      const response = await chrome.runtime.sendMessage({
        type: "EXTRACT_CONTENT",
      });

      if (response) {
        const source = createSource(
          currentNotebookId!,
          "tab",
          response.url,
          response.title,
          response.content
        );
        await saveSource(source);
        await loadSources();
      }
    }
  } catch (error) {
    console.error("Failed to add tab(s):", error);
  } finally {
    elements.addCurrentTabBtn.disabled = false;
    updateAddTabButton();
  }
}

async function updateAddTabButton(): Promise<void> {
  try {
    const highlightedTabs = await chrome.tabs.query({
      highlighted: true,
      currentWindow: true,
    });
    const validTabs = highlightedTabs.filter(
      (tab) => tab.url && !tab.url.startsWith("chrome://")
    );

    if (validTabs.length > 1) {
      elements.addCurrentTabBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add ${validTabs.length} Selected Tabs
      `;
    } else {
      elements.addCurrentTabBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Current Tab
      `;
    }
  } catch {
    // Keep default text if query fails
  }
}

async function handleRemoveSource(sourceId: string): Promise<void> {
  await deleteSource(sourceId);
  await loadSources();
}

// ============================================================================
// Import Options
// ============================================================================

async function handleImportTabs(): Promise<void> {
  if (!permissions.tabs) {
    const granted = await requestPermission("tabs");
    if (!granted) return;
    permissions = await checkPermissions();
    updatePermissionUI();
  }

  pickerType = "tab";
  elements.pickerTitle.textContent = "Select Tabs";
  elements.pickerList.innerHTML =
    '<div class="picker-loading">Loading tabs...</div>';
  openPicker();

  try {
    const tabs = await chrome.tabs.query({});
    pickerItems = tabs
      .filter((tab) => tab.url && !tab.url.startsWith("chrome://"))
      .map((tab) => ({
        id: tab.id?.toString() || "",
        url: tab.url || "",
        title: tab.title || "Untitled",
        favicon: tab.favIconUrl,
      }));
    renderPickerItems();
  } catch (error) {
    console.error("Failed to load tabs:", error);
    elements.pickerList.innerHTML =
      '<div class="picker-empty">Failed to load tabs</div>';
  }
}

async function handleImportTabGroups(): Promise<void> {
  // Tab groups require both tabs and tabGroups permissions
  if (!permissions.tabGroups) {
    const granted = await requestPermission("tabGroups");
    if (!granted) return;
    permissions = await checkPermissions();
    updatePermissionUI();
  }

  // Also need tabs permission to query tabs in groups
  if (!permissions.tabs) {
    const granted = await requestPermission("tabs");
    if (!granted) return;
    permissions = await checkPermissions();
    updatePermissionUI();
  }

  pickerType = "tabGroup";
  elements.pickerTitle.textContent = "Select Tab Groups";
  elements.pickerList.innerHTML =
    '<div class="picker-loading">Loading tab groups...</div>';
  openPicker();

  try {
    const groups = await chrome.tabGroups.query({});

    if (groups.length === 0) {
      elements.pickerList.innerHTML =
        '<div class="picker-empty">No tab groups found. Create a tab group first by right-clicking a tab.</div>';
      return;
    }

    // Get tab counts for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const tabsInGroup = await chrome.tabs.query({ groupId: group.id });
        return {
          ...group,
          tabCount: tabsInGroup.length,
        };
      })
    );

    pickerItems = groupsWithCounts.map((group) => ({
      id: group.id.toString(),
      url: "", // Tab groups don't have URLs
      title: group.title || `Unnamed ${group.color} group`,
      color: group.color,
      tabCount: group.tabCount,
    }));

    renderPickerItems();
  } catch (error) {
    console.error("Failed to load tab groups:", error);
    elements.pickerList.innerHTML =
      '<div class="picker-empty">Failed to load tab groups</div>';
  }
}

async function handleImportBookmarks(): Promise<void> {
  if (!permissions.bookmarks) {
    const granted = await requestPermission("bookmarks");
    if (!granted) return;
    permissions = await checkPermissions();
    updatePermissionUI();
  }

  pickerType = "bookmark";
  elements.pickerTitle.textContent = "Select Bookmarks";
  elements.pickerList.innerHTML =
    '<div class="picker-loading">Loading bookmarks...</div>';
  openPicker();

  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    pickerItems = flattenBookmarks(bookmarkTree);
    renderPickerItems();
  } catch (error) {
    console.error("Failed to load bookmarks:", error);
    elements.pickerList.innerHTML =
      '<div class="picker-empty">Failed to load bookmarks</div>';
  }
}

function flattenBookmarks(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): PickerItem[] {
  const items: PickerItem[] = [];

  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]): void {
    for (const node of nodes) {
      if (node.url) {
        items.push({
          id: node.id,
          url: node.url,
          title: node.title || "Untitled",
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return items;
}

async function handleImportHistory(): Promise<void> {
  if (!permissions.history) {
    const granted = await requestPermission("history");
    if (!granted) return;
    permissions = await checkPermissions();
    updatePermissionUI();
  }

  pickerType = "history";
  elements.pickerTitle.textContent = "Select from History";
  elements.pickerList.innerHTML =
    '<div class="picker-loading">Loading history...</div>';
  openPicker();

  try {
    const historyItems = await chrome.history.search({
      text: "",
      maxResults: 100,
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
    });
    pickerItems = historyItems
      .filter((item) => item.url && item.title)
      .map((item) => ({
        id: item.id || item.url || "",
        url: item.url || "",
        title: item.title || "Untitled",
      }));
    renderPickerItems();
  } catch (error) {
    console.error("Failed to load history:", error);
    elements.pickerList.innerHTML =
      '<div class="picker-empty">Failed to load history</div>';
  }
}

async function updateTabCount(): Promise<void> {
  try {
    if (permissions.tabs) {
      const tabs = await chrome.tabs.query({});
      elements.tabsCount.textContent = `Choose from ${tabs.length} active tabs`;
    }
  } catch {
    // Ignore if permission not granted
  }
}

// ============================================================================
// Picker Modal
// ============================================================================

function openPicker(): void {
  selectedPickerItems.clear();
  elements.pickerSearch.value = "";
  updatePickerSelectedCount();
  elements.pickerModal.classList.remove("hidden");
}

function closePicker(): void {
  elements.pickerModal.classList.add("hidden");
  pickerItems = [];
  selectedPickerItems.clear();
  pickerType = null;
}

async function refreshPickerIfShowingTabs(): Promise<void> {
  // Only refresh if picker is open and showing tabs
  if (pickerType !== "tab") return;
  if (elements.pickerModal.classList.contains("hidden")) return;

  try {
    const tabs = await chrome.tabs.query({});
    const currentFilter = elements.pickerSearch.value;

    pickerItems = tabs
      .filter((tab) => tab.url && !tab.url.startsWith("chrome://"))
      .map((tab) => ({
        id: tab.id?.toString() || "",
        url: tab.url || "",
        title: tab.title || "Untitled",
        favicon: tab.favIconUrl,
      }));

    // Remove any selected items that no longer exist
    const currentIds = new Set(pickerItems.map((item) => item.id));
    for (const selectedId of selectedPickerItems) {
      if (!currentIds.has(selectedId)) {
        selectedPickerItems.delete(selectedId);
      }
    }

    renderPickerItems(currentFilter);
    updatePickerSelectedCount();
  } catch (error) {
    console.error("Failed to refresh tabs:", error);
  }
}

function renderPickerItems(filter: string = ""): void {
  const filteredItems = filter
    ? pickerItems.filter(
        (item) =>
          item.title.toLowerCase().includes(filter.toLowerCase()) ||
          item.url.toLowerCase().includes(filter.toLowerCase())
      )
    : pickerItems;

  if (filteredItems.length === 0) {
    elements.pickerList.innerHTML =
      '<div class="picker-empty">No items found</div>';
    return;
  }

  elements.pickerList.innerHTML = "";

  for (const item of filteredItems) {
    const div = document.createElement("div");
    div.className = `picker-item${
      selectedPickerItems.has(item.id) ? " selected" : ""
    }`;
    div.dataset.id = item.id;

    const initial = item.title.charAt(0).toUpperCase();

    // Handle tab groups differently
    if (pickerType === "tabGroup") {
      const colorClass = item.color ? `tab-group-color-${item.color}` : "";
      div.innerHTML = `
        <div class="picker-checkbox">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="picker-icon ${colorClass}" style="background-color: var(--tab-group-${
        item.color || "grey"
      });">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          </svg>
        </div>
        <div class="picker-info">
          <div class="picker-title">${escapeHtml(item.title)}</div>
          <div class="picker-url">${item.tabCount} tab${
        item.tabCount !== 1 ? "s" : ""
      }</div>
        </div>
      `;
    } else {
      const domain = getDomain(item.url);
      div.innerHTML = `
        <div class="picker-checkbox">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="picker-icon">
          ${
            item.favicon
              ? `<img src="${item.favicon}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${initial}'">`
              : initial
          }
        </div>
        <div class="picker-info">
          <div class="picker-title">${escapeHtml(item.title)}</div>
          <div class="picker-url">${escapeHtml(domain)}</div>
        </div>
      `;
    }

    div.addEventListener("click", () => togglePickerItem(item.id));
    elements.pickerList.appendChild(div);
  }
}

function togglePickerItem(id: string): void {
  if (selectedPickerItems.has(id)) {
    selectedPickerItems.delete(id);
  } else {
    selectedPickerItems.add(id);
  }

  // Update UI
  const item = elements.pickerList.querySelector(`[data-id="${id}"]`);
  item?.classList.toggle("selected", selectedPickerItems.has(id));
  updatePickerSelectedCount();
}

function updatePickerSelectedCount(): void {
  const count = selectedPickerItems.size;
  const label = count === 0 ? "Add Selected" : `Add ${count}`;
  elements.pickerAdd.textContent = label;
  elements.pickerAdd.disabled = count === 0;
}

function handlePickerSearch(): void {
  const filter = elements.pickerSearch.value.trim();
  renderPickerItems(filter);
}

async function handlePickerAdd(): Promise<void> {
  if (selectedPickerItems.size === 0) return;

  // Ensure notebook exists
  if (!currentNotebookId) {
    const name = await showNotebookDialog("Create a notebook first");
    if (!name) return;

    const notebook = createNotebook(name);
    await saveNotebook(notebook);
    currentNotebookId = notebook.id;
    await setActiveNotebookId(notebook.id);
    await loadNotebooks();
    elements.notebookSelect.value = notebook.id;
  }

  const selectedItems = pickerItems.filter((item) =>
    selectedPickerItems.has(item.id)
  );
  elements.pickerAdd.disabled = true;
  elements.pickerAdd.textContent = "Adding...";

  let addedCount = 0;

  // Handle tab groups specially - need to get all tabs in the group
  if (pickerType === "tabGroup") {
    for (const groupItem of selectedItems) {
      try {
        const groupId = parseInt(groupItem.id, 10);
        const tabsInGroup = await chrome.tabs.query({ groupId });

        for (const tab of tabsInGroup) {
          if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) continue;

          try {
            // Send message directly to content script
            const result = await chrome.tabs.sendMessage(tab.id, {
              action: "extractContent",
            });

            if (result) {
              const source = createSource(
                currentNotebookId!,
                "tab",
                result.url || tab.url,
                result.title || tab.title || "Untitled",
                result.markdown || ""
              );
              await saveSource(source);
              addedCount++;
            }
          } catch (error) {
            console.error(`Failed to extract from tab ${tab.url}:`, error);
            // Fallback: add with just title/url
            const source = createSource(
              currentNotebookId!,
              "tab",
              tab.url,
              tab.title || "Untitled",
              `Content from: ${tab.url}`
            );
            await saveSource(source);
            addedCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to process tab group ${groupItem.id}:`, error);
      }
    }
  } else {
    // Handle regular items (tabs, bookmarks, history)
    for (const item of selectedItems) {
      try {
        // Extract content from the URL
        const response = await chrome.runtime.sendMessage({
          type: "EXTRACT_FROM_URL",
          payload: item.url,
        });

        if (response) {
          const source = createSource(
            currentNotebookId!,
            pickerType || "tab",
            response.url || item.url,
            response.title || item.title,
            response.content || ""
          );
          await saveSource(source);
          addedCount++;
        }
      } catch (error) {
        console.error(`Failed to add ${item.url}:`, error);
        // If extraction fails, add with just the title/url
        const source = createSource(
          currentNotebookId!,
          pickerType || "tab",
          item.url,
          item.title,
          `Content from: ${item.url}`
        );
        await saveSource(source);
        addedCount++;
      }
    }
  }

  closePicker();
  await loadSources();

  if (addedCount > 0) {
    showNotification(`Added ${addedCount} source${addedCount > 1 ? "s" : ""}`);
  }

  elements.pickerAdd.disabled = false;
  updatePickerSelectedCount();
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// ============================================================================
// Chat History & Query
// ============================================================================

async function loadChatHistory(): Promise<void> {
  if (!currentNotebookId) {
    elements.chatMessages.innerHTML = `
      <div class="empty-state">
        <p>Select a notebook to view chat history.</p>
      </div>
    `;
    return;
  }

  const messages = await getChatHistory(currentNotebookId);

  if (messages.length === 0) {
    elements.chatMessages.innerHTML = `
      <div class="empty-state">
        <p>Ask a question to get started.</p>
      </div>
    `;
    return;
  }

  // Fetch sources for citation rendering
  const sources = await getSourcesByNotebook(currentNotebookId);

  elements.chatMessages.innerHTML = "";

  for (const message of messages) {
    appendChatMessage(message, sources);
  }

  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendChatMessage(
  message: ChatMessage,
  sources: Source[] = [],
  isStreaming: boolean = false
): HTMLDivElement {
  // Remove empty state if present
  const emptyState = elements.chatMessages.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }

  const existingMessage = document.getElementById(`msg-${message.id}`);
  if (existingMessage) {
    // Update existing message
    const contentEl = existingMessage.querySelector(".chat-message-content");
    if (contentEl) {
      contentEl.innerHTML = formatMarkdown(message.content);
    }
    // Update citations if present
    if (message.citations && message.citations.length > 0 && !isStreaming) {
      let citationsEl = existingMessage.querySelector(".chat-citations");
      if (!citationsEl) {
        citationsEl = document.createElement("div");
        citationsEl.className = "chat-citations";
        existingMessage.appendChild(citationsEl);
      }
      citationsEl.innerHTML = renderCitations(message.citations, sources);
    }
    return existingMessage as HTMLDivElement;
  }

  const div = document.createElement("div");
  div.id = `msg-${message.id}`;
  div.className = `chat-message ${message.role}`;

  const roleLabel = message.role === "user" ? "You" : "Assistant";
  const timeStr = formatRelativeTime(message.timestamp);

  div.innerHTML = `
    <div class="chat-message-role">${roleLabel}</div>
    <div class="chat-message-content">${formatMarkdown(message.content)}</div>
    ${
      message.citations && message.citations.length > 0 && !isStreaming
        ? `
      <div class="chat-citations">
        ${renderCitations(message.citations, sources)}
      </div>
    `
        : ""
    }
    <div class="chat-message-time">${timeStr}</div>
  `;

  elements.chatMessages.appendChild(div);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  return div;
}

interface GroupedCitation {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  excerpts: string[];
}

function renderCitations(citations: Citation[], sources: Source[]): string {
  if (citations.length === 0) return "";

  // Group citations by sourceId
  const groupedMap = new Map<string, GroupedCitation>();

  for (const citation of citations) {
    const source = sources.find((s) => s.id === citation.sourceId);
    const sourceUrl = source?.url || "";

    if (groupedMap.has(citation.sourceId)) {
      const group = groupedMap.get(citation.sourceId)!;
      // Only add unique excerpts
      if (!group.excerpts.includes(citation.excerpt)) {
        group.excerpts.push(citation.excerpt);
      }
    } else {
      groupedMap.set(citation.sourceId, {
        sourceId: citation.sourceId,
        sourceTitle: citation.sourceTitle,
        sourceUrl,
        excerpts: [citation.excerpt],
      });
    }
  }

  const grouped = Array.from(groupedMap.values());

  return `
    <div class="chat-citations-title">Sources cited (${grouped.length} source${grouped.length !== 1 ? "s" : ""})</div>
    ${grouped
      .map((group, sourceIndex) => {
        const sourceNumber = sourceIndex + 1;

        if (group.excerpts.length === 1) {
          // Single excerpt - show simple format
          return `
          <div class="citation-item" data-source-id="${group.sourceId}" data-source-url="${escapeHtml(group.sourceUrl)}" data-excerpt="${escapeHtml(group.excerpts[0])}">
            <div class="citation-number">${sourceNumber}</div>
            <div class="citation-content">
              <div class="citation-source">${escapeHtml(group.sourceTitle)}</div>
              <div class="citation-excerpt">${escapeHtml(group.excerpts[0])}</div>
            </div>
          </div>
        `;
        } else {
          // Multiple excerpts - show grouped format with sub-labels
          return `
          <div class="citation-group">
            <div class="citation-group-header">
              <div class="citation-number">${sourceNumber}</div>
              <div class="citation-source">${escapeHtml(group.sourceTitle)}</div>
              <div class="citation-excerpt-count">${group.excerpts.length} references</div>
            </div>
            <div class="citation-group-excerpts">
              ${group.excerpts
                .map((excerpt, excerptIndex) => {
                  const subLabel = String.fromCharCode(97 + excerptIndex); // a, b, c, ...
                  return `
                <div class="citation-item citation-sub-item" data-source-id="${group.sourceId}" data-source-url="${escapeHtml(group.sourceUrl)}" data-excerpt="${escapeHtml(excerpt)}">
                  <div class="citation-number citation-sub-number">${sourceNumber}${subLabel}</div>
                  <div class="citation-content">
                    <div class="citation-excerpt">${escapeHtml(excerpt)}</div>
                  </div>
                </div>
              `;
                })
                .join("")}
            </div>
          </div>
        `;
        }
      })
      .join("")}
  `;
}

function createTextFragmentUrl(baseUrl: string, excerpt: string): string {
  // Clean up the excerpt for text fragment
  // Take first ~100 chars to avoid overly long fragments
  let text = excerpt.trim();
  if (text.length > 100) {
    // Try to cut at a word boundary
    text = text.substring(0, 100);
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace > 50) {
      text = text.substring(0, lastSpace);
    }
  }

  // Remove any existing fragment
  const urlWithoutFragment = baseUrl.split("#")[0];

  // Encode the text for URL
  const encodedText = encodeURIComponent(text);

  return `${urlWithoutFragment}#:~:text=${encodedText}`;
}

function handleCitationClick(event: Event): void {
  const target = event.target as HTMLElement;
  const citationItem = target.closest(".citation-item") as HTMLElement;

  if (!citationItem) return;

  const sourceUrl = citationItem.dataset.sourceUrl;
  const excerpt = citationItem.dataset.excerpt;

  if (!sourceUrl) {
    showNotification("Source URL not available");
    return;
  }

  // Skip if excerpt is generic
  if (!excerpt || excerpt === "Referenced in response") {
    // Just open the URL without text fragment
    chrome.tabs.create({ url: sourceUrl });
    return;
  }

  // Create URL with text fragment
  const fragmentUrl = createTextFragmentUrl(sourceUrl, excerpt);
  chrome.tabs.create({ url: fragmentUrl });
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function handleQuery(): Promise<void> {
  const query = elements.queryInput.value.trim();
  if (!query || !currentNotebookId) return;

  const sources = await getSourcesByNotebook(currentNotebookId);
  if (sources.length === 0) {
    showNotification("Add some sources first");
    return;
  }

  elements.queryInput.value = "";
  elements.queryBtn.disabled = true;
  elements.chatStatus.textContent = "Generating response...";

  // Save user message
  const userMessage = createChatMessage(currentNotebookId, "user", query);
  await saveChatMessage(userMessage);
  appendChatMessage(userMessage, sources);

  // Check cache first
  const sourceIds = sources.map((s) => s.id);
  const cacheKey = createCacheKey(query, sourceIds);
  const cached = await getCachedResponse(cacheKey);

  if (cached && !navigator.onLine) {
    // Use cached response when offline
    const assistantMessage = createChatMessage(
      currentNotebookId,
      "assistant",
      cached.response,
      cached.citations
    );
    await saveChatMessage(assistantMessage);
    appendChatMessage(assistantMessage, sources);
    elements.queryBtn.disabled = false;
    elements.chatStatus.innerHTML =
      'Response loaded from cache <span class="offline-indicator">Offline</span>';
    return;
  }

  // Create placeholder for assistant message
  const assistantMessage = createChatMessage(
    currentNotebookId,
    "assistant",
    ""
  );
  const messageDiv = appendChatMessage(assistantMessage, sources, true);

  try {
    const stream = streamChat(sources, query);
    let fullContent = "";
    let citations: Citation[] = [];
    let streamResult: IteratorResult<
      string,
      { content: string; citations: Citation[] }
    >;

    // Consume the stream
    while (true) {
      streamResult = await stream.next();
      if (streamResult.done) {
        // Stream finished - get final result with citations
        fullContent = streamResult.value.content;
        citations = streamResult.value.citations;
        break;
      }

      fullContent += streamResult.value;
      // Update message content as it streams
      const contentEl = messageDiv.querySelector(".chat-message-content");
      if (contentEl) {
        // Remove citations section from displayed content during streaming
        const cleanContent = fullContent.replace(/---CITATIONS---[\s\S]*$/, "");
        contentEl.innerHTML = formatMarkdown(cleanContent);
      }
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    // Update the message with final content and citations
    assistantMessage.content = fullContent;
    assistantMessage.citations = citations;
    await saveChatMessage(assistantMessage);

    // Re-render with citations
    const contentEl = messageDiv.querySelector(".chat-message-content");
    if (contentEl) {
      contentEl.innerHTML = formatMarkdown(fullContent);
    }

    // Add citations if present
    if (citations.length > 0) {
      const citationsDiv = document.createElement("div");
      citationsDiv.className = "chat-citations";
      citationsDiv.innerHTML = renderCitations(citations, sources);
      messageDiv.insertBefore(
        citationsDiv,
        messageDiv.querySelector(".chat-message-time")
      );
    }

    // Cache the response for offline use
    const cachedResponse = createCachedResponse(
      currentNotebookId,
      query,
      sourceIds,
      fullContent,
      citations
    );
    await saveCachedResponse(cachedResponse);

    elements.chatStatus.textContent =
      "Ask questions to synthesize information from your sources.";
  } catch (error) {
    console.error("Query failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if we have a cached response to fall back to
    if (cached) {
      assistantMessage.content = cached.response;
      assistantMessage.citations = cached.citations;
      await saveChatMessage(assistantMessage);

      const contentEl = messageDiv.querySelector(".chat-message-content");
      if (contentEl) {
        contentEl.innerHTML = formatMarkdown(cached.response);
      }

      if (cached.citations.length > 0) {
        const citationsDiv = document.createElement("div");
        citationsDiv.className = "chat-citations";
        citationsDiv.innerHTML = renderCitations(cached.citations, sources);
        messageDiv.insertBefore(
          citationsDiv,
          messageDiv.querySelector(".chat-message-time")
        );
      }

      elements.chatStatus.innerHTML = "Response loaded from cache (API error)";
      showNotification("Using cached response due to API error");
    } else {
      // Show error in the message
      assistantMessage.content = `Failed to generate response: ${errorMessage}\n\nPlease check your API key in Settings.`;
      await saveChatMessage(assistantMessage);

      const contentEl = messageDiv.querySelector(".chat-message-content");
      if (contentEl) {
        contentEl.innerHTML = `<p class="error">${escapeHtml(
          assistantMessage.content
        )}</p>`;
      }
      elements.chatStatus.textContent = "Error occurred. Please try again.";
    }
  } finally {
    elements.queryBtn.disabled = false;
  }
}

async function handleClearChat(): Promise<void> {
  if (!currentNotebookId) return;

  const confirmed = await showConfirmDialog(
    "Clear Chat History",
    "Are you sure you want to clear all chat messages for this notebook?"
  );

  if (!confirmed) return;

  await clearChatHistory(currentNotebookId);
  await loadChatHistory();
  showNotification("Chat history cleared");
}

// ============================================================================
// Transformations
// ============================================================================

async function handleTransform(
  type: "podcast" | "quiz" | "takeaways" | "email"
): Promise<void> {
  if (!currentNotebookId) {
    showNotification("Please select a notebook first");
    return;
  }

  const sources = await getSourcesByNotebook(currentNotebookId);
  if (sources.length === 0) {
    showNotification("Add some sources first");
    return;
  }

  const titles: Record<string, string> = {
    podcast: "Podcast Script",
    quiz: "Study Quiz",
    takeaways: "Key Takeaways",
    email: "Email Summary",
  };

  elements.transformResult.classList.remove("hidden");
  elements.transformResultTitle.textContent = titles[type];
  elements.transformContent.innerHTML = "<em>Generating...</em>";

  // Disable buttons during generation
  const buttons = [
    elements.transformPodcast,
    elements.transformQuiz,
    elements.transformTakeaways,
    elements.transformEmail,
  ];
  buttons.forEach((btn) => btn && (btn.disabled = true));

  try {
    let result: string;

    switch (type) {
      case "podcast":
        result = await generatePodcastScript(sources, 5);
        break;
      case "quiz":
        result = await generateQuiz(sources, 5);
        break;
      case "takeaways":
        result = await generateKeyTakeaways(sources);
        break;
      case "email":
        result = await generateEmailSummary(sources);
        break;
    }

    elements.transformContent.innerHTML = formatMarkdown(result);
  } catch (error) {
    console.error("Transform failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    elements.transformContent.innerHTML = `
      <p class="error">Failed to generate: ${escapeHtml(errorMessage)}</p>
      <p>Please check your API key in Settings.</p>
    `;
  } finally {
    buttons.forEach((btn) => btn && (btn.disabled = false));
  }
}

// ============================================================================
// Settings
// ============================================================================

function updatePermissionUI(): void {
  elements.permTabs.checked = permissions.tabs;
  elements.permTabGroups.checked = permissions.tabGroups;
  elements.permBookmarks.checked = permissions.bookmarks;
  elements.permHistory.checked = permissions.history;

  elements.importTabs.disabled = false;
  elements.importTabGroups.disabled = false;
  elements.importBookmarks.disabled = false;
  elements.importHistory.disabled = false;
}

function updateSettingsUI(): void {
  if (!aiSettings) return;

  elements.aiProvider.value = aiSettings.provider;
  handleProviderChange();
  elements.aiModel.value = aiSettings.model;

  const apiKey = aiSettings.apiKeys[aiSettings.provider];
  if (apiKey) {
    elements.apiKey.value = apiKey;
  }

  // Load advanced settings
  const temperature = aiSettings.temperature ?? 1;
  elements.aiTemperature.value = temperature.toString();
  elements.temperatureValue.textContent = temperature.toFixed(1);

  if (aiSettings.maxTokens) {
    elements.aiMaxTokens.value = aiSettings.maxTokens.toString();
  } else {
    elements.aiMaxTokens.value = "";
  }
}

async function handlePermissionToggle(
  permission: "tabs" | "tabGroups" | "bookmarks" | "history"
): Promise<void> {
  // Map permission names to element property names
  const elementMap: Record<string, keyof typeof elements> = {
    tabs: "permTabs",
    tabGroups: "permTabGroups",
    bookmarks: "permBookmarks",
    history: "permHistory",
  };

  const checkbox = elements[elementMap[permission]] as HTMLInputElement;

  if (checkbox.checked) {
    const granted = await requestPermission(permission);
    checkbox.checked = granted;
  }

  permissions = await checkPermissions();
  updatePermissionUI();
  updateTabCount();
}

async function handleProviderChange(): Promise<void> {
  const provider = elements.aiProvider.value as AISettings["provider"];

  const modelOptions: Record<string, { value: string; label: string }[]> = {
    anthropic: [
      { value: "claude-sonnet-4-5-20250514", label: "Claude 4.5 Sonnet" },
      { value: "claude-opus-4-5-20250514", label: "Claude 4.5 Opus" },
      { value: "claude-haiku-4-5-20250514", label: "Claude 4.5 Haiku" },
    ],
    openai: [
      { value: "gpt-5", label: "GPT-5" },
      { value: "gpt-5-mini", label: "GPT-5 Mini" },
      { value: "gpt-5.1-instant", label: "GPT-5.1 Instant" },
    ],
    google: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
      { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
    ],
    chrome: [{ value: "built-in", label: "Chrome Built-in AI" }],
  };

  const models = modelOptions[provider] || [];
  elements.aiModel.innerHTML = "";

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.value;
    option.textContent = model.label;
    elements.aiModel.appendChild(option);
  }

  const apiKeyRow = elements.apiKey.parentElement;
  const apiKeyLabel = apiKeyRow?.previousElementSibling as HTMLElement;
  if (apiKeyRow) {
    apiKeyRow.style.display = provider === "chrome" ? "none" : "flex";
  }
  if (apiKeyLabel) {
    apiKeyLabel.style.display = provider === "chrome" ? "none" : "block";
  }

  // Update API key link based on provider
  const apiKeyLinks: Record<string, { url: string; text: string }> = {
    anthropic: {
      url: "https://console.anthropic.com/settings/keys",
      text: "Get a Claude API key",
    },
    openai: {
      url: "https://platform.openai.com/api-keys",
      text: "Get an OpenAI API key",
    },
    google: {
      url: "https://aistudio.google.com/apikey",
      text: "Get a Gemini API key",
    },
  };

  const linkInfo = apiKeyLinks[provider];
  if (linkInfo) {
    elements.apiKeyLink.href = linkInfo.url;
    elements.apiKeyLink.textContent = linkInfo.text;
    elements.apiKeyLink.style.display = "inline-block";
  } else {
    elements.apiKeyLink.style.display = "none";
  }

  // Hide advanced settings for Chrome built-in AI
  const advancedSettings = document.querySelector(".advanced-settings") as HTMLDetailsElement;
  if (advancedSettings) {
    advancedSettings.style.display = provider === "chrome" ? "none" : "block";
  }

  // Load saved API key for this provider
  if (aiSettings) {
    const savedKey = aiSettings.apiKeys[provider] || "";
    elements.apiKey.value = savedKey;
  }

  await setProvider(provider);
  aiSettings = await getAISettings();
}

async function handleModelChange(): Promise<void> {
  const model = elements.aiModel.value;
  await setModel(model);
  aiSettings = await getAISettings();
}

async function handleApiKeyChange(): Promise<void> {
  const apiKey = elements.apiKey.value.trim();
  const provider = elements.aiProvider.value;
  await setApiKey(provider, apiKey);
  aiSettings = await getAISettings();
}

async function handleTestApi(): Promise<void> {
  const provider = elements.aiProvider.value;
  const apiKey = elements.apiKey.value.trim();

  if (!apiKey && provider !== "chrome") {
    showNotification("Please enter an API key");
    return;
  }

  // Save the API key first
  await handleApiKeyChange();

  elements.testApiBtn.disabled = true;
  elements.testApiBtn.textContent = "Testing...";

  try {
    const result = await testConnection();
    if (result.success) {
      showNotification("Connection successful!");
    } else {
      showNotification(`Connection failed: ${result.error}`, 4000);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    showNotification(`Connection failed: ${errorMessage}`, 4000);
  } finally {
    elements.testApiBtn.disabled = false;
    elements.testApiBtn.textContent = "Test";
  }
}

function handleTemperatureChange(): void {
  const value = parseFloat(elements.aiTemperature.value);
  elements.temperatureValue.textContent = value.toFixed(1);
  setTemperature(value);
}

async function handleMaxTokensChange(): Promise<void> {
  const value = elements.aiMaxTokens.value.trim();
  const maxTokens = value ? parseInt(value, 10) : undefined;
  await setMaxTokens(maxTokens);
  aiSettings = await getAISettings();
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(text: string): string {
  // Basic markdown formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^- (.*$)/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

function copyToClipboard(text: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification("Copied to clipboard");
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
    });
}

// ============================================================================
// Notifications & Dialogs
// ============================================================================

function showNotification(message: string, duration: number = 2000): void {
  if (!elements.notification) return;
  elements.notification.textContent = message;
  elements.notification.classList.add("show");
  setTimeout(() => {
    elements.notification.classList.remove("show");
  }, duration);
}

function showNotebookDialog(
  title: string = "New Notebook"
): Promise<string | null> {
  return new Promise((resolve) => {
    elements.notebookDialogTitle.textContent = title;
    elements.notebookNameInput.value = "";
    elements.notebookDialog.showModal();

    const handleCancel = () => {
      elements.notebookDialog.close();
      cleanup();
      resolve(null);
    };

    const handleConfirm = () => {
      const name = elements.notebookNameInput.value.trim();
      elements.notebookDialog.close();
      cleanup();
      resolve(name || null);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    };

    const cleanup = () => {
      elements.notebookDialogCancel.removeEventListener("click", handleCancel);
      elements.notebookDialogConfirm.removeEventListener(
        "click",
        handleConfirm
      );
      elements.notebookNameInput.removeEventListener("keydown", handleKeydown);
    };

    elements.notebookDialogCancel.addEventListener("click", handleCancel);
    elements.notebookDialogConfirm.addEventListener("click", handleConfirm);
    elements.notebookNameInput.addEventListener("keydown", handleKeydown);
    elements.notebookNameInput.focus();
  });
}

function showConfirmDialog(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    elements.confirmDialogTitle.textContent = title;
    elements.confirmDialogMessage.textContent = message;
    elements.confirmDialog.showModal();

    const handleCancel = () => {
      elements.confirmDialog.close();
      cleanup();
      resolve(false);
    };

    const handleConfirm = () => {
      elements.confirmDialog.close();
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      elements.confirmDialogCancel.removeEventListener("click", handleCancel);
      elements.confirmDialogConfirm.removeEventListener("click", handleConfirm);
    };

    elements.confirmDialogCancel.addEventListener("click", handleCancel);
    elements.confirmDialogConfirm.addEventListener("click", handleConfirm);
  });
}

// ============================================================================
// Start
// ============================================================================

init();

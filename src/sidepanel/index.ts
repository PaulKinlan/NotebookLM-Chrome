import type {
  Source,
  PermissionStatus,
  ChatMessage,
  Citation,
  SuggestedLink,
} from "../types/index.ts";
import DOMPurify, { Config } from "dompurify";
import { checkPermissions, requestPermission } from "../lib/permissions.ts";
import { renderMarkdown, isHtmlContent } from "../lib/markdown-renderer.ts";
import {
  getNotebooks,
  saveNotebook,
  createNotebook,
  deleteNotebook,
  getNotebook,
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
  getSummary,
  saveSummary,
  createSummary,
  clearAllData,
  getTransformations,
} from "../lib/storage.ts";
import {
  streamChat,
  generatePodcastScript,
  generateQuiz,
  generateKeyTakeaways,
  generateEmailSummary,
  generateSlideDeck,
  generateReport,
  generateDataTable,
  generateMindMap,
  generateFlashcards,
  generateTimeline,
  generateGlossary,
  generateComparison,
  generateFAQ,
  generateActionItems,
  generateExecutiveBrief,
  generateStudyGuide,
  generateProsCons,
  generateCitationList,
  generateOutline,
  generateSummary,
  formatErrorForUser,
} from "../lib/ai.ts";
import {
  getModelConfigs,
  getDefaultModelConfig,
} from "../lib/model-configs.ts";
import { initProviderConfigUI, AI_PROFILES_CHANGED_EVENT } from './provider-config-ui.ts';
import { filterLinksWithAI, hasExtractableLinks } from '../lib/suggested-links.ts';
import { SandboxRenderer } from "../lib/sandbox-renderer.ts";
import {
  exportNotebook,
  type NotebookExport,
  type ExportFormat,
} from "../lib/export.ts";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  ONBOARDING_STEPS,
} from "../lib/onboarding.ts";

// ============================================================================
// State
// ============================================================================

let currentNotebookId: string | null = null;
let onboardingStep = 0;

let permissions: PermissionStatus = {
  tabs: false,
  tabGroups: false,
  bookmarks: false,
  history: false,
};

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

// Suggested links state
let suggestedLinksCache: Map<string, SuggestedLink[]> = new Map();
let suggestedLinksLoading = false;

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Navigation
  navItems: Array.from(
    document.querySelectorAll(".nav-item")
  ).filter((item): item is HTMLElement => item instanceof HTMLElement),
  tabContents: Array.from(
    document.querySelectorAll(".tab-content")
  ).filter((item): item is HTMLElement => item instanceof HTMLElement),

  // Header buttons
  headerLibraryBtn: document.getElementById(
    "header-library-btn"
  ) as HTMLButtonElement,
  headerSettingsBtn: document.getElementById(
    "header-settings-btn"
  ) as HTMLButtonElement,

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
  aiModelBtn: document.getElementById(
    "ai-model-btn"
  ) as HTMLButtonElement,
  aiModelDropdown: document.getElementById(
    "ai-model-dropdown"
  ) as HTMLDivElement,
  aiModelList: document.getElementById(
    "ai-model-list"
  ) as HTMLDivElement,
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

  // Summary section
  summarySection: document.getElementById("summary-section") as HTMLDetailsElement,
  notebookSummary: document.getElementById(
    "notebook-summary"
  ) as HTMLDivElement,
  regenerateSummaryBtn: document.getElementById(
    "regenerate-summary-btn"
  ) as HTMLButtonElement,

  // Suggested links section
  suggestedLinksSection: document.getElementById("suggested-links-section") as HTMLDetailsElement,
  suggestedLinksCount: document.getElementById("suggested-links-count") as HTMLSpanElement,
  suggestedLinksContent: document.getElementById("suggested-links-content") as HTMLDivElement,
  suggestedLinksList: document.getElementById("suggested-links-list") as HTMLDivElement,
  refreshLinksBtn: document.getElementById("refresh-links-btn") as HTMLButtonElement,

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
  transformSlidedeck: document.getElementById(
    "transform-slidedeck"
  ) as HTMLButtonElement,
  transformReport: document.getElementById(
    "transform-report"
  ) as HTMLButtonElement,
  transformDatatable: document.getElementById(
    "transform-datatable"
  ) as HTMLButtonElement,
  transformMindmap: document.getElementById(
    "transform-mindmap"
  ) as HTMLButtonElement,
  transformFlashcards: document.getElementById(
    "transform-flashcards"
  ) as HTMLButtonElement,
  transformTimeline: document.getElementById(
    "transform-timeline"
  ) as HTMLButtonElement,
  transformGlossary: document.getElementById(
    "transform-glossary"
  ) as HTMLButtonElement,
  transformComparison: document.getElementById(
    "transform-comparison"
  ) as HTMLButtonElement,
  transformFaq: document.getElementById("transform-faq") as HTMLButtonElement,
  transformActionitems: document.getElementById(
    "transform-actionitems"
  ) as HTMLButtonElement,
  transformExecutivebrief: document.getElementById(
    "transform-executivebrief"
  ) as HTMLButtonElement,
  transformStudyguide: document.getElementById(
    "transform-studyguide"
  ) as HTMLButtonElement,
  transformProscons: document.getElementById(
    "transform-proscons"
  ) as HTMLButtonElement,
  transformCitations: document.getElementById(
    "transform-citations"
  ) as HTMLButtonElement,
  transformOutline: document.getElementById(
    "transform-outline"
  ) as HTMLButtonElement,
  transformHistory: document.getElementById(
    "transform-history"
  ) as HTMLDivElement,

  // Library tab
  notebooksList: document.getElementById("notebooks-list") as HTMLDivElement,

  // Settings tab (permissions only - AI provider configs are in provider-config-ui.ts)
  permTabs: document.getElementById("perm-tabs") as HTMLInputElement,
  permTabGroups: document.getElementById("perm-tab-groups") as HTMLInputElement,
  permBookmarks: document.getElementById("perm-bookmarks") as HTMLInputElement,
  permHistory: document.getElementById("perm-history") as HTMLInputElement,
  clearAllDataBtn: document.getElementById("clear-all-data-btn") as HTMLButtonElement,

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

  // Onboarding elements
  onboardingOverlay: document.getElementById("onboarding-overlay") as HTMLDivElement,
  onboardingIcon: document.getElementById("onboarding-icon") as HTMLDivElement,
  onboardingTitle: document.getElementById("onboarding-title") as HTMLHeadingElement,
  onboardingDescription: document.getElementById("onboarding-description") as HTMLParagraphElement,
  onboardingDots: document.getElementById("onboarding-dots") as HTMLDivElement,
  onboardingSkip: document.getElementById("onboarding-skip") as HTMLButtonElement,
  onboardingNext: document.getElementById("onboarding-next") as HTMLButtonElement,
};

// ============================================================================
// Initialization
// ============================================================================

async function init(): Promise<void> {
  permissions = await checkPermissions();
  currentNotebookId = await getActiveNotebookId();

  // Check for onboarding
  const onboardingComplete = await isOnboardingComplete();
  if (!onboardingComplete) {
    showOnboarding();
  }

  updatePermissionUI();
  // updateSettingsUI() is now handled by provider-config-ui.ts
  setupEventListeners();
  await loadNotebooks();
  await loadAIConfigs();
  await loadSources();
  await loadChatHistory();
  updateTabCount();
  updateAddTabButton();

  // Initialize provider config UI
  await initProviderConfigUI();

  // Listen for AI profile changes to update the AI config select
  window.addEventListener(AI_PROFILES_CHANGED_EVENT, () => {
    loadAIConfigs();
  });

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
      // Clear suggested links cache so new sources trigger a refresh
      if (currentNotebookId) {
        suggestedLinksCache.delete(currentNotebookId);
      }
      loadNotebooks();
      loadSources();
      loadNotebooksList(); // Refresh library page source counts
      showNotification("Source added");
    } else if (message.type === "CREATE_NOTEBOOK_AND_ADD_PAGE") {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove("pendingAction").catch(() => {});
      handleCreateNotebookAndAddPage(message.payload.tabId);
    } else if (message.type === "CREATE_NOTEBOOK_AND_ADD_LINK") {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove("pendingAction").catch(() => {});
      handleCreateNotebookAndAddLink(message.payload.linkUrl);
    } else if (message.type === "CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS") {
      // Clear pending action to prevent duplicate processing
      chrome.storage.session.remove("pendingAction").catch(() => {});
      handleCreateNotebookAndAddSelectionLinks(message.payload.links);
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
      } else if (type === "CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS" && payload.links) {
        handleCreateNotebookAndAddSelectionLinks(payload.links);
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
  await loadNotebooksList();
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
        result.markdown,
        result.links
      );
      await saveSource(source);
      // Clear suggested links cache so new sources trigger a refresh
      suggestedLinksCache.delete(notebook.id);
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
  await loadNotebooksList();
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
        response.content || "",
        response.links
      );
      await saveSource(source);
      // Clear suggested links cache so new sources trigger a refresh
      suggestedLinksCache.delete(notebook.id);
      await loadSources();
      showNotification("Notebook created and source added");
    }
  } catch (error) {
    console.error("Failed to add link:", error);
    showNotification("Notebook created but failed to add link");
  }
}

async function handleCreateNotebookAndAddSelectionLinks(links: string[]): Promise<void> {
  const name = await showNotebookDialog("New Notebook");
  if (!name) return;

  const notebook = createNotebook(name);
  await saveNotebook(notebook);
  currentNotebookId = notebook.id;
  await setActiveNotebookId(notebook.id);
  await loadNotebooks();
  await loadNotebooksList();
  elements.notebookSelect.value = notebook.id;
  notifyNotebooksChanged();

  const linkCount = links.length;
  showNotification(`Creating notebook and extracting ${linkCount} link${linkCount === 1 ? '' : 's'}...`);

  // Extract and add each link
  let addedCount = 0;
  for (const linkUrl of links) {
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
          response.content || "",
          response.links
        );
        await saveSource(source);
        addedCount++;
      }
    } catch (error) {
      console.error(`Failed to add link ${linkUrl}:`, error);
      // Continue with other links even if one fails
    }
  }

  // Clear suggested links cache so new sources trigger a refresh
  suggestedLinksCache.delete(notebook.id);
  await loadSources();
  showNotification(`Notebook created with ${addedCount} source${addedCount === 1 ? '' : 's'}`);
}

function setupEventListeners(): void {
  // Navigation
  elements.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (tab) switchTab(tab);
    });
  });

  // Header buttons
  elements.headerLibraryBtn.addEventListener("click", () =>
    switchTab("library")
  );
  elements.headerSettingsBtn.addEventListener("click", () =>
    switchTab("settings")
  );

  // Add Sources tab
  elements.addCurrentTabBtn.addEventListener("click", handleAddCurrentTab);
  elements.importTabs.addEventListener("click", handleImportTabs);
  elements.importTabGroups.addEventListener("click", handleImportTabGroups);
  elements.importBookmarks.addEventListener("click", handleImportBookmarks);
  elements.importHistory.addEventListener("click", handleImportHistory);

  // Chat tab
  elements.notebookSelect.addEventListener("change", handleNotebookChange);
  elements.aiModelBtn.addEventListener("click", toggleAIModelDropdown);
  elements.newNotebookBtn.addEventListener("click", handleNewNotebook);

  // Close AI model dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!elements.aiModelDropdown.classList.contains("hidden")) {
      const target = e.target as Node;
      if (!elements.aiModelBtn.contains(target) && !elements.aiModelDropdown.contains(target)) {
        closeAIModelDropdown();
      }
    }
  });
  elements.queryBtn.addEventListener("click", handleQuery);
  elements.queryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleQuery();
  });
  elements.addPageBtn.addEventListener("click", handleAddCurrentTab);
  elements.clearChatBtn?.addEventListener("click", handleClearChat);
  elements.chatMessages?.addEventListener("click", handleCitationClick);
  elements.regenerateSummaryBtn?.addEventListener(
    "click",
    handleRegenerateSummary
  );

  // Suggested links
  elements.refreshLinksBtn?.addEventListener("click", handleRefreshSuggestedLinks);
  elements.suggestedLinksList?.addEventListener("click", handleSuggestedLinkClick);

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
  elements.transformSlidedeck?.addEventListener("click", () =>
    handleTransform("slidedeck")
  );
  elements.transformReport?.addEventListener("click", () =>
    handleTransform("report")
  );
  elements.transformDatatable?.addEventListener("click", () =>
    handleTransform("datatable")
  );
  elements.transformMindmap?.addEventListener("click", () =>
    handleTransform("mindmap")
  );
  elements.transformFlashcards?.addEventListener("click", () =>
    handleTransform("flashcards")
  );
  elements.transformTimeline?.addEventListener("click", () =>
    handleTransform("timeline")
  );
  elements.transformGlossary?.addEventListener("click", () =>
    handleTransform("glossary")
  );
  elements.transformComparison?.addEventListener("click", () =>
    handleTransform("comparison")
  );
  elements.transformFaq?.addEventListener("click", () =>
    handleTransform("faq")
  );
  elements.transformActionitems?.addEventListener("click", () =>
    handleTransform("actionitems")
  );
  elements.transformExecutivebrief?.addEventListener("click", () =>
    handleTransform("executivebrief")
  );
  elements.transformStudyguide?.addEventListener("click", () =>
    handleTransform("studyguide")
  );
  elements.transformProscons?.addEventListener("click", () =>
    handleTransform("proscons")
  );
  elements.transformCitations?.addEventListener("click", () =>
    handleTransform("citations")
  );
  elements.transformOutline?.addEventListener("click", () =>
    handleTransform("outline")
  );

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
  elements.clearAllDataBtn.addEventListener("click", handleClearAllData);

  // Old AI settings event listeners - replaced by provider-config-ui.ts
  /*
  elements.aiProvider.addEventListener("change", handleProviderChange);
  elements.aiModel.addEventListener("change", handleModelChange);
  elements.aiModel.addEventListener("focus", () => toggleDropdown(true));
  elements.aiModel.addEventListener("input", () => {
    if (!dropdownOpen) {
      toggleDropdown(true);
    } else {
      populateModelDropdown();
    }
  });
  elements.aiModel.addEventListener("keydown", handleKeyDown);
  elements.modelDropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
    // Focus input so arrow keys work for accessibility
    elements.aiModel.focus();
  });
  // Prevent clicks inside dropdown from closing it (set up once during initialization)
  elements.modelDropdownMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  elements.apiKey.addEventListener("change", handleApiKeyChange);
  elements.testApiBtn.addEventListener("click", handleTestApi);
  elements.aiTemperature.addEventListener("input", handleTemperatureChange);
  elements.aiMaxTokens.addEventListener("change", handleMaxTokensChange);
  elements.aiBaseUrl.addEventListener("change", handleBaseUrlChange);
  */

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

// Current selected model config ID for the dropdown
let currentSelectedModelConfigId: string | undefined = undefined;

/**
 * Create a checkmark SVG element
 */
function createCheckmarkSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.classList.add("ai-model-item-check", "hidden");

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", "20 6 9 17 4 12");
  svg.appendChild(polyline);

  return svg;
}

/**
 * Load AI model configs into the dropdown
 */
async function loadAIConfigs(): Promise<void> {
  const modelConfigs = await getModelConfigs();
  const defaultConfig = await getDefaultModelConfig();

  // Clear existing items
  while (elements.aiModelList.firstChild) {
    elements.aiModelList.removeChild(elements.aiModelList.firstChild);
  }

  // Add "Default" option which uses the default model config
  const defaultItem = createModelItem(
    "",
    defaultConfig ? `Default (${defaultConfig.name})` : 'Default',
    true
  );
  elements.aiModelList.appendChild(defaultItem);

  // Add all model configs
  for (const config of modelConfigs) {
    const item = createModelItem(config.id, config.name, false);
    elements.aiModelList.appendChild(item);
  }

  // Update selection based on current notebook
  await updateAIConfigForNotebook();
}

/**
 * Create a model item element for the dropdown
 */
function createModelItem(id: string, name: string, isDefault: boolean): HTMLElement {
  const item = document.createElement("div");
  item.className = "ai-model-item";
  item.dataset.modelId = id;

  const checkmark = createCheckmarkSvg();

  const content = document.createElement("div");
  content.className = "ai-model-item-content";

  const nameEl = document.createElement("div");
  nameEl.className = "ai-model-item-name";
  nameEl.textContent = name;
  content.appendChild(nameEl);

  if (isDefault) {
    const defaultLabel = document.createElement("div");
    defaultLabel.className = "ai-model-item-default";
    defaultLabel.textContent = "Uses your default AI profile";
    content.appendChild(defaultLabel);
  }

  item.appendChild(checkmark);
  item.appendChild(content);

  item.addEventListener("click", () => handleModelItemClick(id));

  return item;
}

/**
 * Toggle the AI model dropdown visibility
 */
function toggleAIModelDropdown(): void {
  const isHidden = elements.aiModelDropdown.classList.contains("hidden");
  if (isHidden) {
    elements.aiModelDropdown.classList.remove("hidden");
    elements.aiModelBtn.classList.add("active");
  } else {
    closeAIModelDropdown();
  }
}

/**
 * Close the AI model dropdown
 */
function closeAIModelDropdown(): void {
  elements.aiModelDropdown.classList.add("hidden");
  elements.aiModelBtn.classList.remove("active");
}

/**
 * Handle clicking on a model item in the dropdown
 */
async function handleModelItemClick(modelId: string): Promise<void> {
  if (!currentNotebookId) {
    closeAIModelDropdown();
    return;
  }

  // Update storage
  const notebook = await getNotebook(currentNotebookId);
  if (notebook) {
    notebook.modelConfigId = modelId || undefined;
    await saveNotebook(notebook);
  }

  // Update UI
  currentSelectedModelConfigId = modelId || undefined;
  updateModelDropdownSelection();
  closeAIModelDropdown();
}

/**
 * Update the visual selection state in the dropdown
 */
function updateModelDropdownSelection(): void {
  const items = elements.aiModelList.querySelectorAll(".ai-model-item");
  items.forEach((item) => {
    const el = item as HTMLElement;
    const modelId = el.dataset.modelId || "";
    const isSelected = modelId === (currentSelectedModelConfigId || "");

    el.classList.toggle("selected", isSelected);
    const checkmark = el.querySelector(".ai-model-item-check");
    if (checkmark) {
      checkmark.classList.toggle("hidden", !isSelected);
    }
  });
}

/**
 * Update the AI config based on the current notebook's setting
 */
async function updateAIConfigForNotebook(): Promise<void> {
  if (!currentNotebookId) {
    currentSelectedModelConfigId = undefined;
    updateModelDropdownSelection();
    return;
  }

  const notebook = await getNotebook(currentNotebookId);
  currentSelectedModelConfigId = notebook?.modelConfigId || undefined;
  updateModelDropdownSelection();
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

    // Build notebook item using DOM methods for security
    const iconDiv = document.createElement("div");
    iconDiv.className = "notebook-icon";
    iconDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>`;

    const infoDiv = document.createElement("div");
    infoDiv.className = "notebook-info";
    const nameDiv = document.createElement("div");
    nameDiv.className = "notebook-name";
    nameDiv.textContent = notebook.name;
    const metaDiv = document.createElement("div");
    metaDiv.className = "notebook-meta";
    metaDiv.textContent = `${sources.length} sources`;
    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(metaDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "notebook-actions";

    const exportBtn = document.createElement("button");
    exportBtn.className = "icon-btn btn-export-notebook";
    exportBtn.dataset.id = notebook.id;
    exportBtn.title = "Export notebook";
    exportBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn btn-delete-notebook";
    deleteBtn.dataset.id = notebook.id;
    deleteBtn.title = "Delete notebook";
    deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>`;

    actionsDiv.appendChild(exportBtn);
    actionsDiv.appendChild(deleteBtn);

    div.appendChild(iconDiv);
    div.appendChild(infoDiv);
    div.appendChild(actionsDiv);

    infoDiv.addEventListener("click", () => selectNotebook(notebook.id));

    exportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleExportNotebook(notebook.id);
    });

    deleteBtn.addEventListener("click", (e) => {
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

async function handleExportNotebook(id: string): Promise<void> {
  try {
    const notebook = await getNotebook(id);
    if (!notebook) {
      showNotification("Notebook not found");
      return;
    }

    const sources = await getSourcesByNotebook(id);
    const chatHistory = await getChatHistory(id);
    const transformations = await getTransformations(id);

    const exportData: NotebookExport = {
      notebook,
      sources,
      chatHistory,
      transformations,
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
    };

    // Show format selection dialog
    const format = await showExportFormatDialog();
    if (!format) return;

    exportNotebook(exportData, format);
    showNotification(`Exported as ${format.toUpperCase()}`);
  } catch (error) {
    console.error("Export failed:", error);
    showNotification("Export failed");
  }
}

async function showExportFormatDialog(): Promise<ExportFormat | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog";
    dialog.innerHTML = `
      <h3>Export Format</h3>
      <p>Choose the format for your export:</p>
      <div class="dialog-actions" style="flex-direction: column; gap: 8px;">
        <button class="btn btn-primary btn-export-md" style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Markdown (.md)
        </button>
        <button class="btn btn-outline btn-export-json" style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          JSON (.json)
        </button>
        <button class="btn btn-outline btn-export-cancel" style="width: 100%;">Cancel</button>
      </div>
    `;

    const mdBtn = dialog.querySelector(".btn-export-md");
    const jsonBtn = dialog.querySelector(".btn-export-json");
    const cancelBtn = dialog.querySelector(".btn-export-cancel");

    mdBtn?.addEventListener("click", () => {
      dialog.close();
      dialog.remove();
      resolve("markdown");
    });

    jsonBtn?.addEventListener("click", () => {
      dialog.close();
      dialog.remove();
      resolve("json");
    });

    cancelBtn?.addEventListener("click", () => {
      dialog.close();
      dialog.remove();
      resolve(null);
    });

    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(null);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

async function handleNewNotebook(): Promise<void> {
  const name = await showNotebookDialog("New Notebook");
  if (!name) return;

  const notebook = createNotebook(name);
  await saveNotebook(notebook);
  currentNotebookId = notebook.id;
  await setActiveNotebookId(notebook.id);
  await loadNotebooks();
  await loadNotebooksList();
  elements.notebookSelect.value = notebook.id;
  notifyNotebooksChanged();
  showNotification("Notebook created");
}

async function handleNotebookChange(): Promise<void> {
  const id = elements.notebookSelect.value;
  currentNotebookId = id || null;
  await setActiveNotebookId(currentNotebookId);
  await updateAIConfigForNotebook();
  await loadSources();
  await loadChatHistory();
}

async function selectNotebook(id: string): Promise<void> {
  currentNotebookId = id;
  await setActiveNotebookId(id);
  await loadNotebooks();
  elements.notebookSelect.value = id;
  await updateAIConfigForNotebook();
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
    hideSummary();
    hideSuggestedLinksSection();
    return;
  }

  const sources = await getSourcesByNotebook(currentNotebookId);
  elements.sourceCount.textContent = sources.length.toString();

  // Render in Chat tab (compact)
  renderSourcesList(elements.activeSources, sources);

  // Render in Add tab (recent sources)
  renderSourcesList(elements.sourcesList, sources.slice(0, 5));

  // Load or generate summary
  await loadOrGenerateSummary(sources);

  // Load suggested links (don't await - let it load in background)
  loadSuggestedLinks(sources).catch((err) =>
    console.warn("[SuggestedLinks] Failed to load:", err)
  );
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
      <div class="source-icon">${DOMPurify.sanitize(initial)}</div>
      <div class="source-info">
        <div class="source-title">
          <span class="source-title-text">${DOMPurify.sanitize(source.title)}</span>
          <a href="${DOMPurify.sanitize(source.url)}" target="_blank" rel="noopener noreferrer" class="source-external" title="Open in new tab">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
        <div class="source-url">${DOMPurify.sanitize(domain)}</div>
      </div>
      <div class="source-actions">
        <button class="icon-btn btn-remove" data-id="${DOMPurify.sanitize(
          source.id
        )}" title="Remove">
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

// ============================================================================
// Summary
// ============================================================================

function hideSummary(): void {
  elements.summarySection.style.display = "none";
}

function showSummary(): void {
  elements.summarySection.style.display = "block";
  elements.summarySection.open = true;
}

function showSummaryLoading(): void {
  showSummary();
  elements.notebookSummary.innerHTML = `
    <div class="summary-loading">
      <span class="loading-spinner"></span>
      <span>Generating summary...</span>
    </div>
  `;
}

function showSummaryError(message: string): void {
  showSummary();
  elements.notebookSummary.innerHTML = `
    <div class="summary-error">${escapeHtml(message)}</div>
  `;
}

function showSummaryContent(content: string): void {
  showSummary();
  // Render markdown content
  const rendered = renderMarkdown(content);
  elements.notebookSummary.innerHTML = rendered;
}

function sourceIdsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

async function loadOrGenerateSummary(sources: Source[]): Promise<void> {
  if (!currentNotebookId) {
    hideSummary();
    return;
  }

  // Hide summary if no sources
  if (sources.length === 0) {
    hideSummary();
    return;
  }

  const sourceIds = sources.map((s) => s.id);

  // Check if we have a cached summary with matching source IDs
  const cachedSummary = await getSummary(currentNotebookId);

  if (cachedSummary && sourceIdsMatch(cachedSummary.sourceIds, sourceIds)) {
    // Use cached summary
    showSummaryContent(cachedSummary.content);
    return;
  }

  // Need to generate a new summary
  await generateAndSaveSummary(sources, sourceIds);
}

async function generateAndSaveSummary(
  sources: Source[],
  sourceIds: string[]
): Promise<void> {
  if (!currentNotebookId) return;

  showSummaryLoading();

  try {
    const content = await generateSummary(sources);

    // Save the summary
    const summary = createSummary(currentNotebookId, sourceIds, content);
    await saveSummary(summary);

    // Display it
    showSummaryContent(content);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate summary";
    showSummaryError(message);
  }
}

async function handleRegenerateSummary(): Promise<void> {
  if (!currentNotebookId) return;

  const sources = await getSourcesByNotebook(currentNotebookId);
  if (sources.length === 0) {
    hideSummary();
    return;
  }

  const sourceIds = sources.map((s) => s.id);
  await generateAndSaveSummary(sources, sourceIds);
}

// ============================================================================
// Suggested Links
// ============================================================================

/**
 * Show the suggested links section
 */
function showSuggestedLinksSection(): void {
  elements.suggestedLinksSection.style.display = "block";
}

/**
 * Hide the suggested links section
 */
function hideSuggestedLinksSection(): void {
  elements.suggestedLinksSection.style.display = "none";
}

/**
 * Show loading state in suggested links
 */
function showSuggestedLinksLoading(): void {
  const loading = elements.suggestedLinksContent.querySelector(".suggested-links-loading") as HTMLElement;
  const empty = elements.suggestedLinksContent.querySelector(".suggested-links-empty") as HTMLElement;
  if (loading) loading.style.display = "flex";
  if (empty) empty.style.display = "none";
  elements.suggestedLinksList.innerHTML = "";
}

/**
 * Hide loading state in suggested links
 */
function hideSuggestedLinksLoading(): void {
  const loading = elements.suggestedLinksContent.querySelector(".suggested-links-loading") as HTMLElement;
  if (loading) loading.style.display = "none";
}

/**
 * Show empty state in suggested links
 */
function showSuggestedLinksEmpty(): void {
  const empty = elements.suggestedLinksContent.querySelector(".suggested-links-empty") as HTMLElement;
  if (empty) empty.style.display = "block";
  elements.suggestedLinksList.innerHTML = "";
}

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Render suggested links in the UI
 * Note: All dynamic content is sanitized with DOMPurify to prevent XSS
 */
function renderSuggestedLinks(links: SuggestedLink[]): void {
  hideSuggestedLinksLoading();

  if (links.length === 0) {
    showSuggestedLinksEmpty();
    elements.suggestedLinksCount.textContent = "0";
    return;
  }

  const empty = elements.suggestedLinksContent.querySelector(".suggested-links-empty") as HTMLElement;
  if (empty) empty.style.display = "none";

  elements.suggestedLinksCount.textContent = String(links.length);

  // Build HTML with all dynamic content sanitized via DOMPurify
  elements.suggestedLinksList.innerHTML = links
    .map((link) => {
      const domain = extractDomain(link.url);
      const scorePercent = Math.round(link.relevanceScore * 100);
      return `
        <div class="suggested-link-item" data-url="${DOMPurify.sanitize(link.url)}">
          <div class="suggested-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <div class="suggested-link-info">
            <div class="suggested-link-title">
              <span class="suggested-link-title-text">${DOMPurify.sanitize(link.title)}</span>
            </div>
            <div class="suggested-link-description">${DOMPurify.sanitize(link.description)}</div>
            <div class="suggested-link-url">${DOMPurify.sanitize(domain)}</div>
          </div>
          <div class="suggested-link-actions">
            <button class="icon-btn suggested-link-open" title="Open link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button class="icon-btn btn-primary suggested-link-add" title="Add as source">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div class="suggested-link-score">${scorePercent}%</div>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * Load and display suggested links for the current notebook
 */
async function loadSuggestedLinks(sources: Source[], forceRefresh = false): Promise<void> {
  if (!currentNotebookId) return;

  // Check if sources have any links
  if (!hasExtractableLinks(sources)) {
    hideSuggestedLinksSection();
    return;
  }

  // Show the section
  showSuggestedLinksSection();

  // Check cache first (unless forcing refresh)
  const cacheKey = currentNotebookId;

  if (!forceRefresh && suggestedLinksCache.has(cacheKey)) {
    const cached = suggestedLinksCache.get(cacheKey);
    if (cached) {
      renderSuggestedLinks(cached);
      return;
    }
  }

  // Don't fetch if already loading
  if (suggestedLinksLoading) return;

  suggestedLinksLoading = true;
  showSuggestedLinksLoading();

  try {
    const links = await filterLinksWithAI(sources, 10);
    suggestedLinksCache.set(cacheKey, links);
    renderSuggestedLinks(links);
  } catch (error) {
    console.error("[SuggestedLinks] Failed to load:", error);
    showSuggestedLinksEmpty();
  } finally {
    suggestedLinksLoading = false;
  }
}

/**
 * Handle refresh button click
 */
async function handleRefreshSuggestedLinks(): Promise<void> {
  if (!currentNotebookId) return;

  const sources = await getSourcesByNotebook(currentNotebookId);
  if (sources.length === 0) {
    hideSuggestedLinksSection();
    return;
  }

  // Clear cache and reload
  suggestedLinksCache.delete(currentNotebookId);
  await loadSuggestedLinks(sources, true);
}

/**
 * Handle clicks on suggested link items
 */
async function handleSuggestedLinkClick(event: Event): Promise<void> {
  const target = event.target as HTMLElement;
  const linkItem = target.closest(".suggested-link-item") as HTMLElement;
  if (!linkItem) return;

  const url = linkItem.dataset.url;
  if (!url) return;

  // Check if open button was clicked
  if (target.closest(".suggested-link-open")) {
    window.open(url, "_blank");
    return;
  }

  // Check if add button was clicked
  if (target.closest(".suggested-link-add")) {
    await handleAddSuggestedLink(url, linkItem);
    return;
  }
}

/**
 * Add a suggested link as a new source
 */
async function handleAddSuggestedLink(url: string, linkItem: HTMLElement): Promise<void> {
  if (!currentNotebookId) return;

  // Disable the add button
  const addBtn = linkItem.querySelector(".suggested-link-add") as HTMLButtonElement;
  if (addBtn) addBtn.disabled = true;

  // Show loading state
  linkItem.style.opacity = "0.5";

  try {
    // Request content extraction from background script
    const response = await chrome.runtime.sendMessage({
      type: "EXTRACT_FROM_URL",
      payload: { url, notebookId: currentNotebookId },
    });

    if (response && response.success) {
      // Remove the item from the list since it's now a source
      linkItem.remove();

      // Update count
      const remaining = elements.suggestedLinksList.querySelectorAll(".suggested-link-item").length;
      elements.suggestedLinksCount.textContent = String(remaining);

      // Update cache
      const cached = suggestedLinksCache.get(currentNotebookId);
      if (cached) {
        suggestedLinksCache.set(
          currentNotebookId,
          cached.filter((link) => link.url !== url)
        );
      }

      // Show empty state if no more links
      if (remaining === 0) {
        showSuggestedLinksEmpty();
      }
    } else {
      // Failed to add - restore state
      linkItem.style.opacity = "1";
      if (addBtn) addBtn.disabled = false;
    }
  } catch (error) {
    console.error("[SuggestedLinks] Failed to add link:", error);
    linkItem.style.opacity = "1";
    if (addBtn) addBtn.disabled = false;
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

  // After the guard, currentNotebookId is guaranteed to be set
  const notebookId = currentNotebookId;
  if (!notebookId) return;

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
              notebookId,
              "tab",
              result.url || tab.url,
              result.title || tab.title || "Untitled",
              result.markdown || "",
              result.links
            );
            await saveSource(source);
            addedCount++;
          }
        } catch (error) {
          console.error(`Failed to add tab ${tab.url}:`, error);
          // Fallback: add with just title/url if content script not available
          const source = createSource(
            notebookId,
            "tab",
            tab.url,
            tab.title || "Untitled",
            `Content from: ${tab.url}`
          );
          await saveSource(source);
          addedCount++;
        }
      }

      // Clear suggested links cache so new sources trigger a refresh
      suggestedLinksCache.delete(notebookId);
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
          notebookId,
          "tab",
          response.url,
          response.title,
          response.content,
          response.links
        );
        await saveSource(source);
        // Clear suggested links cache so new sources trigger a refresh
        suggestedLinksCache.delete(notebookId);
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
              ? `<img src="${escapeHtml(item.favicon)}" alt="">`
              : initial
          }
        </div>
        <div class="picker-info">
          <div class="picker-title">${escapeHtml(item.title)}</div>
          <div class="picker-url">${escapeHtml(domain)}</div>
        </div>
      `;

      // Attach error handler safely (no inline JS)
      if (item.favicon) {
        const img = div.querySelector(".picker-icon img") as HTMLImageElement;
        if (img) {
          img.addEventListener("error", () => {
            img.style.display = "none";
            if (img.parentNode) {
              img.parentNode.textContent = initial;
            }
          });
        }
      }
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
  elements.pickerSelectedCount.textContent = `${count} selected`;
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

  // After the guard, currentNotebookId is guaranteed to be set
  const notebookId = currentNotebookId;
  if (!notebookId) return;

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
                notebookId,
                "tab",
                result.url || tab.url,
                result.title || tab.title || "Untitled",
                result.markdown || "",
                result.links
              );
              await saveSource(source);
              addedCount++;
            }
          } catch (error) {
            console.error(`Failed to extract from tab ${tab.url}:`, error);
            // Fallback: add with just title/url
            const source = createSource(
              notebookId,
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
            notebookId,
            pickerType || "tab",
            response.url || item.url,
            response.title || item.title,
            response.content || "",
            response.links
          );
          await saveSource(source);
          addedCount++;
        }
      } catch (error) {
        console.error(`Failed to add ${item.url}:`, error);
        // If extraction fails, add with just the title/url
        const source = createSource(
          notebookId,
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
  // Clear suggested links cache so new sources trigger a refresh
  suggestedLinksCache.delete(notebookId);
  await loadSources();

  if (addedCount > 0) {
    showNotification(`Added ${addedCount} source${addedCount > 1 ? "s" : ""}`);
  }

  elements.pickerAdd.disabled = false;
  elements.pickerAdd.textContent = "Add Selected";
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
      const group = groupedMap.get(citation.sourceId);
      if (group) {
        // Only add unique excerpts
        if (!group.excerpts.includes(citation.excerpt)) {
          group.excerpts.push(citation.excerpt);
        }
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
    <div class="chat-citations-title">Sources cited (${grouped.length} source${
    grouped.length !== 1 ? "s" : ""
  })</div>
    ${grouped
      .map((group, sourceIndex) => {
        const sourceNumber = sourceIndex + 1;

        if (group.excerpts.length === 1) {
          // Single excerpt - show simple format
          return `
          <div class="citation-item" data-source-id="${
            group.sourceId
          }" data-source-url="${escapeHtml(
            group.sourceUrl
          )}" data-excerpt="${escapeHtml(group.excerpts[0])}">
            <div class="citation-number">${sourceNumber}</div>
            <div class="citation-content">
              <div class="citation-source">${escapeHtml(
                group.sourceTitle
              )}</div>
              <div class="citation-excerpt">${escapeHtml(
                group.excerpts[0]
              )}</div>
            </div>
          </div>
        `;
        } else {
          // Multiple excerpts - show grouped format with sub-labels
          return `
          <div class="citation-group">
            <div class="citation-group-header">
              <div class="citation-number">${sourceNumber}</div>
              <div class="citation-source">${escapeHtml(
                group.sourceTitle
              )}</div>
              <div class="citation-excerpt-count">${
                group.excerpts.length
              } references</div>
            </div>
            <div class="citation-group-excerpts">
              ${group.excerpts
                .map((excerpt, excerptIndex) => {
                  const subLabel = String.fromCharCode(97 + excerptIndex); // a, b, c, ...
                  return `
                <div class="citation-item citation-sub-item" data-source-id="${
                  group.sourceId
                }" data-source-url="${escapeHtml(
                    group.sourceUrl
                  )}" data-excerpt="${escapeHtml(excerpt)}">
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
  elements.chatStatus.textContent = "Preparing...";

  // Save user message
  const userMessage = createChatMessage(currentNotebookId, "user", query);
  await saveChatMessage(userMessage);
  appendChatMessage(userMessage, sources);

  // Get conversation history (includes the message we just saved)
  const history = await getChatHistory(currentNotebookId);

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
    const stream = streamChat(sources, query, history, {
      onStatus: (status) => {
        elements.chatStatus.textContent = status;
      }
    });
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
    const userFriendlyError = formatErrorForUser(error);

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
      // Show error in the message with user-friendly formatting
      assistantMessage.content = `Failed to generate response: ${userFriendlyError}`;
      await saveChatMessage(assistantMessage);

      const contentEl = messageDiv.querySelector(".chat-message-content");
      if (contentEl) {
        contentEl.innerHTML = `<p class="error">${escapeHtml(
          assistantMessage.content
        )}</p>`;
      }
      elements.chatStatus.textContent = userFriendlyError;
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

type TransformType =
  | "podcast"
  | "quiz"
  | "takeaways"
  | "email"
  | "slidedeck"
  | "report"
  | "datatable"
  | "mindmap"
  | "flashcards"
  | "timeline"
  | "glossary"
  | "comparison"
  | "faq"
  | "actionitems"
  | "executivebrief"
  | "studyguide"
  | "proscons"
  | "citations"
  | "outline";

// Track sandboxes for proper cleanup when cards are removed
const cardSandboxes = new WeakMap<HTMLElement, SandboxRenderer>();
const MAX_TRANSFORM_HISTORY = 10;

// Helper to create a transform result card element
function createTransformResultCard(title: string): {
  card: HTMLDivElement;
  sandbox: SandboxRenderer;
} {
  const card = document.createElement("div");
  card.className = "transform-result";

  const header = document.createElement("div");
  header.className = "transform-result-header";

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;

  const actions = document.createElement("div");
  actions.className = "transform-result-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "icon-btn";
  copyBtn.title = "Copy";
  copyBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;

  const closeBtn = document.createElement("button");
  closeBtn.className = "icon-btn";
  closeBtn.title = "Remove";
  closeBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);

  header.appendChild(titleEl);
  header.appendChild(actions);

  const contentContainer = document.createElement("div");
  contentContainer.className = "transform-content";

  card.appendChild(header);
  card.appendChild(contentContainer);

  // Create sandbox renderer for this card
  const sandbox = new SandboxRenderer(contentContainer);
  cardSandboxes.set(card, sandbox);

  // Wire up copy button
  copyBtn.addEventListener("click", () => {
    copyToClipboard(contentContainer.textContent || "");
  });

  // Wire up close button to remove this card
  closeBtn.addEventListener("click", () => {
    removeTransformCard(card);
  });

  return { card, sandbox };
}

// Helper to properly remove a transform card and clean up its sandbox
function removeTransformCard(card: HTMLElement): void {
  const sandbox = cardSandboxes.get(card);
  if (sandbox) {
    sandbox.destroy();
    cardSandboxes.delete(card);
  }
  card.remove();
}

// Enforce the max history limit by removing oldest cards
function enforceTransformHistoryLimit(): void {
  const cards = elements.transformHistory.children;
  while (cards.length > MAX_TRANSFORM_HISTORY) {
    const oldestCard = cards[cards.length - 1] as HTMLElement;
    removeTransformCard(oldestCard);
  }
}

async function handleTransform(type: TransformType): Promise<void> {
  if (!currentNotebookId) {
    showNotification("Please select a notebook first");
    return;
  }

  const sources = await getSourcesByNotebook(currentNotebookId);
  if (sources.length === 0) {
    showNotification("Add some sources first");
    return;
  }

  const titles: Record<TransformType, string> = {
    podcast: "Podcast Script",
    quiz: "Study Quiz",
    takeaways: "Key Takeaways",
    email: "Email Summary",
    slidedeck: "Slide Deck",
    report: "Report",
    datatable: "Data Table",
    mindmap: "Mind Map",
    flashcards: "Flashcards",
    timeline: "Timeline",
    glossary: "Glossary",
    comparison: "Comparison Chart",
    faq: "FAQ",
    actionitems: "Action Items",
    executivebrief: "Executive Brief",
    studyguide: "Study Guide",
    proscons: "Pros & Cons",
    citations: "Citation List",
    outline: "Outline",
  };

  // Create a new result card and prepend it to the history container
  const { card, sandbox } = createTransformResultCard(titles[type]);
  elements.transformHistory.prepend(card);

  // Enforce the history limit (remove oldest cards if over limit)
  enforceTransformHistoryLimit();

  // Scroll to the new card
  card.scrollIntoView({ behavior: "smooth", block: "start" });

  // Show loading state
  await sandbox.render("<em>Generating...</em>");

  // Disable all transform buttons during generation
  const buttons = [
    elements.transformPodcast,
    elements.transformQuiz,
    elements.transformTakeaways,
    elements.transformEmail,
    elements.transformSlidedeck,
    elements.transformReport,
    elements.transformDatatable,
    elements.transformMindmap,
    elements.transformFlashcards,
    elements.transformTimeline,
    elements.transformGlossary,
    elements.transformComparison,
    elements.transformFaq,
    elements.transformActionitems,
    elements.transformExecutivebrief,
    elements.transformStudyguide,
    elements.transformProscons,
    elements.transformCitations,
    elements.transformOutline,
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
      case "slidedeck":
        result = await generateSlideDeck(sources);
        break;
      case "report":
        result = await generateReport(sources);
        break;
      case "datatable":
        result = await generateDataTable(sources);
        break;
      case "mindmap":
        result = await generateMindMap(sources);
        break;
      case "flashcards":
        result = await generateFlashcards(sources, 10);
        break;
      case "timeline":
        result = await generateTimeline(sources);
        break;
      case "glossary":
        result = await generateGlossary(sources);
        break;
      case "comparison":
        result = await generateComparison(sources);
        break;
      case "faq":
        result = await generateFAQ(sources, 10);
        break;
      case "actionitems":
        result = await generateActionItems(sources);
        break;
      case "executivebrief":
        result = await generateExecutiveBrief(sources);
        break;
      case "studyguide":
        result = await generateStudyGuide(sources);
        break;
      case "proscons":
        result = await generateProsCons(sources);
        break;
      case "citations":
        result = await generateCitationList(sources);
        break;
      case "outline":
        result = await generateOutline(sources);
        break;
    }

    // Determine if this is an interactive transform that returns HTML
    const interactiveTypes: TransformType[] = [
      "quiz",
      "flashcards",
      "timeline",
      "slidedeck",
      "mindmap",
      "studyguide",
    ];

    // Render AI-generated content in sandbox for defense-in-depth
    if (interactiveTypes.includes(type) && isHtmlContent(result)) {
      // Interactive HTML content (quiz, flashcards, etc.)
      await sandbox.renderInteractive(result);
    } else {
      // Standard markdown content - render with proper markdown parser
      await sandbox.render(renderMarkdown(result));
    }
  } catch (error) {
    console.error("Transform failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorHtml = `
      <p class="error">Failed to generate: ${escapeHtml(errorMessage)}</p>
      <p>Please check your API key in Settings.</p>
    `;
    await sandbox.render(errorHtml);
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

// Old settings UI - replaced by provider-config-ui.ts
/*
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

  if (aiSettings.baseURL) {
    elements.aiBaseUrl.value = aiSettings.baseURL;
  } else {
    elements.aiBaseUrl.value = "";
  }
}
*/

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

/**
 * Handle clearing all data (notebooks, sources, chat history, AI profiles)
 */
async function handleClearAllData(): Promise<void> {
  const confirmed = await showConfirmDialog(
    "Clear All Data",
    "This will permanently delete all notebooks, sources, chat history, and AI profiles. This action cannot be undone."
  );

  if (!confirmed) return;

  try {
    // Clear all IndexedDB data
    await clearAllData();

    // Clear chrome.storage.local model cache (provider model lists)
    await chrome.storage.local.clear();

    // Reload the sidepanel to refresh UI
    location.reload();
  } catch (error) {
    console.error("Failed to clear all data:", error);
    showNotification("Failed to clear all data. Please try again.");
  }
}

// ============================================================================
// Model Dropdown
// ============================================================================

// Old model dropdown - replaced by provider-config-ui.ts
/*
let dropdownOpen = false;
let highlightedIndex = -1;

function setHighlightedIndex(index: number, items: HTMLElement[]): void {
  // Remove previous highlight
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].classList.remove("highlighted");
  }

  highlightedIndex = index;

  // Add new highlight
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].classList.add("highlighted");
    items[highlightedIndex].scrollIntoView({ block: "nearest" });
  }
}

function getDropdownItems(): HTMLElement[] {
  return Array.from(
    elements.modelDropdownMenu.querySelectorAll(".dropdown-item")
  ) as HTMLElement[];
}

function handleKeyDown(e: KeyboardEvent): void {
  let items = getDropdownItems();

  if (items.length === 0 && e.key !== "ArrowDown" && e.key !== "ArrowUp")
    return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!dropdownOpen) {
        toggleDropdown(true);
        // Re-query items after dropdown is opened and populated
        items = getDropdownItems();
        setHighlightedIndex(0, items);
      } else {
        const newIndex =
          highlightedIndex < items.length - 1 ? highlightedIndex + 1 : 0;
        setHighlightedIndex(newIndex, items);
      }
      break;

    case "ArrowUp":
      e.preventDefault();
      if (!dropdownOpen) {
        toggleDropdown(true);
        // Re-query items after dropdown is opened and populated
        items = getDropdownItems();
        setHighlightedIndex(items.length - 1, items);
      } else {
        const newIndex =
          highlightedIndex > 0 ? highlightedIndex - 1 : items.length - 1;
        setHighlightedIndex(newIndex, items);
      }
      break;

    case "Enter":
      e.preventDefault();

      // If something is highlighted, select it
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        const selectedItem = items[highlightedIndex];
        const modelValue = selectedItem.querySelector(".model-id")?.textContent;
        if (modelValue) {
          elements.aiModel.value = modelValue;
          handleModelChange();
          toggleDropdown(false);
        }
        return;
      }

      // If dropdown is open, check if first item is a match before auto-selecting
      if (dropdownOpen && items.length > 0) {
        const firstItem = items[0];
        const firstScore = firstItem.dataset.score
          ? parseInt(firstItem.dataset.score, 10)
          : -1;

        // Only auto-select if it's an actual match (score >= 0)
        if (firstScore >= 0) {
          const modelValue = firstItem.querySelector(".model-id")?.textContent;
          if (modelValue) {
            elements.aiModel.value = modelValue;
            handleModelChange();
            toggleDropdown(false);
          }
        } else {
          // No matches - just close dropdown and keep custom value
          toggleDropdown(false);
        }
      }
      break;

    case "Escape":
      e.preventDefault();
      toggleDropdown(false);
      break;
  }
}

function toggleDropdown(show?: boolean): void {
  dropdownOpen = show !== undefined ? show : !dropdownOpen;
  elements.modelDropdownMenu.hidden = !dropdownOpen;
  elements.aiModel.setAttribute("aria-expanded", dropdownOpen.toString());

  if (dropdownOpen) {
    populateModelDropdown();
    setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 0);
  } else {
    highlightedIndex = -1;
    document.removeEventListener("click", handleOutsideClick);
  }
}

function handleOutsideClick(e: MouseEvent): void {
  if (!elements.modelDropdown.contains(e.target as Node)) {
    toggleDropdown(false);
  }
}

// Simple fuzzy match scoring function
function fuzzyMatchScore(text: string, query: string): number {
  if (!query) return 0;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match at start - highest priority
  if (lowerText.startsWith(lowerQuery)) {
    return 100;
  }

  // Exact match anywhere
  if (lowerText.includes(lowerQuery)) {
    return 50;
  }

  // Character sequence match
  let queryIndex = 0;
  let score = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }

  // If we matched all characters in order
  if (queryIndex === lowerQuery.length) {
    return Math.min(score, 49);
  }

  return -1; // No match
}

function populateModelDropdown(): void {
  const provider = elements.aiProvider.value as AISettings["provider"];
  const query = elements.aiModel.value.trim();

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
    "openai-compatible": [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      { value: "claude-sonnet-4-5-20250514", label: "Claude 4.5 Sonnet (via OpenRouter)" },
      { value: "claude-opus-4-5-20251101", label: "Claude 4.5 Opus (via OpenRouter)" },
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

  // Score and sort models based on fuzzy match
  const scoredModels = models.map((model) => {
    const labelScore = fuzzyMatchScore(model.label, query);
    const valueScore = fuzzyMatchScore(model.value, query);
    const score = Math.max(labelScore, valueScore);
    return { model, score };
  });

  // Sort by score (highest first), with no matches at the end
  scoredModels.sort((a, b) => {
    if (a.score === -1 && b.score === -1) return 0;
    if (a.score === -1) return 1;
    if (b.score === -1) return -1;
    return b.score - a.score;
  });

  elements.modelDropdownMenu.innerHTML = "";

  // Reset highlight when repopulating due to typing
  highlightedIndex = -1;

  for (const { model, score } of scoredModels) {
    const item = document.createElement("div");
    item.className = "dropdown-item";

    // Store score for keyboard navigation
    item.dataset.score = score.toString();

    // Dim unmatched items slightly
    if (score === -1 && query) {
      item.style.opacity = "0.5";
    }

    if (model.value === elements.aiModel.value) {
      item.classList.add("selected");
    }

    // Add ARIA role for accessibility
    item.setAttribute("role", "option");

    // Create label and ID spans with textContent to prevent XSS
    const labelSpan = document.createElement("span");
    labelSpan.className = "model-label";
    labelSpan.textContent = model.label;

    const idSpan = document.createElement("span");
    idSpan.className = "model-id";
    idSpan.textContent = model.value;

    item.appendChild(labelSpan);
    item.appendChild(idSpan);

    item.addEventListener("click", () => {
      elements.aiModel.value = model.value;
      handleModelChange();
      toggleDropdown(false);
    });

    elements.modelDropdownMenu.appendChild(item);
  }
}
*/

// ============================================================================
// Settings
// ============================================================================

// Old AI settings handlers - replaced by provider-config-ui.ts
/*
async function handleProviderChange(): Promise<void> {
  const provider = elements.aiProvider.value as AISettings["provider"];

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
    "openai-compatible": {
      url: "https://openrouter.ai/keys",
      text: "Get an API key (e.g., OpenRouter)",
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

  // Load saved API key for this provider
  if (aiSettings) {
    const savedKey = aiSettings.apiKeys[provider] || "";
    elements.apiKey.value = savedKey;
  }

  // Set model to the last model in the list for this provider
  const modelOptions: Record<string, string> = {
    anthropic: "claude-haiku-4-5-20250514",
    openai: "gpt-5.1-instant",
    google: "gemini-3-flash-preview",
    chrome: "built-in",
  };
  const defaultModel = modelOptions[provider] || "";
  elements.aiModel.value = defaultModel;

  await setProvider(provider);
  await setModel(defaultModel);
  aiSettings = await getAISettings();
  populateModelDropdown();
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

async function handleBaseUrlChange(): Promise<void> {
  const value = elements.aiBaseUrl.value.trim();
  const baseURL = value || undefined;
  await setBaseURL(baseURL);
  aiSettings = await getAISettings();
}
*/

// ============================================================================
// Utilities
// ============================================================================

// Configure DOMPurify with strict settings for AI-generated content
const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "code",
    "pre",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "span",
    "div",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["target"], // Allow target for links
  FORBID_TAGS: [
    "script",
    "style",
    "iframe",
    "form",
    "input",
    "object",
    "embed",
    "svg",
    "math",
  ],
  FORBID_ATTR: [
    "onerror",
    "onclick",
    "onload",
    "onmouseover",
    "onfocus",
    "onblur",
  ],
};

// Hook to force safe link attributes
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}

function formatMarkdown(text: string): string {
  // First escape HTML entities in the raw text to prevent injection
  const escaped = escapeHtml(text);

  // Then apply markdown formatting
  const formatted = escaped
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

  // Finally sanitize the result with DOMPurify
  return sanitizeHtml(formatted);
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
// Onboarding
// ============================================================================

function showOnboarding(): void {
  onboardingStep = 0;
  renderOnboardingStep();
  elements.onboardingOverlay.classList.remove("hidden");

  // Setup event listeners
  elements.onboardingSkip.addEventListener("click", completeOnboarding);
  elements.onboardingNext.addEventListener("click", nextOnboardingStep);
}

function renderOnboardingStep(): void {
  const step = ONBOARDING_STEPS[onboardingStep];
  if (!step) return;

  elements.onboardingIcon.innerHTML = step.icon;
  elements.onboardingTitle.textContent = step.title;
  elements.onboardingDescription.textContent = step.description;

  // Update dots
  elements.onboardingDots.innerHTML = ONBOARDING_STEPS.map((_, index) => {
    const activeClass = index === onboardingStep ? "active" : "";
    return `<div class="onboarding-dot ${activeClass}"></div>`;
  }).join("");

  // Update button text
  const isLastStep = onboardingStep === ONBOARDING_STEPS.length - 1;
  elements.onboardingNext.textContent = isLastStep ? "Get Started" : "Next";
}

function nextOnboardingStep(): void {
  if (onboardingStep < ONBOARDING_STEPS.length - 1) {
    onboardingStep++;
    renderOnboardingStep();
  } else {
    completeOnboarding();
  }
}

async function completeOnboarding(): Promise<void> {
  await markOnboardingComplete();
  elements.onboardingOverlay.classList.add("hidden");

  // Clean up event listeners
  elements.onboardingSkip.removeEventListener("click", completeOnboarding);
  elements.onboardingNext.removeEventListener("click", nextOnboardingStep);

  // Switch to settings tab to prompt AI setup
  switchTab("settings");
  showNotification("Welcome to FolioLM! Set up an AI profile to get started.");
}

// ============================================================================
// Start
// ============================================================================

init();

import type { Message, ContentExtractionResult } from "../types/index.ts";
import {
  createSource,
  saveSource,
  getNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
} from "../lib/storage.ts";
import { getLinksInSelection } from "../lib/selection-links.ts";

// ============================================================================
// Side Panel Setup
// ============================================================================

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ============================================================================
// Keyboard Command Handlers
// ============================================================================

chrome.commands.onCommand.addListener(async (command, tab) => {
  switch (command) {
    case "add-page-to-notebook":
      await handleAddPageCommand(tab);
      break;
    case "create-new-notebook":
      await handleCreateNotebookCommand(tab);
      break;
    case "add-selection-as-source":
      await handleAddSelectionCommand(tab);
      break;
  }
});

async function handleAddPageCommand(tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return;

  const notebookId = await getActiveNotebookId();
  if (!notebookId) {
    // No active notebook - open side panel and prompt to create one
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.storage.session.set({
      pendingAction: {
        type: "CREATE_NOTEBOOK_AND_ADD_PAGE",
        payload: { tabId: tab.id },
      },
    });
    chrome.runtime
      .sendMessage({
        type: "CREATE_NOTEBOOK_AND_ADD_PAGE",
        payload: { tabId: tab.id },
      })
      .catch(() => {});
    return;
  }

  // Open side panel and add page to active notebook
  await chrome.sidePanel.open({ tabId: tab.id });
  await handleAddPageFromContextMenu(tab.id, notebookId);
}

async function handleCreateNotebookCommand(tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return;

  // Open side panel and trigger new notebook creation
  await chrome.sidePanel.open({ tabId: tab.id });
  await chrome.storage.session.set({
    pendingAction: {
      type: "CREATE_NOTEBOOK",
    },
  });
  chrome.runtime
    .sendMessage({ type: "CREATE_NOTEBOOK" })
    .catch(() => {});
}

async function handleAddSelectionCommand(tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return;

  const notebookId = await getActiveNotebookId();
  if (!notebookId) {
    // No active notebook - open side panel and prompt to create one with selection
    await chrome.sidePanel.open({ tabId: tab.id });
    const selection = await extractSelectionText(tab.id);
    if (selection) {
      await chrome.storage.session.set({
        pendingAction: {
          type: "CREATE_NOTEBOOK_AND_ADD_SELECTION",
          payload: { text: selection.text, url: selection.url, title: selection.title },
        },
      });
      chrome.runtime
        .sendMessage({
          type: "CREATE_NOTEBOOK_AND_ADD_SELECTION",
          payload: { text: selection.text, url: selection.url, title: selection.title },
        })
        .catch(() => {});
    }
    return;
  }

  // Extract selection and add as source
  await chrome.sidePanel.open({ tabId: tab.id });
  const selection = await extractSelectionText(tab.id);
  if (selection && selection.text.trim()) {
    const source = createSource(
      notebookId,
      "text",
      selection.url,
      selection.title || "Selected Text",
      selection.text
    );
    await saveSource(source);
    chrome.runtime
      .sendMessage({ type: "SOURCE_ADDED", payload: source })
      .catch(() => {});
  }
}

async function extractSelectionText(tabId: number): Promise<{ text: string; url: string; title: string } | null> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selection = window.getSelection();
        return {
          text: selection?.toString() || "",
          url: window.location.href,
          title: document.title,
        };
      },
    });

    if (!result || result.length === 0) {
      return null;
    }

    return result[0].result as { text: string; url: string; title: string };
  } catch (error) {
    console.error("Error extracting selection text:", error);
    return null;
  }
}

// ============================================================================
// Context Menu Setup
// ============================================================================

// Menu ID prefixes
const PAGE_MENU_PREFIX = "add-page-to-";
const LINK_MENU_PREFIX = "add-link-to-";
const SELECTION_LINKS_MENU_PREFIX = "add-selection-links-to-";
const NEW_NOTEBOOK_SUFFIX = "new-notebook";

// Build context menus on install and when notebooks change
chrome.runtime.onInstalled.addListener(() => {
  buildContextMenus();
});

// Listen for requests to rebuild context menus (when notebooks change)
// This is needed because IndexedDB changes don't trigger chrome.storage.onChanged

async function buildContextMenus(): Promise<void> {
  // Remove all existing menus first
  await chrome.contextMenus.removeAll();

  const notebooks = await getNotebooks();

  // Create parent menu for pages
  chrome.contextMenus.create({
    id: "add-page-parent",
    title: "Add page to Folio",
    contexts: ["page"],
  });

  // Create parent menu for links
  chrome.contextMenus.create({
    id: "add-link-parent",
    title: "Add link to Folio",
    contexts: ["link"],
  });

  // Add notebook items for pages
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${PAGE_MENU_PREFIX}${notebook.id}`,
      parentId: "add-page-parent",
      title: notebook.name,
      contexts: ["page"],
    });
  }

  // Add separator and "New Notebook" for pages
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: "page-separator",
      parentId: "add-page-parent",
      type: "separator",
      contexts: ["page"],
    });
  }

  chrome.contextMenus.create({
    id: `${PAGE_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: "add-page-parent",
    title: "+ New Folio...",
    contexts: ["page"],
  });

  // Add notebook items for links
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${LINK_MENU_PREFIX}${notebook.id}`,
      parentId: "add-link-parent",
      title: notebook.name,
      contexts: ["link"],
    });
  }

  // Add separator and "New Notebook" for links
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: "link-separator",
      parentId: "add-link-parent",
      type: "separator",
      contexts: ["link"],
    });
  }

  chrome.contextMenus.create({
    id: `${LINK_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: "add-link-parent",
    title: "+ New Folio...",
    contexts: ["link"],
  });

  // Create parent menu for selection links
  chrome.contextMenus.create({
    id: "add-selection-links-parent",
    title: "Add links in selection to Folio",
    contexts: ["selection"],
  });

  // Add notebook items for selection links
  for (const notebook of notebooks) {
    chrome.contextMenus.create({
      id: `${SELECTION_LINKS_MENU_PREFIX}${notebook.id}`,
      parentId: "add-selection-links-parent",
      title: notebook.name,
      contexts: ["selection"],
    });
  }

  // Add separator and "New Notebook" for selection links
  if (notebooks.length > 0) {
    chrome.contextMenus.create({
      id: "selection-links-separator",
      parentId: "add-selection-links-parent",
      type: "separator",
      contexts: ["selection"],
    });
  }

  chrome.contextMenus.create({
    id: `${SELECTION_LINKS_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: "add-selection-links-parent",
    title: "+ New Folio...",
    contexts: ["selection"],
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId as string;

  // Open side panel immediately (must be in direct response to user gesture)
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }

  // Handle page menu clicks
  if (menuId.startsWith(PAGE_MENU_PREFIX) && tab?.id) {
    const notebookIdOrNew = menuId.replace(PAGE_MENU_PREFIX, "");

    if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
      // Store pending action in session storage for side panel to pick up
      await chrome.storage.session.set({
        pendingAction: {
          type: "CREATE_NOTEBOOK_AND_ADD_PAGE",
          payload: { tabId: tab.id },
        },
      });
      // Also try sending message in case side panel is already open
      chrome.runtime
        .sendMessage({
          type: "CREATE_NOTEBOOK_AND_ADD_PAGE",
          payload: { tabId: tab.id },
        })
        .catch(() => {});
    } else {
      await handleAddPageFromContextMenu(tab.id, notebookIdOrNew);
    }
  }

  // Handle link menu clicks
  if (menuId.startsWith(LINK_MENU_PREFIX) && info.linkUrl) {
    const notebookIdOrNew = menuId.replace(LINK_MENU_PREFIX, "");

    if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
      // Store pending action in session storage for side panel to pick up
      await chrome.storage.session.set({
        pendingAction: {
          type: "CREATE_NOTEBOOK_AND_ADD_LINK",
          payload: { linkUrl: info.linkUrl },
        },
      });
      // Also try sending message in case side panel is already open
      chrome.runtime
        .sendMessage({
          type: "CREATE_NOTEBOOK_AND_ADD_LINK",
          payload: { linkUrl: info.linkUrl },
        })
        .catch(() => {});
    } else {
      await handleAddLinkFromContextMenu(info.linkUrl, notebookIdOrNew);
    }
  }

  // Handle selection links menu clicks
  if (menuId.startsWith(SELECTION_LINKS_MENU_PREFIX) && tab?.id) {
    const notebookIdOrNew = menuId.replace(SELECTION_LINKS_MENU_PREFIX, "");

    // Extract links from the selection using scripting API
    const links = await extractLinksFromSelection(tab.id);

    if (links.length === 0) {
      console.log("No links found in selection");
      return;
    }

    if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
      // Store pending action in session storage for side panel to pick up
      await chrome.storage.session.set({
        pendingAction: {
          type: "CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS",
          payload: { links },
        },
      });
      // Also try sending message in case side panel is already open
      chrome.runtime
        .sendMessage({
          type: "CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS",
          payload: { links },
        })
        .catch(() => {});
    } else {
      await handleAddSelectionLinksFromContextMenu(links, notebookIdOrNew);
    }
  }
});

async function handleAddPageFromContextMenu(
  tabId: number,
  notebookId: string
): Promise<void> {
  try {
    await ensureContentScript(tabId);
    const result = await chrome.tabs.sendMessage(tabId, {
      action: "extractContent",
    });

    if (result) {
      const source = createSource(
        notebookId,
        "tab",
        result.url,
        result.title,
        result.markdown,
        result.links
      );
      await saveSource(source);

      // Set as active notebook
      await setActiveNotebookId(notebookId);

      // Notify the side panel to refresh
      chrome.runtime
        .sendMessage({ type: "SOURCE_ADDED", payload: source })
        .catch(() => {
          // Side panel may not be listening yet
        });
    }
  } catch (error) {
    console.error("Failed to add page from context menu:", error);
  }
}

async function handleAddLinkFromContextMenu(
  linkUrl: string,
  notebookId: string
): Promise<void> {
  try {
    const result = await extractContentFromUrl(linkUrl);
    if (result) {
      const source = createSource(
        notebookId,
        "tab",
        result.url,
        result.title,
        result.content,
        result.links
      );
      await saveSource(source);

      // Set as active notebook
      await setActiveNotebookId(notebookId);

      // Notify the side panel to refresh its source list
      chrome.runtime
        .sendMessage({ type: "SOURCE_ADDED", payload: source })
        .catch(() => {
          // Side panel may not be listening yet
        });
    }
  } catch (error) {
    console.error("Failed to add link from context menu:", error);
  }
}

/**
 * Extract all links from the current text selection in a tab.
 * Uses chrome.scripting.executeScript to run a function in the page context.
 */
async function extractLinksFromSelection(tabId: number): Promise<string[]> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: getLinksInSelection,
    });

    if (!result || result.length === 0) {
      return [];
    }

    return (result[0].result as string[]) || [];
  } catch (error) {
    console.error("Error extracting links from selection:", error);
    return [];
  }
}

/**
 * Handle adding multiple links from a text selection to a notebook.
 * Extracts content from each link and saves them as sources.
 */
async function handleAddSelectionLinksFromContextMenu(
  links: string[],
  notebookId: string
): Promise<void> {
  // Set as active notebook first
  await setActiveNotebookId(notebookId);

  // Process each link and add as a source
  for (const linkUrl of links) {
    try {
      const result = await extractContentFromUrl(linkUrl);
      if (result) {
        const source = createSource(
          notebookId,
          "tab",
          result.url,
          result.title,
          result.content,
          result.links
        );
        await saveSource(source);

        // Notify the side panel to refresh its source list
        chrome.runtime
          .sendMessage({ type: "SOURCE_ADDED", payload: source })
          .catch(() => {
            // Side panel may not be listening yet
          });
      }
    } catch (error) {
      console.error(`Failed to add link ${linkUrl} from selection:`, error);
      // Continue with other links even if one fails
    }
  }
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(console.error);
    return true;
  }
);

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case "EXTRACT_CONTENT":
      return extractContentFromActiveTab();
    case "EXTRACT_FROM_URL": {
      const payload = message.payload as { url: string; notebookId: string } | string;
      // Support both old format (just URL string) and new format (object with url and notebookId)
      if (typeof payload === "string") {
        return extractContentFromUrl(payload);
      }
      const { url, notebookId } = payload;
      const result = await extractContentFromUrl(url);
      if (result && notebookId) {
        const source = createSource(
          notebookId,
          "tab",
          result.url,
          result.title,
          result.content,
          result.links
        );
        await saveSource(source);
        await setActiveNotebookId(notebookId);
        chrome.runtime
          .sendMessage({ type: "SOURCE_ADDED", payload: source })
          .catch(() => {});
        return { success: true, source };
      }
      return result;
    }
    case "ADD_SOURCE":
      return handleAddSource(message.payload as ContentExtractionResult);
    case "REBUILD_CONTEXT_MENUS":
      await buildContextMenus();
      return true;
    // Browser tools
    case "LIST_WINDOWS":
      return handleListWindows();
    case "LIST_TABS":
      return handleListTabs(message.payload as { windowId?: number } | undefined);
    case "LIST_TAB_GROUPS":
      return handleListTabGroups();
    case "READ_PAGE_CONTENT":
      return handleReadPageContent(message.payload as { tabId: number });
    default:
      return null;
  }
}

async function extractContentFromActiveTab(): Promise<ContentExtractionResult | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    return null;
  }

  try {
    // Wait for the tab to finish loading (resolves immediately if already loaded)
    await waitForTabLoad(tab.id);

    // Ensure content script is injected
    await ensureContentScript(tab.id);

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: "extractContent",
    });

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
      links: result.links,
    };
  } catch (error) {
    console.error("Failed to extract content:", error);
    return null;
  }
}

async function extractContentFromUrl(
  url: string
): Promise<ContentExtractionResult | null> {
  try {
    // Create a new tab to load the URL
    const tab = await chrome.tabs.create({ url, active: false });

    if (!tab.id) {
      return null;
    }

    // Wait for the tab to finish loading
    await waitForTabLoad(tab.id);

    // Ensure content script is injected
    await ensureContentScript(tab.id);

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: "extractContent",
    });

    // Close the tab
    await chrome.tabs.remove(tab.id);

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
      links: result.links,
    };
  } catch (error) {
    console.error("Failed to extract content from URL:", error);
    return null;
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: "ping" });
  } catch {
    // Content script not loaded - inject inline extraction function
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectContentScript,
    });
  }
}

// Inline content script injection for pages loaded before extension install
function injectContentScript(): void {
  // Simple extraction if Turndown isn't available
  if (
    (window as unknown as { __notebookExtracted?: boolean }).__notebookExtracted
  ) {
    return;
  }
  (window as unknown as { __notebookExtracted: boolean }).__notebookExtracted =
    true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "ping") {
      sendResponse({ status: "ok" });
      return true;
    }

    if (message.action === "extractContent") {
      // Simple text extraction without Turndown
      const title = document.title || "Untitled";
      const url = window.location.href;

      // Remove script, style, nav, footer, etc.
      const clone = document.body.cloneNode(true) as HTMLElement;
      const removeSelectors = [
        "script",
        "style",
        "noscript",
        "iframe",
        "nav",
        "footer",
        "header",
        "aside",
        "form",
      ];
      removeSelectors.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      });

      // Extract links before converting to text
      const anchors = clone.querySelectorAll("a[href]");
      const seen = new Set<string>();
      const links: Array<{ url: string; text: string; context: string }> = [];
      const noisePatterns = [
        /privacy/i, /terms/i, /cookie/i, /policy/i, /login/i, /signin/i,
        /signup/i, /register/i, /account/i, /subscribe/i, /newsletter/i,
        /contact/i, /about\/?$/i, /legal/i, /sitemap/i, /rss/i, /feed/i,
      ];

      for (const anchor of anchors) {
        const href = (anchor as HTMLAnchorElement).href;
        const text = (anchor.textContent || "").trim();

        if (!href || !text || text.length < 3) continue;
        if (!href.startsWith("http://") && !href.startsWith("https://")) continue;
        if (href === url || href === url + "/") continue;
        if (seen.has(href)) continue;
        if (noisePatterns.some((p) => p.test(href))) continue;

        seen.add(href);
        const parent = anchor.parentElement;
        const context = parent ? (parent.textContent || "").slice(0, 60).trim() : "";
        links.push({ url: href, text, context });
      }

      const textContent = clone.innerText || clone.textContent || "";
      // Clean up whitespace
      const markdown = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n\n");

      sendResponse({ url, title, markdown, links });
      return true;
    }

    return false;
  });
}

function waitForTabLoad(tabId: number, timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
    };

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      }
    };

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error(`Tab load timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Check if tab is already loaded before adding listener
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve();
        }
      } else {
        // Only add listener if tab isn't already complete
        chrome.tabs.onUpdated.addListener(listener);
      }
    }).catch(() => {
      // Tab might not exist anymore
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error("Tab no longer exists"));
      }
    });
  });
}

async function handleAddSource(
  extraction: ContentExtractionResult
): Promise<boolean> {
  const notebookId = await getActiveNotebookId();

  if (!notebookId) {
    return false;
  }

  const source = createSource(
    notebookId,
    "tab",
    extraction.url,
    extraction.title,
    extraction.content,
    extraction.links
  );
  await saveSource(source);

  return true;
}

// ============================================================================
// Browser Tools Handlers
// ============================================================================

async function handleListWindows(): Promise<{ windows: Array<{
  id: number;
  focused: boolean;
  type: 'normal' | 'popup' | 'panel' | 'app' | 'devtools';
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
}> }> {
  const windows = await chrome.windows.getAll({
    populate: false,
    windowTypes: ['normal', 'popup', 'panel', 'devtools'],
  });

  return {
    windows: windows
      .filter((w): w is chrome.windows.Window & { id: number } => w.id !== undefined)
      .map((w) => ({
        id: w.id,
        focused: w.focused ?? false,
        type: (w.type || 'normal') as 'normal' | 'popup' | 'panel' | 'app' | 'devtools',
        state: (w.state || 'normal') as 'normal' | 'minimized' | 'maximized' | 'fullscreen',
      })),
  };
}

async function handleListTabs(payload: { windowId?: number } | undefined): Promise<{
  tabs: Array<{
    id: number;
    windowId: number;
    index: number;
    title: string;
    url: string;
    active: boolean;
    pinned: boolean;
    groupId: number;
  }>;
}> {
  const tabs = await chrome.tabs.query(
    payload?.windowId ? { windowId: payload.windowId } : {}
  );

  return {
    tabs: tabs
      .filter((t): t is chrome.tabs.Tab & { id: number } => t.id !== undefined)
      .map((t) => ({
        id: t.id,
        windowId: t.windowId,
        index: t.index,
        title: t.title || '',
        url: t.url || 'about:blank',
        active: t.active,
        pinned: t.pinned,
        groupId: t.windowId,
      })),
  };
}

async function handleListTabGroups(): Promise<{
  tabGroups: Array<{
    id: number;
    windowId: number;
    title: string;
    color: chrome.tabGroups.ColorEnum;
    collapsed: boolean;
  }>;
}> {
  const tabGroups = await chrome.tabGroups.query({});

  return {
    tabGroups: tabGroups.map((tg) => ({
      id: tg.id,
      windowId: tg.windowId,
      title: tg.title || '',
      color: tg.color,
      collapsed: tg.collapsed,
    })),
  };
}

async function handleReadPageContent(payload: { tabId: number }): Promise<{
  tabId: number;
  title: string;
  url: string;
  content: string;
} | null> {
  const { tabId } = payload;

  // Get tab info
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.id || !tab.url) {
    return null;
  }

  try {
    // Wait for the tab to finish loading
    await waitForTabLoad(tab.id);

    // Ensure content script is injected
    await ensureContentScript(tab.id);

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: "extractContent",
    });

    return {
      tabId: tab.id,
      title: result.title || tab.title,
      url: result.url || tab.url,
      content: result.textContent || result.content,
    };
  } catch (error) {
    console.error(`Failed to read content from tab ${tabId}:`, error);
    return null;
  }
}

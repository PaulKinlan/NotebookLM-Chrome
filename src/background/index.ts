import type { Message, ContentExtractionResult } from "../types/index.ts";
import {
  createSource,
  saveSource,
  getNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
} from "../lib/storage.ts";
import browser from "../lib/browser";

// ============================================================================
// Types
// ============================================================================

interface ContentScriptResponse {
  url: string;
  title: string;
  markdown: string;
}

function isContentScriptResponse(value: unknown): value is ContentScriptResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    'title' in value &&
    'markdown' in value &&
    typeof (value as ContentScriptResponse).url === 'string' &&
    typeof (value as ContentScriptResponse).title === 'string' &&
    typeof (value as ContentScriptResponse).markdown === 'string'
  );
}

async function sendExtractContentMessage(
  tabId: number
): Promise<ContentScriptResponse | null> {
  const result = await browser.tabs.sendMessage(tabId, {
    action: "extractContent",
  });

  if (isContentScriptResponse(result)) {
    return result;
  }
  return null;
}

// ============================================================================
// Side Panel Setup
// ============================================================================

// @ts-expect-error - sidePanel API not yet in webextension-polyfill types
browser.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ============================================================================
// Context Menu Setup
// ============================================================================

// Menu ID prefixes
const PAGE_MENU_PREFIX = "add-page-to-";
const LINK_MENU_PREFIX = "add-link-to-";
const NEW_NOTEBOOK_SUFFIX = "new-notebook";

// Build context menus on install and when notebooks change
browser.runtime.onInstalled.addListener(() => {
  buildContextMenus();
});

// Listen for requests to rebuild context menus (when notebooks change)
// This is needed because IndexedDB changes don't trigger browser.storage.onChanged

async function buildContextMenus(): Promise<void> {
  // Remove all existing menus first
  await browser.contextMenus.removeAll();

  const notebooks = await getNotebooks();

  // Create parent menu for pages
  browser.contextMenus.create({
    id: "add-page-parent",
    title: "Add page to Folio",
    contexts: ["page"],
  });

  // Create parent menu for links
  browser.contextMenus.create({
    id: "add-link-parent",
    title: "Add link to Folio",
    contexts: ["link"],
  });

  // Add notebook items for pages
  for (const notebook of notebooks) {
    browser.contextMenus.create({
      id: `${PAGE_MENU_PREFIX}${notebook.id}`,
      parentId: "add-page-parent",
      title: notebook.name,
      contexts: ["page"],
    });
  }

  // Add separator and "New Notebook" for pages
  if (notebooks.length > 0) {
    browser.contextMenus.create({
      id: "page-separator",
      parentId: "add-page-parent",
      type: "separator",
      contexts: ["page"],
    });
  }

  browser.contextMenus.create({
    id: `${PAGE_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: "add-page-parent",
    title: "+ New Folio...",
    contexts: ["page"],
  });

  // Add notebook items for links
  for (const notebook of notebooks) {
    browser.contextMenus.create({
      id: `${LINK_MENU_PREFIX}${notebook.id}`,
      parentId: "add-link-parent",
      title: notebook.name,
      contexts: ["link"],
    });
  }

  // Add separator and "New Notebook" for links
  if (notebooks.length > 0) {
    browser.contextMenus.create({
      id: "link-separator",
      parentId: "add-link-parent",
      type: "separator",
      contexts: ["link"],
    });
  }

  browser.contextMenus.create({
    id: `${LINK_MENU_PREFIX}${NEW_NOTEBOOK_SUFFIX}`,
    parentId: "add-link-parent",
    title: "+ New Folio...",
    contexts: ["link"],
  });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId as string;

  // Open side panel immediately (must be in direct response to user gesture)
  if (tab?.id) {
    // @ts-expect-error - sidePanel API not yet in webextension-polyfill types
    await browser.sidePanel?.open({ tabId: tab.id });
  }

  // Handle page menu clicks
  if (menuId.startsWith(PAGE_MENU_PREFIX) && tab?.id) {
    const notebookIdOrNew = menuId.replace(PAGE_MENU_PREFIX, "");

    if (notebookIdOrNew === NEW_NOTEBOOK_SUFFIX) {
      // Store pending action in session storage for side panel to pick up
      await browser.storage.session.set({
        pendingAction: {
          type: "CREATE_NOTEBOOK_AND_ADD_PAGE",
          payload: { tabId: tab.id },
        },
      });
      // Also try sending message in case side panel is already open
      browser.runtime
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
      await browser.storage.session.set({
        pendingAction: {
          type: "CREATE_NOTEBOOK_AND_ADD_LINK",
          payload: { linkUrl: info.linkUrl },
        },
      });
      // Also try sending message in case side panel is already open
      browser.runtime
        .sendMessage({
          type: "CREATE_NOTEBOOK_AND_ADD_LINK",
          payload: { linkUrl: info.linkUrl },
        })
        .catch(() => {});
    } else {
      await handleAddLinkFromContextMenu(info.linkUrl, notebookIdOrNew);
    }
  }
});

async function handleAddPageFromContextMenu(
  tabId: number,
  notebookId: string
): Promise<void> {
  try {
    await ensureContentScript(tabId);
    const result = await sendExtractContentMessage(tabId);

    if (result) {
      const source = createSource(
        notebookId,
        "tab",
        result.url,
        result.title,
        result.markdown
      );
      await saveSource(source);

      // Set as active notebook
      await setActiveNotebookId(notebookId);

      // Notify the side panel to refresh
      browser.runtime
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
        result.content
      );
      await saveSource(source);

      // Set as active notebook
      await setActiveNotebookId(notebookId);

      // Notify the side panel to refresh its source list
      browser.runtime
        .sendMessage({ type: "SOURCE_ADDED", payload: source })
        .catch(() => {
          // Side panel may not be listening yet
        });
    }
  } catch (error) {
    console.error("Failed to add link from context menu:", error);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

browser.runtime.onMessage.addListener((message: unknown, _sender: unknown) => {
  return handleMessage(message as Message);
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case "EXTRACT_CONTENT":
      return extractContentFromActiveTab();
    case "EXTRACT_FROM_URL":
      return extractContentFromUrl(message.payload as string);
    case "ADD_SOURCE":
      return handleAddSource(message.payload as ContentExtractionResult);
    case "REBUILD_CONTEXT_MENUS":
      await buildContextMenus();
      return true;
    default:
      return null;
  }
}

async function extractContentFromActiveTab(): Promise<ContentExtractionResult | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    return null;
  }

  try {
    // Wait for the tab to finish loading (resolves immediately if already loaded)
    await waitForTabLoad(tab.id);

    // Ensure content script is injected
    await ensureContentScript(tab.id);

    // Request extraction from content script
    const result = await sendExtractContentMessage(tab.id);

    if (!result) {
      return null;
    }

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
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
    const tab = await browser.tabs.create({ url, active: false });

    if (!tab.id) {
      return null;
    }

    // Wait for the tab to finish loading
    await waitForTabLoad(tab.id);

    // Ensure content script is injected
    await ensureContentScript(tab.id);

    // Request extraction from content script
    const result = await sendExtractContentMessage(tab.id);

    // Close the tab
    await browser.tabs.remove(tab.id);

    if (!result) {
      return null;
    }

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
    };
  } catch (error) {
    console.error("Failed to extract content from URL:", error);
    return null;
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    // Try to ping the content script
    await browser.tabs.sendMessage(tabId, { action: "ping" });
  } catch {
    // Content script not loaded - inject inline extraction function
    await browser.scripting.executeScript({
      target: { tabId },
      func: injectContentScript,
    });
  }
}

// Inline content script injection for pages loaded before extension install
// Note: This code runs in the content script context, so uses chrome.* directly
function injectContentScript(): void {
  // Simple extraction if Turndown isn't available
  if (
    (window as unknown as { __notebookExtracted?: boolean }).__notebookExtracted
  ) {
    return;
  }
  (window as unknown as { __notebookExtracted: boolean }).__notebookExtracted =
    true;

  // Use chrome.runtime directly here as this code is injected into content script context
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (typeof message === 'object' && message !== null && (message as { action: string }).action === "ping") {
      sendResponse({ status: "ok" });
      return true;
    }

    if (typeof message === 'object' && message !== null && (message as { action: string }).action === "extractContent") {
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

      const textContent = clone.innerText || clone.textContent || "";
      // Clean up whitespace
      const markdown = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n\n");

      sendResponse({ url, title, markdown });
      return true;
    }

    return false;
  });
}

function waitForTabLoad(tabId: number, timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const cleanup = () => {
      browser.tabs.onUpdated.removeListener(listener);
    };

    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string }
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
    browser.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve();
        }
      } else {
        // Only add listener if tab isn't already complete
        browser.tabs.onUpdated.addListener(listener);
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
    extraction.content
  );
  await saveSource(source);

  return true;
}

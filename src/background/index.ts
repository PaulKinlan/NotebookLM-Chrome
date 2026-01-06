import type { Message, ContentExtractionResult } from '../types/index.ts';
import {
  addSourceToNotebook,
  createSource,
  getActiveNotebookId,
} from '../lib/storage.ts';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(console.error);
  return true;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'EXTRACT_CONTENT':
      return extractContentFromActiveTab();
    case 'EXTRACT_FROM_URL':
      return extractContentFromUrl(message.payload as string);
    case 'ADD_SOURCE':
      return handleAddSource(message.payload as ContentExtractionResult);
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
    // Ensure content script is injected
    await ensureContentScript(tab.id);

    // Request extraction from content script
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown, // Using markdown as the text content
    };
  } catch (error) {
    console.error('Failed to extract content:', error);
    return null;
  }
}

async function extractContentFromUrl(url: string): Promise<ContentExtractionResult | null> {
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
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });

    // Close the tab
    await chrome.tabs.remove(tab.id);

    return {
      url: result.url,
      title: result.title,
      content: result.markdown,
      textContent: result.markdown,
    };
  } catch (error) {
    console.error('Failed to extract content from URL:', error);
    return null;
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    // Content script not loaded, inject it
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.ts'],
    });
  }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function handleAddSource(
  extraction: ContentExtractionResult
): Promise<boolean> {
  const notebookId = await getActiveNotebookId();

  if (!notebookId) {
    return false;
  }

  const source = createSource('tab', extraction.url, extraction.title, extraction.content);
  await addSourceToNotebook(notebookId, source);

  return true;
}

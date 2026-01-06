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
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    return {
      url: tab.url,
      title: tab.title ?? '',
      content: result.result?.content ?? '',
      textContent: result.result?.textContent ?? '',
    };
  } catch (error) {
    console.error('Failed to extract content:', error);
    return null;
  }
}

function extractPageContent(): { content: string; textContent: string } {
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const body = document.body;

  const container = article ?? main ?? body;
  const clone = container.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('script, style, nav, header, footer, aside').forEach((el) => el.remove());

  return {
    content: clone.innerHTML,
    textContent: clone.textContent?.trim() ?? '',
  };
}

async function handleAddSource(
  extraction: ContentExtractionResult
): Promise<boolean> {
  const notebookId = await getActiveNotebookId();

  if (!notebookId) {
    return false;
  }

  const source = createSource('tab', extraction.url, extraction.title, extraction.textContent);
  await addSourceToNotebook(notebookId, source);

  return true;
}

import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Remove unwanted elements that don't contribute to main content
turndownService.addRule('remove-noise', {
  filter: ['style', 'script', 'noscript', 'iframe', 'head', 'nav', 'footer', 'header', 'aside', 'form', 'input', 'button', 'select', 'textarea'],
  replacement: () => '',
});

// Keep link text but remove the link itself (cleaner for AI context)
turndownService.addRule('flatten-links', {
  filter: ['a'],
  replacement: (content) => content,
});

// Remove images (optional - could make configurable later)
turndownService.addRule('remove-images', {
  filter: ['img'],
  replacement: () => '',
});

/**
 * Try to extract content using Readability.js for better article parsing.
 * Returns null if Readability fails or produces poor results.
 */
function tryReadability(): { content: string; title: string } | null {
  try {
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone, {
      charThreshold: 100,
    });
    const article = reader.parse();

    if (article && article.content && article.textContent) {
      // Only use Readability if it extracted meaningful content
      const textLength = article.textContent.trim().length;
      if (textLength > 200) {
        return {
          content: article.content,
          title: article.title || document.title,
        };
      }
    }
  } catch (error) {
    console.warn('Readability extraction failed:', error);
  }
  return null;
}

/**
 * Fallback content extraction using CSS selectors.
 */
function getMainContentFallback(): string {
  // Try to find the main content container
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 200) {
      return element.innerHTML;
    }
  }

  // Fall back to body
  return document.body.innerHTML;
}

/**
 * Extract content with Readability.js as primary method,
 * falling back to CSS selector approach if Readability fails.
 */
function extractMarkdown(): { markdown: string; title: string; url: string } {
  // Try Readability.js first for better article extraction
  const readabilityResult = tryReadability();

  let content: string;
  let title: string;

  if (readabilityResult) {
    content = readabilityResult.content;
    title = readabilityResult.title;
  } else {
    // Fallback to CSS selector approach
    content = getMainContentFallback();
    title = document.title;
  }

  const markdown = turndownService.turndown(content);

  return {
    markdown,
    title,
    url: window.location.href,
  };
}

// Listen for extraction requests from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const result = extractMarkdown();
    sendResponse(result);
  }
  return true;
});

export { extractMarkdown };

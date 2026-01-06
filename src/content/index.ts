import TurndownService from 'turndown';

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

function getMainContent(): string {
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

function extractMarkdown(): { markdown: string; title: string; url: string } {
  const content = getMainContent();
  const markdown = turndownService.turndown(content);

  return {
    markdown,
    title: document.title,
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

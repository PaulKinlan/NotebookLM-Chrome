/**
 * Utility functions for extracting links from text selections.
 * These functions are designed to run in the page context via chrome.scripting.executeScript.
 */

/**
 * Extract all HTTP/HTTPS links from the current text selection.
 * This function is designed to be injected into a page and executed in that context.
 *
 * The function handles several scenarios:
 * 1. Anchor elements directly within the selection
 * 2. Selections that start/end within an anchor element
 * 3. Anchor elements within a common ancestor that are partially selected
 *
 * @returns Array of unique HTTP/HTTPS URLs found in the selection
 */
export function getLinksInSelection(): string[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return [];
  }

  const linksSet = new Set<string>();

  // Get the range of the selection
  const range = selection.getRangeAt(0);

  // Create a document fragment from the range
  const fragment = range.cloneContents();

  // Find all anchor elements in the selection
  const anchorElements = fragment.querySelectorAll("a[href]");

  anchorElements.forEach((anchor) => {
    const href = (anchor as HTMLAnchorElement).href;
    if (href && href.startsWith("http")) {
      linksSet.add(href);
    }
  });

  // Also check if the selection itself starts or ends within an anchor element
  const container = range.commonAncestorContainer;
  const parentElement =
    container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : (container as Element);

  if (parentElement) {
    // Check if the selection is within an anchor or contains anchors
    const closestAnchor = parentElement.closest("a[href]");
    if (closestAnchor) {
      const href = (closestAnchor as HTMLAnchorElement).href;
      if (href && href.startsWith("http")) {
        linksSet.add(href);
      }
    }

    // Find all anchors within the common ancestor to limit scope
    const ancestorAnchors = parentElement.querySelectorAll("a[href]");
    ancestorAnchors.forEach((anchor) => {
      if (selection.containsNode(anchor, true)) {
        const href = (anchor as HTMLAnchorElement).href;
        if (href && href.startsWith("http")) {
          linksSet.add(href);
        }
      }
    });
  }

  return Array.from(linksSet);
}

/**
 * Utility functions for extracting links from text selections.
 * These functions are designed to run in the page context via chrome.scripting.executeScript.
 */

/**
 * Type guard to check if a node is an Element
 */
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/**
 * Type guard to check if an element is an HTMLAnchorElement
 */
function isHTMLAnchorElement(element: Element): element is HTMLAnchorElement {
  return element.tagName === 'A';
}

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
    if (isHTMLAnchorElement(anchor)) {
      const href = anchor.href;
      if (href && href.startsWith("http")) {
        linksSet.add(href);
      }
    }
  });

  // Also check if the selection itself starts or ends within an anchor element
  const container = range.commonAncestorContainer;
  let parentElement: Element | null = null;

  if (container.nodeType === Node.TEXT_NODE) {
    parentElement = container.parentElement;
  } else if (isElement(container)) {
    parentElement = container;
  }

  if (parentElement) {
    // Check if the selection is within an anchor or contains anchors
    const closestAnchor = parentElement.closest("a[href]");
    if (closestAnchor && isHTMLAnchorElement(closestAnchor)) {
      const href = closestAnchor.href;
      if (href && href.startsWith("http")) {
        linksSet.add(href);
      }
    }

    // Find all anchors within the common ancestor to limit scope
    const ancestorAnchors = parentElement.querySelectorAll("a[href]");
    ancestorAnchors.forEach((anchor) => {
      if (selection.containsNode(anchor, true) && isHTMLAnchorElement(anchor)) {
        const href = anchor.href;
        if (href && href.startsWith("http")) {
          linksSet.add(href);
        }
      }
    });
  }

  return Array.from(linksSet);
}

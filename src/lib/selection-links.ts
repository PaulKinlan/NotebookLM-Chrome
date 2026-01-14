/**
 * Utility functions for extracting links from text selections.
 * These functions are designed to run in the page context via chrome.scripting.executeScript.
 */

/**
 * Type guard to check if a node is an Element
 */
function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

/**
 * Type guard to check if an element is an HTMLAnchorElement
 */
function isHTMLAnchorElement(element: Element): element is HTMLAnchorElement {
  return element.tagName === 'A'
}

/**
 * Extract all HTTP/HTTPS links from the current text selection.
 * This function is designed to be injected into a page and executed in that context.
 *
 * The function handles several scenarios:
 * 1. Anchor elements directly within the selection
 * 2. Selections that start/end within an anchor element
 * 3. Anchor elements within a common ancestor that are partially selected
 * 4. Multiple selection ranges
 *
 * @returns Array of unique HTTP/HTTPS URLs found in the selection
 */
export function getLinksInSelection(): string[] {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return []
  }

  const linksSet = new Set<string>()

  // Get the first range of the selection
  const range = selection.getRangeAt(0)

  // Strategy 1: Check if selection is inside or contains anchor elements
  // by walking up from the common ancestor and down through descendants
  const container = range.commonAncestorContainer
  let searchRoot: Element | null = null

  if (container.nodeType === Node.TEXT_NODE) {
    searchRoot = container.parentElement
  }
  else if (isElement(container)) {
    searchRoot = container
  }

  if (searchRoot) {
    // Check if we're inside an anchor (selection is within link text)
    const closestAnchor = searchRoot.closest('a[href]')
    if (closestAnchor && isHTMLAnchorElement(closestAnchor)) {
      const href = closestAnchor.href
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        linksSet.add(href)
      }
    }

    // Find all anchors within the search root that intersect with the selection
    const allAnchors = searchRoot.querySelectorAll('a[href]')
    for (const anchor of allAnchors) {
      if (!isHTMLAnchorElement(anchor)) continue

      // Check if this anchor intersects with the selection
      if (selection.containsNode(anchor, true)) {
        const href = anchor.href
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          linksSet.add(href)
        }
      }
    }
  }

  // Strategy 2: Also check parent of search root in case selection spans siblings
  if (searchRoot?.parentElement) {
    const parentAnchors = searchRoot.parentElement.querySelectorAll('a[href]')
    for (const anchor of parentAnchors) {
      if (!isHTMLAnchorElement(anchor)) continue

      if (selection.containsNode(anchor, true)) {
        const href = anchor.href
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          linksSet.add(href)
        }
      }
    }
  }

  // Strategy 3: Walk through selection ranges and check each text node's ancestors
  for (let i = 0; i < selection.rangeCount; i++) {
    const r = selection.getRangeAt(i)

    // Check start container's anchor ancestry
    let node: Node | null = r.startContainer
    while (node && node !== document.body) {
      if (isHTMLAnchorElement(node as Element) && (node as HTMLAnchorElement).href) {
        const href = (node as HTMLAnchorElement).href
        if (href.startsWith('http://') || href.startsWith('https://')) {
          linksSet.add(href)
        }
      }
      node = node.parentNode
    }

    // Check end container's anchor ancestry
    node = r.endContainer
    while (node && node !== document.body) {
      if (isHTMLAnchorElement(node as Element) && (node as HTMLAnchorElement).href) {
        const href = (node as HTMLAnchorElement).href
        if (href.startsWith('http://') || href.startsWith('https://')) {
          linksSet.add(href)
        }
      }
      node = node.parentNode
    }
  }

  return Array.from(linksSet)
}

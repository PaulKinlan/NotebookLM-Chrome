import TurndownService from 'turndown'
import { Readability } from '@mozilla/readability'
import type { ExtractedLink } from './types/index.js'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

// Remove unwanted elements that don't contribute to main content
turndownService.addRule('remove-noise', {
  filter: ['style', 'script', 'noscript', 'iframe', 'head', 'nav', 'footer', 'header', 'aside', 'form', 'input', 'button', 'select', 'textarea'],
  replacement: () => '',
})

// Keep link text but remove the link itself (cleaner for AI context)
turndownService.addRule('flatten-links', {
  filter: ['a'],
  replacement: content => content,
})

// Remove images (optional - could make configurable later)
turndownService.addRule('remove-images', {
  filter: ['img'],
  replacement: () => '',
})

/**
 * Type guard to check if a Node is a Document
 */
function isDocument(node: Node): node is Document {
  return node.nodeType === Node.DOCUMENT_NODE
}

/**
 * Try to extract content using Readability.js for better article parsing.
 * Returns null if Readability fails or produces poor results.
 */
function tryReadability(): { content: string, title: string } | null {
  try {
    // Clone the document to avoid modifying the original
    const clonedNode = document.cloneNode(true)

    // Verify the clone is a Document node
    if (!isDocument(clonedNode)) {
      console.warn('Clone did not produce a Document node')
      return null
    }

    const reader = new Readability(clonedNode, {
      charThreshold: 100,
    })
    const article = reader.parse()

    if (article && article.content && article.textContent) {
      // Only use Readability if it extracted meaningful content
      const textLength = article.textContent.trim().length
      if (textLength > 200) {
        return {
          content: article.content,
          title: article.title || document.title,
        }
      }
    }
  }
  catch (error) {
    console.warn('Readability extraction failed:', error)
  }
  return null
}

/**
 * URL patterns to exclude from link extraction (common noise)
 */
const NOISE_URL_PATTERNS = [
  /privacy/i,
  /terms/i,
  /cookie/i,
  /policy/i,
  /login/i,
  /signin/i,
  /signup/i,
  /register/i,
  /account/i,
  /subscribe/i,
  /newsletter/i,
  /unsubscribe/i,
  /feedback/i,
  /contact/i,
  /about\/?$/i,
  /legal/i,
  /disclaimer/i,
  /accessibility/i,
  /sitemap/i,
  /rss/i,
  /feed/i,
  /share/i,
  /print/i,
  /email.*friend/i,
  /\.(pdf|zip|exe|dmg|pkg)$/i,
]

/**
 * Check if a URL should be excluded as noise
 */
function isNoiseUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const pathAndQuery = urlObj.pathname + urlObj.search
    return NOISE_URL_PATTERNS.some(pattern => pattern.test(pathAndQuery))
  }
  catch {
    return true // Invalid URLs are noise
  }
}

/**
 * Get surrounding text context for a link
 */
function getSurroundingContext(anchor: HTMLAnchorElement, maxLength: number = 60): string {
  const parent = anchor.parentElement
  if (!parent) return ''

  const parentText = parent.textContent || ''
  const anchorText = anchor.textContent || ''
  const anchorIndex = parentText.indexOf(anchorText)

  if (anchorIndex === -1) return ''

  // Get text before and after the anchor
  const start = Math.max(0, anchorIndex - maxLength / 2)
  const end = Math.min(parentText.length, anchorIndex + anchorText.length + maxLength / 2)

  let context = parentText.slice(start, end).trim()
  if (start > 0) context = '...' + context
  if (end < parentText.length) context = context + '...'

  return context
}

/**
 * Extract links from HTML content before converting to markdown
 */
function extractLinksFromHtml(htmlContent: string, pageUrl: string): ExtractedLink[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')
  const anchors = doc.querySelectorAll('a[href]')
  const seen = new Set<string>()
  const links: ExtractedLink[] = []

  for (const anchor of anchors) {
    const href = (anchor as HTMLAnchorElement).href
    const text = (anchor.textContent || '').trim()

    // Skip empty links, non-http links, self-references, and duplicates
    if (!href || !text) continue
    if (!href.startsWith('http://') && !href.startsWith('https://')) continue
    if (href === pageUrl || href === pageUrl + '/') continue
    if (seen.has(href)) continue

    // Skip noise URLs
    if (isNoiseUrl(href)) continue

    // Skip very short or generic anchor text
    if (text.length < 3) continue
    if (['click here', 'read more', 'learn more', 'here', 'link'].includes(text.toLowerCase())) continue

    seen.add(href)
    links.push({
      url: href,
      text,
      context: getSurroundingContext(anchor as HTMLAnchorElement),
    })
  }

  return links
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
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element && element.textContent && element.textContent.trim().length > 200) {
      return element.innerHTML
    }
  }

  // Fall back to body
  return document.body.innerHTML
}

/**
 * Extract content with Readability.js as primary method,
 * falling back to CSS selector approach if Readability fails.
 */
function extractMarkdown(): { markdown: string, title: string, url: string, links: ExtractedLink[] } {
  // Try Readability.js first for better article extraction
  const readabilityResult = tryReadability()

  let content: string
  let title: string

  if (readabilityResult) {
    content = readabilityResult.content
    title = readabilityResult.title
  }
  else {
    // Fallback to CSS selector approach
    content = getMainContentFallback()
    title = document.title
  }

  // Extract links from HTML before converting to markdown
  const pageUrl = window.location.href
  const links = extractLinksFromHtml(content, pageUrl)

  const markdown = turndownService.turndown(content)

  return {
    markdown,
    title,
    url: pageUrl,
    links,
  }
}

// Listen for extraction requests from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const result = extractMarkdown()
    sendResponse(result)
  }
  return true
})

export { extractMarkdown }

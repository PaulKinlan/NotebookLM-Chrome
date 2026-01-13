/**
 * Markdown Renderer
 *
 * Converts markdown text to HTML with proper table support and formatting.
 * Uses the marked library for parsing.
 */

import { marked } from 'marked'
import DOMPurify, { Config } from 'dompurify'

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
})

// DOMPurify configuration for markdown content
const MARKDOWN_DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre',
    'ul', 'ol', 'li', 'a', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
    'del', 'sup', 'sub', 'input',
  ],
  ALLOWED_ATTR: ['href', 'class', 'type', 'checked', 'disabled'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed', 'svg', 'math'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'target'],
}

/**
 * Render markdown text to sanitized HTML
 */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false })
  return DOMPurify.sanitize(html, MARKDOWN_DOMPURIFY_CONFIG)
}

/**
 * Check if content appears to be HTML (for interactive transforms)
 */
export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith('<!DOCTYPE')
    || trimmed.startsWith('<html')
    || trimmed.startsWith('<div')
    || (trimmed.includes('<style>') && trimmed.includes('<div'))
}

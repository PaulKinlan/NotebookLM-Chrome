import DOMPurify, { Config } from 'dompurify'

/**
 * Get element by query selector, throwing if not found (for required elements)
 */
export function getRequiredQuerySelector<T extends HTMLElement>(
  selector: string,
  expectedType: { new (): T, prototype: HTMLElement },
  parent: ParentNode = document,
): T {
  const element = parent.querySelector(selector)
  if (element instanceof expectedType) {
    return element as T
  }
  throw new Error(`Required element "${selector}" not found or is not ${expectedType.name}`)
}

/**
 * Get element by ID, throwing if not found (for required elements)
 */
export function getRequiredElementById<T extends HTMLElement>(
  id: string,
  expectedType: { new (): T, prototype: HTMLElement },
): T {
  const element = document.getElementById(id)
  if (element instanceof expectedType) {
    return element as T
  }
  throw new Error(`Required element #${id} not found or is not ${expectedType.name}`)
}

// Configure DOMPurify with strict settings for AI-generated content
const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span',
    'div',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'], // Allow target for links
  FORBID_TAGS: [
    'script',
    'style',
    'iframe',
    'form',
    'input',
    'object',
    'embed',
    'svg',
    'math',
  ],
  FORBID_ATTR: [
    'onerror',
    'onclick',
    'onload',
    'onmouseover',
    'onfocus',
    'onblur',
  ],
}

// Hook to force safe link attributes
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Escape HTML special characters to prevent injection
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Sanitize HTML using DOMPurify with strict security settings
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG)
}

/**
 * Format markdown-style text to basic HTML
 * Note: This is a simple formatter. For complex markdown, use a dedicated library.
 */
export function formatMarkdown(text: string): string {
  // First escape HTML entities in the raw text to prevent injection
  const escaped = escapeHtml(text)

  // Then apply markdown formatting
  const formatted = escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  // Finally sanitize the result with DOMPurify
  return sanitizeHtml(formatted)
}

/**
 * Fullscreen Sandbox Script
 *
 * This script runs in a sandboxed page that is embedded as an iframe
 * within the fullscreen-wrapper page.
 *
 * Security architecture:
 * - This page is declared as a sandbox in manifest.json (permissive CSP for eval/inline scripts)
 * - Content is rendered in an inner iframe with sandbox="allow-scripts allow-forms"
 * - Content is loaded via srcdoc (inherits sandbox page's permissive CSP)
 * - The sandbox attribute on the inner iframe is the security boundary
 *
 * Communication:
 * - Receives content via postMessage from parent wrapper
 * - Sandboxed pages cannot use chrome.* APIs, hence the wrapper bridge
 */

// Make this file an ES module to avoid global scope conflicts
export {}

// Message types for postMessage communication (from wrapper parent)
interface SandboxContentMessage {
  type: 'SANDBOX_CONTENT'
  title: string
  content: string
  isInteractive: boolean
  theme?: 'light' | 'dark' | null
}

interface SandboxReadyMessage {
  type: 'SANDBOX_READY'
}

// Initialize - listen for content from parent wrapper
initializePostMessageListener()

function showError(message: string): void {
  const container = document.querySelector('.iframe-container')
  if (container) {
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error'
    errorDiv.textContent = message
    container.replaceChildren(errorDiv)
  }
}

function initializePostMessageListener(): void {
  // Listen for content from parent wrapper via postMessage
  window.addEventListener('message', (event: MessageEvent) => {
    // Only accept messages from parent window (the wrapper)
    if (event.source !== window.parent) {
      return
    }

    const data = event.data as SandboxContentMessage | undefined
    if (!data || data.type !== 'SANDBOX_CONTENT') {
      return
    }

    // Render content (title is displayed by the wrapper page)
    renderContent(data.content, data.isInteractive, data.theme)
  })

  // Signal to parent that we're ready to receive content
  window.parent.postMessage({
    type: 'SANDBOX_READY',
  } satisfies SandboxReadyMessage, '*')
}

function renderContent(content: string, isInteractive: boolean, theme?: 'light' | 'dark' | null): void {
  const iframe = document.getElementById('content-frame') as HTMLIFrameElement | null

  if (!iframe) {
    showError('Content frame not found')
    return
  }

  // Apply theme to this page's root element (for iframe background styling)
  if (theme === null || theme === undefined) {
    // System preference - remove attribute to let CSS media queries handle it
    document.documentElement.removeAttribute('data-theme')
  }
  else {
    document.documentElement.setAttribute('data-theme', theme)
  }

  // Wrap content in a full HTML document if needed
  const wrappedContent = wrapContent(content, isInteractive, theme)

  // Use srcdoc to load content - this inherits the sandbox page's permissive CSP
  // which allows inline scripts. The sandbox attribute on the iframe provides
  // the security boundary (restricts navigation, form submission, etc.)
  iframe.srcdoc = wrappedContent
}

function wrapContent(html: string, isInteractive: boolean, theme?: 'light' | 'dark' | null): string {
  const trimmed = html.trim()
  const lowerHtml = trimmed.toLowerCase()
  const hasDoctype = lowerHtml.startsWith('<!doctype')
  const hasHtmlTag = lowerHtml.includes('<html')

  // Determine data-theme attribute
  const themeAttr = theme ? ` data-theme="${theme}"` : ''

  if (hasDoctype || hasHtmlTag) {
    // Content is already a full document - inject theme attribute if we can
    if (theme && hasHtmlTag) {
      // Try to inject data-theme into existing <html> tag (works with DOCTYPE + html)
      return html.replace(/<html([^>]*)>/i, `<html$1${themeAttr}>`)
    }
    return html
  }

  // Content is a fragment - wrap in full document
  // For interactive content, we don't add restrictive CSP - the sandbox handles security
  // For non-interactive content, we add basic styling
  if (isInteractive) {
    return `<!DOCTYPE html>
<html lang="en"${themeAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>html, body { margin: 0; padding: 0; height: 100%; }</style>
</head>
<body>
${html}
</body>
</html>`
  }

  // Non-interactive content with theme-aware styling
  return `<!DOCTYPE html>
<html lang="en"${themeAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }

    /* Light theme (default) */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1em 0 0.5em; font-weight: 600; line-height: 1.3; }
    h1 { font-size: 1.8em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin: 0.75em 0; }
    pre { background: #f5f5f5; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 1em 0; }
    code { font-family: 'SF Mono', Monaco, monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre code { background: transparent; padding: 0; }
    ul, ol { margin: 0.75em 0; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    blockquote { border-left: 3px solid #6366f1; margin: 1em 0; padding: 0.5em 0 0.5em 1em; color: #666; background: #f8f8ff; border-radius: 0 6px 6px 0; }
    a { color: #6366f1; text-decoration: none; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }

    /* Dark theme (explicit) */
    html[data-theme="dark"] body {
      color: #e5e5e5;
      background: #1e1e2e;
    }
    html[data-theme="dark"] pre { background: #2a2a2a; }
    html[data-theme="dark"] code { background: #333; }
    html[data-theme="dark"] blockquote { background: #1a1a2e; color: #b0b0b0; }
    html[data-theme="dark"] th { background: #2a2a2a; }
    html[data-theme="dark"] th, html[data-theme="dark"] td { border-color: #444; }
    html[data-theme="dark"] hr { border-color: #444; }

    /* System preference fallback (when no explicit theme set) */
    @media (prefers-color-scheme: dark) {
      html:not([data-theme]) body {
        color: #e5e5e5;
        background: #1e1e2e;
      }
      html:not([data-theme]) pre { background: #2a2a2a; }
      html:not([data-theme]) code { background: #333; }
      html:not([data-theme]) blockquote { background: #1a1a2e; color: #b0b0b0; }
      html:not([data-theme]) th { background: #2a2a2a; }
      html:not([data-theme]) th, html:not([data-theme]) td { border-color: #444; }
      html:not([data-theme]) hr { border-color: #444; }
    }

    /* Print styles - override dark theme for printing */
    @media print {
      body { background: white !important; color: #1a1a1a !important; }
      pre { background: #f5f5f5 !important; }
      code { background: #f0f0f0 !important; }
      blockquote { background: #f8f8ff !important; color: #666 !important; }
      th { background: #f5f5f5 !important; }
      th, td { border-color: #ddd !important; }
      hr { border-color: #ddd !important; }
    }
  </style>
</head>
<body>
${html}
</body>
</html>`
}

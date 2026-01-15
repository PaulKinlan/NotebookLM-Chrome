/**
 * Fullscreen Sandbox Script
 *
 * This script runs in a sandboxed page opened as a new tab.
 * It receives content via BroadcastChannel and renders it in a sandboxed iframe.
 *
 * Security architecture:
 * - This page is declared as a sandbox in manifest.json (permissive CSP)
 * - Content is rendered in an inner iframe with sandbox="allow-scripts allow-forms"
 * - Content is loaded via blob URL (not srcdoc to have independent CSP)
 * - The sandbox attribute on the inner iframe is the security boundary
 */

// Message types for BroadcastChannel communication
interface FullscreenReadyMessage {
  type: 'FULLSCREEN_READY'
  channelId: string
}

interface FullscreenContentMessage {
  type: 'FULLSCREEN_CONTENT'
  title: string
  content: string
  isInteractive: boolean
}

// Get channel ID from URL hash
const channelId = window.location.hash.slice(1)

if (!channelId) {
  showError('Missing channel ID in URL')
}
else {
  initializeChannel(channelId)
}

function showError(message: string): void {
  const container = document.querySelector('.iframe-container')
  if (container) {
    // Create error element safely using DOM methods
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error'
    errorDiv.textContent = message
    container.replaceChildren(errorDiv)
  }
}

function initializeChannel(channelId: string): void {
  const channel = new BroadcastChannel(channelId)

  // Listen for content
  channel.onmessage = (event: MessageEvent) => {
    const data = event.data as FullscreenContentMessage | undefined
    if (!data || data.type !== 'FULLSCREEN_CONTENT') {
      return
    }

    // Update title
    const titleEl = document.getElementById('title')
    if (titleEl) {
      titleEl.textContent = data.title
    }
    document.title = `${data.title} - FolioLM`

    // Render content
    renderContent(data.content, data.isInteractive)

    // Clean up channel after receiving content
    channel.close()
  }

  // Signal that we're ready to receive content
  channel.postMessage({
    type: 'FULLSCREEN_READY',
    channelId,
  } satisfies FullscreenReadyMessage)
}

function renderContent(content: string, isInteractive: boolean): void {
  const iframe = document.getElementById('content-frame') as HTMLIFrameElement | null

  if (!iframe) {
    showError('Content frame not found')
    return
  }

  // Wrap content in a full HTML document if needed
  const wrappedContent = wrapContent(content, isInteractive)

  // Create blob URL for the content
  // Using blob URL (not srcdoc) ensures content has its own CSP context
  // The sandbox attribute on the iframe is the security boundary
  const blob = new Blob([wrappedContent], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)

  iframe.src = blobUrl

  // Clean up blob URL after load
  iframe.addEventListener('load', () => {
    // Delay cleanup to ensure content is fully rendered
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
    }, 1000)
  }, { once: true })
}

function wrapContent(html: string, isInteractive: boolean): string {
  const trimmed = html.trim()
  const hasDoctype = trimmed.toLowerCase().startsWith('<!doctype')
  const hasHtml = trimmed.toLowerCase().startsWith('<html')

  if (hasDoctype || hasHtml) {
    // Content is already a full document
    return html
  }

  // Content is a fragment - wrap in full document
  // For interactive content, we don't add restrictive CSP - the sandbox handles security
  // For non-interactive content, we add basic styling
  if (isInteractive) {
    return `<!DOCTYPE html>
<html lang="en">
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

  // Non-interactive content with styling
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1a1a1a;
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
  </style>
</head>
<body>
${html}
</body>
</html>`
}

/**
 * Fullscreen Wrapper Script (Bridge)
 *
 * This script runs in a standard extension page (NOT sandboxed).
 * It acts as a bridge between the side panel and the sandboxed iframe.
 *
 * Architecture:
 * Side Panel ──chrome.tabs.sendMessage──> Wrapper (this page) ──postMessage──> Sandbox (iframe)
 *
 * Why this pattern:
 * - Sandboxed pages cannot use chrome.* APIs
 * - This wrapper page IS an extension page, so it CAN use chrome.runtime.onMessage
 * - The wrapper then forwards content to the sandboxed iframe via postMessage
 * - The sandboxed page has permissive CSP allowing inline scripts in blob URLs
 */

// Make this file an ES module to avoid global scope conflicts
export {}

// Message type for content from side panel (via chrome.runtime.onMessage)
interface FullscreenContentMessage {
  type: 'FULLSCREEN_CONTENT'
  title: string
  content: string
  isInteractive: boolean
  theme?: 'light' | 'dark' | null
}

// Message types for postMessage communication (to/from sandbox iframe)
interface SandboxReadyMessage {
  type: 'SANDBOX_READY'
}

interface SandboxContentMessage {
  type: 'SANDBOX_CONTENT'
  title: string
  content: string
  isInteractive: boolean
  theme?: 'light' | 'dark' | null
}

// Initialize bridge
initializeBridge()

function showError(message: string): void {
  const container = document.querySelector('.iframe-container')
  if (container) {
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error'
    errorDiv.textContent = message
    container.replaceChildren(errorDiv)
  }
}

function initializeBridge(): void {
  const sandboxFrame = document.getElementById('sandbox-frame') as HTMLIFrameElement | null

  if (!sandboxFrame) {
    showError('Sandbox frame not found')
    return
  }

  // Set the sandbox frame src to the sandboxed page using absolute URL
  const sandboxUrl = chrome.runtime.getURL('src/sandbox/fullscreen-sandbox.html')
  sandboxFrame.src = sandboxUrl

  // Store content until sandbox is ready
  let pendingContent: FullscreenContentMessage | null = null
  let sandboxReady = false

  // Listen for messages from the sandboxed iframe via postMessage
  window.addEventListener('message', (event: MessageEvent) => {
    // Verify the message is from our iframe
    if (event.source !== sandboxFrame.contentWindow) {
      return
    }

    const data = event.data as SandboxReadyMessage | undefined
    if (data?.type === 'SANDBOX_READY') {
      sandboxReady = true

      // If we have pending content, send it now
      if (pendingContent) {
        forwardContentToSandbox(sandboxFrame, pendingContent)
        pendingContent = null
      }
    }
  })

  // Listen for content from the side panel via chrome.runtime.onMessage
  chrome.runtime.onMessage.addListener((
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const data = message as FullscreenContentMessage | undefined
    if (!data || data.type !== 'FULLSCREEN_CONTENT') {
      return false
    }

    // Update title in wrapper
    const titleEl = document.getElementById('title')
    if (titleEl) {
      titleEl.textContent = data.title
    }
    document.title = `${data.title} - FolioLM`

    // Apply theme to wrapper page
    if (data.theme === null || data.theme === undefined) {
      // System preference - remove attribute to let CSS media queries handle it
      document.documentElement.removeAttribute('data-theme')
    }
    else {
      document.documentElement.setAttribute('data-theme', data.theme)
    }

    // Forward to sandbox or store for later
    if (sandboxReady) {
      forwardContentToSandbox(sandboxFrame, data)
    }
    else {
      pendingContent = data
    }

    // Acknowledge receipt
    sendResponse({ success: true })
    return true
  })
}

function forwardContentToSandbox(
  iframe: HTMLIFrameElement,
  content: FullscreenContentMessage,
): void {
  // Forward content to sandbox via postMessage
  // The sandbox iframe listens for SANDBOX_CONTENT messages
  iframe.contentWindow?.postMessage({
    type: 'SANDBOX_CONTENT',
    title: content.title,
    content: content.content,
    isInteractive: content.isInteractive,
    theme: content.theme,
  } satisfies SandboxContentMessage, '*')
}

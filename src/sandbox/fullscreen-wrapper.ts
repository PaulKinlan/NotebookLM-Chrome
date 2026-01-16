/**
 * Fullscreen Wrapper Script (Bridge)
 *
 * This script runs in a standard extension page (NOT sandboxed).
 * It acts as a bridge between the side panel and the sandboxed iframe.
 *
 * Architecture:
 * Side Panel ──BroadcastChannel──> Wrapper (this page) ──postMessage──> Sandbox (iframe)
 *
 * Why this pattern:
 * - Sandboxed pages cannot use BroadcastChannel to communicate with extension pages
 * - This wrapper page IS an extension page, so it CAN use BroadcastChannel
 * - The wrapper then forwards content to the sandboxed iframe via postMessage
 */

// Make this file an ES module to avoid global scope conflicts
export {}

// Message types for BroadcastChannel communication (from side panel)
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

// Message types for postMessage communication (to/from sandbox iframe)
interface SandboxReadyMessage {
  type: 'SANDBOX_READY'
}

interface SandboxContentMessage {
  type: 'SANDBOX_CONTENT'
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
  initializeBridge(channelId)
}

function showError(message: string): void {
  const container = document.querySelector('.iframe-container')
  if (container) {
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error'
    errorDiv.textContent = message
    container.replaceChildren(errorDiv)
  }
}

function initializeBridge(channelId: string): void {
  const sandboxFrame = document.getElementById('sandbox-frame') as HTMLIFrameElement | null

  if (!sandboxFrame) {
    showError('Sandbox frame not found')
    return
  }

  // Create BroadcastChannel to communicate with side panel
  const channel = new BroadcastChannel(channelId)

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

  // Listen for content from the side panel via BroadcastChannel
  channel.onmessage = (event: MessageEvent) => {
    const data = event.data as FullscreenContentMessage | undefined
    if (!data || data.type !== 'FULLSCREEN_CONTENT') {
      return
    }

    // Update title in wrapper
    const titleEl = document.getElementById('title')
    if (titleEl) {
      titleEl.textContent = data.title
    }
    document.title = `${data.title} - FolioLM`

    // Forward to sandbox or store for later
    if (sandboxReady) {
      forwardContentToSandbox(sandboxFrame, data)
    }
    else {
      pendingContent = data
    }

    // Clean up channel after receiving content
    channel.close()
  }

  // Signal to the side panel that we're ready to receive content
  channel.postMessage({
    type: 'FULLSCREEN_READY',
    channelId,
  } satisfies FullscreenReadyMessage)
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
  } satisfies SandboxContentMessage, '*')
}

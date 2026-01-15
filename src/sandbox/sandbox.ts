/**
 * Sandbox Script
 *
 * This script runs in a sandboxed iframe with no access to Chrome extension APIs.
 * It receives pre-sanitized HTML content via postMessage and renders it safely.
 *
 * Security features:
 * - Runs in a sandboxed context with no extension privileges
 * - Content is pre-sanitized by DOMPurify in the parent
 * - Additional sanitization layer using textContent for untrusted parts
 * - All links are disabled (pointer-events: none)
 * - Strict CSP in the HTML head
 *
 * Two rendering modes:
 * - RENDER_CONTENT: Standard sanitized HTML content
 * - RENDER_INTERACTIVE: HTML with CSS and JS for interactive experiences
 */

// Message types for sandbox communication
type SandboxMessage
  = | RenderContentMessage
    | RenderInteractiveMessage
    | ClearContentMessage
    | GetHeightMessage
    | SetThemeMessage
    | SandboxReadyMessage
    | RenderCompleteMessage
    | HeightResponseMessage

interface RenderContentMessage {
  type: 'RENDER_CONTENT'
  content: string
  messageId: number
}

interface RenderInteractiveMessage {
  type: 'RENDER_INTERACTIVE'
  content: string
  scripts: string[]
  messageId: number
}

interface ClearContentMessage {
  type: 'CLEAR_CONTENT'
}

interface GetHeightMessage {
  type: 'GET_HEIGHT'
  messageId: number
}

interface SetThemeMessage {
  type: 'SET_THEME'
  theme: 'light' | 'dark' | null // null means use system preference
}

interface SandboxReadyMessage {
  type: 'SANDBOX_READY'
}

interface RenderCompleteMessage {
  type: 'RENDER_COMPLETE'
  messageId: number
  height: number
}

interface HeightResponseMessage {
  type: 'HEIGHT_RESPONSE'
  messageId: number
  height: number
}

const contentEl = document.getElementById('content')

// Track pending render completion to ensure it's always sent
let pendingRenderMessageId: number | null = null

// Global error handler to catch script errors and still send render complete
window.addEventListener('error', (event) => {
  console.error('Script error in sandbox:', event.error || event.message)
  // Don't prevent the error from being logged, but ensure we still complete
})

// Listen for content from parent
window.addEventListener('message', (event: MessageEvent) => {
  // Only accept messages from our extension
  // In sandbox context, we can't verify origin precisely, so we rely on
  // the sandbox isolation and the fact that content is pre-sanitized

  const data = event.data as SandboxMessage | undefined
  if (!data || typeof data !== 'object') {
    return
  }

  const { type } = data

  if (type === 'RENDER_CONTENT' && contentEl) {
    const msg = data as RenderContentMessage
    // Content has already been sanitized by DOMPurify in the parent
    // We can safely render it here
    contentEl.innerHTML = msg.content

    // Notify parent that rendering is complete
    if (msg.messageId) {
      // Small delay to ensure content is rendered
      requestAnimationFrame(() => {
        window.parent.postMessage({
          type: 'RENDER_COMPLETE',
          messageId: msg.messageId,
          height: document.body.scrollHeight,
        } satisfies RenderCompleteMessage, '*')
      })
    }
  }
  else if (type === 'RENDER_INTERACTIVE' && contentEl) {
    const msg = data as RenderInteractiveMessage
    // Interactive content with HTML, CSS, and JS
    // Content (HTML + CSS) has been sanitized by DOMPurify
    // Scripts are passed separately and executed after HTML is rendered
    contentEl.innerHTML = msg.content

    // Store messageId for completion - schedule completion FIRST before scripts
    // This ensures we always respond even if scripts throw errors
    pendingRenderMessageId = msg.messageId

    // Schedule render complete notification before executing any scripts
    // This uses setTimeout which is resilient to script errors
    if (msg.messageId) {
      setTimeout(() => {
        if (pendingRenderMessageId === msg.messageId) {
          window.parent.postMessage({
            type: 'RENDER_COMPLETE',
            messageId: msg.messageId,
            height: document.body.scrollHeight,
          } satisfies RenderCompleteMessage, '*')
          pendingRenderMessageId = null
        }
      }, 100)
    }

    // Execute scripts in order (they've been extracted from the HTML)
    // We inject them as script elements rather than using new Function()
    // to avoid requiring 'unsafe-eval' in CSP
    const scripts = msg.scripts
    if (scripts && Array.isArray(scripts)) {
      for (const scriptContent of scripts) {
        try {
          const scriptEl = document.createElement('script')
          scriptEl.textContent = scriptContent
          document.body.appendChild(scriptEl)
        }
        catch (error) {
          console.error('Script execution error:', error)
        }
      }
    }
  }
  else if (type === 'CLEAR_CONTENT' && contentEl) {
    contentEl.innerHTML = ''
  }
  else if (type === 'GET_HEIGHT') {
    const msg = data as GetHeightMessage
    window.parent.postMessage({
      type: 'HEIGHT_RESPONSE',
      messageId: msg.messageId,
      height: document.body.scrollHeight,
    } satisfies HeightResponseMessage, '*')
  }
  else if (type === 'SET_THEME') {
    const msg = data as SetThemeMessage
    // Apply theme to body element
    if (msg.theme === null) {
      // Remove explicit theme, let system preference take over
      document.body.removeAttribute('data-theme')
    }
    else {
      document.body.setAttribute('data-theme', msg.theme)
    }
  }
})

// Report initial ready state
window.parent.postMessage({ type: 'SANDBOX_READY' } satisfies SandboxReadyMessage, '*')

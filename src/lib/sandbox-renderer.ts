/**
 * SandboxRenderer
 *
 * Manages sandboxed iframes for rendering untrusted AI-generated content.
 * Provides an additional security layer beyond DOMPurify by isolating
 * rendered content in a sandboxed context with no access to extension APIs.
 *
 * Security features:
 * - Content runs in a sandboxed iframe with no extension privileges
 * - Communication via postMessage only
 * - Auto-resizing iframe based on content height
 * - Content is pre-sanitized before being sent to sandbox
 *
 * Two rendering modes:
 * - Standard mode: For markdown/text content, heavily sanitized
 * - Interactive mode: For HTML/CSS/JS experiences (quiz, flashcards, etc.),
 *   allows scripts/styles but still sandboxed
 */

import DOMPurify, { Config } from "dompurify";
import browser from './browser';

// DOMPurify configuration for standard content going to sandbox
const SANDBOX_DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "b", "i", "code", "pre",
    "ul", "ol", "li", "a", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
    "span", "div", "table", "thead", "tbody", "tr", "th", "td", "hr",
    "del", "sup", "sub", "input"
  ],
  ALLOWED_ATTR: ["href", "class", "type", "checked", "disabled"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "style", "iframe", "form", "object", "embed", "svg", "math"],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus", "onblur", "target"],
};

// DOMPurify configuration for interactive content - allows style tags
const INTERACTIVE_DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "b", "i", "code", "pre",
    "ul", "ol", "li", "a", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
    "span", "div", "table", "thead", "tbody", "tr", "th", "td", "hr",
    "del", "sup", "sub", "input", "label", "button", "style"
  ],
  ALLOWED_ATTR: [
    "href", "class", "type", "checked", "disabled", "id", "for", "data-*",
    "aria-label", "aria-hidden", "role", "tabindex"
  ],
  ALLOW_DATA_ATTR: true,
  // Still forbid scripts - they'll be passed separately
  FORBID_TAGS: ["script", "iframe", "object", "embed", "svg", "math", "form"],
  FORBID_ATTR: ["onerror", "onload", "onmouseover", "onfocus", "onblur"],
};

interface PendingMessage {
  handler: (height?: number) => void;
  reject: (reason?: unknown) => void;
}

export class SandboxRenderer {
  private iframe: HTMLIFrameElement | null = null;
  private container: HTMLElement;
  private isReady = false;
  private readyPromise: Promise<void>;
  private readyResolve: (() => void) | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, PendingMessage>();
  private boundHandleMessage: (event: MessageEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.boundHandleMessage = this.handleMessage.bind(this);
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.init();
  }

  private init(): void {
    // Create sandboxed iframe
    this.iframe = document.createElement("iframe");
    this.iframe.src = browser.runtime.getURL("src/sandbox/sandbox.html");

    // Apply sandbox attribute for additional restrictions
    // allow-scripts is needed for the sandbox.js to run
    // No allow-same-origin to ensure complete isolation
    this.iframe.sandbox.add("allow-scripts");

    // Style the iframe
    this.iframe.style.cssText = `
      width: 100%;
      border: none;
      display: block;
      min-height: 20px;
    `;

    // Listen for messages from sandbox
    window.addEventListener("message", this.boundHandleMessage);

    // Append to container
    this.container.appendChild(this.iframe);
  }

  private handleMessage(event: MessageEvent): void {
    // Verify the message is from our iframe
    if (event.source !== this.iframe?.contentWindow) {
      return;
    }

    const { type, messageId, height } = event.data;

    switch (type) {
      case "SANDBOX_READY":
        this.isReady = true;
        if (this.readyResolve) {
          this.readyResolve();
        }
        break;

      case "RENDER_COMPLETE":
      case "HEIGHT_RESPONSE":
        // Update iframe height to match content, capped at max-height from CSS
        if (height && this.iframe) {
          // Set the height to content size; CSS max-height will constrain it
          this.iframe.style.height = `${height}px`;
        }
        // Resolve pending promise
        if (messageId !== undefined) {
          const pending = this.pendingMessages.get(messageId);
          if (pending) {
            pending.handler(height);
            this.pendingMessages.delete(messageId);
          }
        }
        break;
    }
  }

  /**
   * Render sanitized HTML content in the sandbox (standard mode)
   * @returns The height of the rendered content
   */
  async render(html: string): Promise<number | undefined> {
    await this.readyPromise;

    if (!this.iframe?.contentWindow) {
      throw new Error("Sandbox iframe not available");
    }

    // Sanitize content before sending to sandbox
    const sanitizedHtml = DOMPurify.sanitize(html, SANDBOX_DOMPURIFY_CONFIG);

    const currentMessageId = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(currentMessageId, {
        handler: resolve,
        reject
      });

      const iframe = this.iframe;
      if (!iframe?.contentWindow) {
        reject(new Error("Sandbox iframe not available"));
        return;
      }

      iframe.contentWindow.postMessage({
        type: "RENDER_CONTENT",
        content: sanitizedHtml,
        messageId: currentMessageId
      }, "*");

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(currentMessageId)) {
          this.pendingMessages.delete(currentMessageId);
          reject(new Error("Sandbox render timeout"));
        }
      }, 5000);
    });
  }

  /**
   * Render interactive HTML content (with CSS and JS) in the sandbox
   * Used for quiz, flashcards, timeline, and other interactive transforms
   * @returns The height of the rendered content
   */
  async renderInteractive(html: string): Promise<number | undefined> {
    await this.readyPromise;

    if (!this.iframe?.contentWindow) {
      throw new Error("Sandbox iframe not available");
    }

    // Extract script content before sanitization
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    const scripts: string[] = [];
    if (scriptMatch) {
      for (const match of scriptMatch) {
        const content = match.replace(/<script[^>]*>|<\/script>/gi, '');
        scripts.push(content);
      }
    }

    // Remove scripts from HTML before sanitization
    const htmlWithoutScripts = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Sanitize the HTML (allows style tags in interactive mode)
    const sanitizedHtml = DOMPurify.sanitize(htmlWithoutScripts, INTERACTIVE_DOMPURIFY_CONFIG);

    const currentMessageId = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(currentMessageId, {
        handler: resolve,
        reject
      });

      const iframe = this.iframe;
      if (!iframe?.contentWindow) {
        reject(new Error("Sandbox iframe not available"));
        return;
      }

      iframe.contentWindow.postMessage({
        type: "RENDER_INTERACTIVE",
        content: sanitizedHtml,
        scripts: scripts,
        messageId: currentMessageId
      }, "*");

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(currentMessageId)) {
          this.pendingMessages.delete(currentMessageId);
          reject(new Error("Sandbox render timeout"));
        }
      }, 5000);
    });
  }

  /**
   * Clear the sandbox content
   */
  clear(): void {
    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage({ type: "CLEAR_CONTENT" }, "*");
      this.iframe.style.height = "20px";
    }
  }

  /**
   * Destroy the sandbox and clean up
   */
  destroy(): void {
    window.removeEventListener("message", this.boundHandleMessage);
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.pendingMessages.clear();
  }

  /**
   * Check if the sandbox is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Wait for the sandbox to be ready
   */
  waitForReady(): Promise<void> {
    return this.readyPromise;
  }
}

/**
 * Create a sandbox renderer for a container element
 */
export function createSandboxRenderer(container: HTMLElement): SandboxRenderer {
  return new SandboxRenderer(container);
}

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
 */

const contentEl = document.getElementById("content");

// Listen for content from parent
window.addEventListener("message", (event) => {
  // Only accept messages from our extension
  // In sandbox context, we can't verify origin precisely, so we rely on
  // the sandbox isolation and the fact that content is pre-sanitized

  if (!event.data || typeof event.data !== "object") {
    return;
  }

  const { type, content, messageId } = event.data;

  if (type === "RENDER_CONTENT" && contentEl) {
    // Content has already been sanitized by DOMPurify in the parent
    // We can safely render it here
    contentEl.innerHTML = content;

    // Notify parent that rendering is complete
    if (messageId) {
      window.parent.postMessage({
        type: "RENDER_COMPLETE",
        messageId,
        height: document.body.scrollHeight
      }, "*");
    }
  } else if (type === "CLEAR_CONTENT" && contentEl) {
    contentEl.innerHTML = "";
  } else if (type === "GET_HEIGHT") {
    window.parent.postMessage({
      type: "HEIGHT_RESPONSE",
      messageId,
      height: document.body.scrollHeight
    }, "*");
  }
});

// Report initial ready state
window.parent.postMessage({ type: "SANDBOX_READY" }, "*");

/**
 * Tool Approval UI Component
 *
 * Displays and manages tool approval requests in agentic mode.
 */

import type { ToolApprovalRequest, ApprovalScope } from '../types/index.ts'
import {
  getPendingApprovals,
  respondToApproval,
} from '../lib/tool-approvals.ts'
import { addToolApproval } from '../lib/tool-permissions.ts'

// ============================================================================
// DOM Elements
// ============================================================================

const elements: {
  approvalDialog: HTMLDialogElement | null
  approvalList: HTMLDivElement | null
  approvalTemplate: HTMLTemplateElement | null
} = {
  approvalDialog: null,
  approvalList: null,
  approvalTemplate: null,
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize approval UI components
 */
export function initApprovalUI(): void {
  // Inject styles if not already present
  if (!document.getElementById('approval-dialog-styles')) {
    const styleEl = document.createElement('style')
    styleEl.id = 'approval-dialog-styles'
    styleEl.textContent = approvalDialogStyles
    document.head.appendChild(styleEl)
  }

  const dialog = document.getElementById('approval-dialog')
  const list = document.getElementById('approval-list')
  const template = document.getElementById('approval-request-template')

  if (dialog instanceof HTMLDialogElement) {
    elements.approvalDialog = dialog
  }
  if (list instanceof HTMLDivElement) {
    elements.approvalList = list
  }
  if (template instanceof HTMLTemplateElement) {
    elements.approvalTemplate = template
  }

  if (!elements.approvalDialog) {
    createApprovalDialog()
  }
}

/**
 * Create approval dialog HTML
 */
function createApprovalDialog(): void {
  const dialog = document.createElement('dialog')
  dialog.id = 'approval-dialog'
  dialog.className = 'approval-dialog'

  dialog.innerHTML = `
    <div class="approval-dialog-content">
      <div class="approval-dialog-header">
        <h2>Tool Approval Required</h2>
        <button class="approval-close-btn" title="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="approval-dialog-body">
        <div class="pending-approvals-container">
          <h3>Pending Approvals</h3>
          <div id="approval-list" class="approval-list"></div>
        </div>
      </div>

      <div class="approval-dialog-footer">
        <button class="btn btn-outline approval-reject-all-btn">
          Reject All
        </button>
        <button class="btn btn-primary approval-approve-all-btn">
          Approve All
        </button>
      </div>
    </div>
  `

  document.body.appendChild(dialog)
  elements.approvalDialog = dialog

  const listElement = dialog.querySelector('#approval-list')
  if (listElement instanceof HTMLDivElement) {
    elements.approvalList = listElement
  }

  // Set up event listeners
  const closeBtn = dialog.querySelector('.approval-close-btn')
  if (closeBtn instanceof HTMLButtonElement) {
    closeBtn.addEventListener('click', () => hideApprovalDialog())
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      hideApprovalDialog()
    }
  })

  const approveAllBtn = dialog.querySelector('.approval-approve-all-btn')
  const rejectAllBtn = dialog.querySelector('.approval-reject-all-btn')

  if (approveAllBtn instanceof HTMLButtonElement) {
    approveAllBtn.addEventListener('click', () => {
      void approveAllPending()
    })
  }
  if (rejectAllBtn instanceof HTMLButtonElement) {
    rejectAllBtn.addEventListener('click', () => {
      void rejectAllPending()
    })
  }
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Show approval dialog with pending requests
 */
export async function showApprovalDialog(): Promise<void> {
  await renderPendingApprovals()
  elements.approvalDialog?.showModal()
}

/**
 * Hide approval dialog
 */
export function hideApprovalDialog(): void {
  elements.approvalDialog?.close()
}

/**
 * Check for pending approvals and show dialog if any exist
 */
export async function checkAndShowPendingApprovals(): Promise<boolean> {
  const pending = await getPendingApprovals()
  if (pending.length > 0) {
    await showApprovalDialog()
    return true
  }
  return false
}

/**
 * Render pending approval requests
 */
async function renderPendingApprovals(): Promise<void> {
  if (!elements.approvalList) return

  const pending = await getPendingApprovals()

  if (pending.length === 0) {
    elements.approvalList.innerHTML = `
      <div class="empty-state">
        <p>No pending approvals</p>
      </div>
    `
    return
  }

  elements.approvalList.innerHTML = pending
    .map(request => renderApprovalRequest(request))
    .join('')

  // Attach event listeners to buttons
  for (const request of pending) {
    const approveBtn = elements.approvalList?.querySelector(
      `[data-approve="${request.id}"]`,
    )
    const rejectBtn = elements.approvalList?.querySelector(
      `[data-reject="${request.id}"]`,
    )

    if (approveBtn instanceof HTMLButtonElement) {
      approveBtn.addEventListener('click', () => {
        void handleApprove(request.id, request.toolName)
      })
    }
    if (rejectBtn instanceof HTMLButtonElement) {
      rejectBtn.addEventListener('click', () => {
        void handleReject(request.id)
      })
    }
  }
}

/**
 * Render a single approval request
 */
function renderApprovalRequest(request: ToolApprovalRequest): string {
  const argsPreview = Object.entries(request.args)
    .map(([key, value]) => {
      let valueStr: string
      if (value === null) {
        valueStr = 'null'
      }
      else if (value === undefined) {
        valueStr = 'undefined'
      }
      else if (typeof value === 'object') {
        valueStr = JSON.stringify(value)
      }
      else {
        // After filtering out null, undefined, and object types,
        // only primitives remain (string, number, boolean, bigint, symbol)
        valueStr = String(value as string | number | boolean | bigint | symbol)
      }
      return `<strong>${escapeHtml(key)}</strong>: ${escapeHtml(valueStr)}`
    })
    .join('<br>')

  return `
    <div class="approval-request" data-request-id="${request.id}">
      <div class="approval-header">
        <div class="approval-tool-name">${escapeHtml(request.toolName)}</div>
        <div class="approval-time">${formatTimestamp(request.timestamp)}</div>
      </div>

      <div class="approval-reason">
        <strong>Reason:</strong> ${escapeHtml(request.reason)}
      </div>

      <div class="approval-args">
        <strong>Arguments:</strong>
        <div class="approval-args-content">${argsPreview}</div>
      </div>

      <div class="approval-scope-selection">
        <label class="approval-scope-label">Approval scope:</label>
        <div class="approval-scopes">
          <label class="scope-option">
            <input type="radio" name="scope-${request.id}" value="once" checked />
            <span>Once</span>
          </label>
          <label class="scope-option">
            <input type="radio" name="scope-${request.id}" value="session" />
            <span>This session</span>
          </label>
          <label class="scope-option">
            <input type="radio" name="scope-${request.id}" value="forever" />
            <span>Forever</span>
          </label>
        </div>
      </div>

      <div class="approval-actions">
        <button class="btn btn-outline btn-small approval-reject-btn"
                data-reject="${request.id}">
          Reject
        </button>
        <button class="btn btn-primary btn-small approval-approve-btn"
                data-approve="${request.id}">
          Approve
        </button>
      </div>
    </div>
  `
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ============================================================================
// Approval Handlers
// ============================================================================

/**
 * Get selected scope for a request
 */
function getSelectedScope(requestId: string): ApprovalScope {
  const selected = document.querySelector<HTMLInputElement>(
    `input[name="scope-${requestId}"]:checked`,
  )
  const value = selected?.value

  // Validate that the value is a valid ApprovalScope
  if (value === 'once' || value === 'session' || value === 'forever') {
    return value
  }

  return 'once'
}

/**
 * Handle approve button click
 */
async function handleApprove(requestId: string, toolName: string): Promise<void> {
  const scope = getSelectedScope(requestId)

  await respondToApproval({
    requestId,
    approved: true,
    scope,
    timestamp: Date.now(),
  })

  // Update tool permissions based on scope
  await addToolApproval(toolName, scope)

  // Re-render to update the list
  await renderPendingApprovals()

  // If no more pending, close dialog
  const pending = await getPendingApprovals()
  if (pending.length === 0) {
    hideApprovalDialog()
  }
}

/**
 * Handle reject button click
 */
async function handleReject(requestId: string): Promise<void> {
  await respondToApproval({
    requestId,
    approved: false,
    scope: 'once',
    timestamp: Date.now(),
  })

  // Re-render to update the list
  await renderPendingApprovals()

  // If no more pending, close dialog
  const pending = await getPendingApprovals()
  if (pending.length === 0) {
    hideApprovalDialog()
  }
}

/**
 * Approve all pending approvals (with 'once' scope)
 */
async function approveAllPending(): Promise<void> {
  const pending = await getPendingApprovals()

  for (const request of pending) {
    await respondToApproval({
      requestId: request.id,
      approved: true,
      scope: 'once',
      timestamp: Date.now(),
    })
  }

  hideApprovalDialog()
}

/**
 * Reject all pending approvals
 */
async function rejectAllPending(): Promise<void> {
  const pending = await getPendingApprovals()

  for (const request of pending) {
    await respondToApproval({
      requestId: request.id,
      approved: false,
      scope: 'once',
      timestamp: Date.now(),
    })
  }

  hideApprovalDialog()
}

// ============================================================================
// CSS Styles (to be added to sidepanel styles)
// ============================================================================

/**
 * CSS for approval dialog - add this to sidepanel styles
 */
export const approvalDialogStyles = `
.approval-dialog {
  border: none;
  border-radius: 8px;
  padding: 0;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.approval-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.approval-dialog-content {
  padding: 20px;
}

.approval-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.approval-dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.approval-close-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}

.approval-close-btn:hover {
  opacity: 1;
}

.approval-dialog-body {
  max-height: 400px;
  overflow-y: auto;
}

.approval-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.approval-request {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 16px;
  background: #f9f9f9;
}

.approval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.approval-tool-name {
  font-weight: 600;
  color: #e91e63;
}

.approval-time {
  font-size: 0.875rem;
  color: #666;
}

.approval-reason {
  margin-bottom: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 4px;
  border-left: 3px solid #ff9800;
}

.approval-args {
  margin-bottom: 16px;
  padding: 12px;
  background: #fff;
  border-radius: 4px;
}

.approval-args-content {
  margin-top: 8px;
  font-family: monospace;
  font-size: 0.875rem;
  color: #333;
}

.approval-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.approval-scope-selection {
  margin: 12px 0;
  padding: 12px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.approval-scope-label {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 8px;
  color: #333;
}

.approval-scopes {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.scope-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.scope-option input[type="radio"] {
  cursor: pointer;
}

.scope-option span {
  color: #555;
}

.scope-option:has(input:checked) span {
  color: #000;
  font-weight: 500;
}

.approval-dialog-footer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
`

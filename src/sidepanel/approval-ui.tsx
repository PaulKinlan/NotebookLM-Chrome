/**
 * Tool Approval UI Component
 *
 * JSX components for displaying and managing tool approval requests in agentic mode.
 */

import type { ToolApprovalRequest, ApprovalScope } from '../types/index.ts'
import {
  getPendingApprovals,
  getApprovalRequest,
  respondToApproval,
  pendingApprovalEvents,
  updateApprovalStatus,
} from '../lib/tool-approvals.ts'
import { addToolApproval } from '../lib/tool-permissions.ts'

// ============================================================================
// Styles (using CSS objects for JSX runtime)
// ============================================================================

const STYLES = {
  approvalCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  toolName: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#f57c00',
  },
  reason: {
    padding: '10px 12px',
    background: 'rgba(255, 193, 7, 0.15)',
    borderRadius: '6px',
    fontSize: '13px',
    borderLeft: '3px solid #ffc107',
  },
  args: {
    padding: '10px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    fontSize: '12px',
  },
  argsLabel: {
    fontWeight: '600',
    marginBottom: '6px',
    color: 'var(--text-secondary)',
  },
  argsContent: {
    fontFamily: '\'SF Mono\', Consolas, \'Liberation Mono\', Menlo, monospace',
    lineHeight: '1.5',
    color: 'var(--text-primary)',
  },
  argRow: {
    marginBottom: '4px',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  button: {
    flex: '1',
    minWidth: '100px',
    fontSize: '12px',
    padding: '8px 12px',
  },
  buttonReject: {
    borderColor: 'var(--error)',
    color: 'var(--error)',
  },
  approved: {
    padding: '12px 16px',
    borderRadius: '6px',
    background: 'rgba(76, 175, 80, 0.1)',
    borderLeft: '3px solid var(--success)',
  },
  rejected: {
    padding: '12px 16px',
    borderRadius: '6px',
    background: 'rgba(248, 81, 73, 0.1)',
    borderLeft: '3px solid var(--error)',
  },
  statusText: {
    fontSize: '13px',
  },
} as const

// ============================================================================
// Components
// ============================================================================

interface ApprovalCardProps {
  request: ToolApprovalRequest
  onAction: (requestId: string, approved: boolean, scope: ApprovalScope) => void | Promise<void>
}

function ApprovalCard({ request, onAction }: ApprovalCardProps): Node {
  const argRows: Node[] = []

  for (const [key, value] of Object.entries(request.args)) {
    let valueStr: string
    if (typeof value === 'object') {
      valueStr = JSON.stringify(value)
    }
    else if (value === null || value === undefined) {
      valueStr = ''
    }
    else {
      // At this point value is a primitive (string, number, boolean, bigint, symbol)
      valueStr = String(value as string | number | boolean | bigint | symbol)
    }
    argRows.push(
      <div key={key} style={STYLES.argRow}>
        <strong>
          {escapeHtml(key)}
          :
        </strong>
        {' '}
        {escapeHtml(valueStr)}
      </div>,
    )
  }

  return (
    <div id={`approval-${request.id}`} className="chat-message approval-pending">
      <div className="chat-message-role">⏸️ Awaiting Approval</div>
      <div className="chat-message-content">
        <div style={STYLES.approvalCard}>
          <div className="approval-tool-name" style={STYLES.toolName}>{request.toolName}</div>
          <div className="approval-reason" style={STYLES.reason}>{request.reason}</div>
          <div className="approval-args" style={STYLES.args}>
            <div className="approval-args-label" style={STYLES.argsLabel}>Arguments:</div>
            <div className="approval-args-content" style={STYLES.argsContent}>{argRows}</div>
          </div>
          <div className="approval-actions" style={STYLES.actions}>
            <button
              className="btn btn-outline"
              style={{ ...STYLES.button, ...STYLES.buttonReject }}
              onClick={() => onAction(request.id, false, 'once')}
            >
              ✕ Reject
            </button>
            <button
              className="btn btn-primary"
              style={STYLES.button}
              onClick={() => onAction(request.id, true, 'once')}
            >
              ✓ Allow Once
            </button>
            <button
              className="btn btn-primary"
              style={STYLES.button}
              onClick={() => onAction(request.id, true, 'session')}
            >
              ✓ Allow Session
            </button>
            <button
              className="btn btn-primary"
              style={STYLES.button}
              onClick={() => onAction(request.id, true, 'forever')}
            >
              ✓ Allow Always
            </button>
          </div>
        </div>
      </div>
      <div className="chat-message-time">Just now</div>
    </div>
  )
}

function ApprovedCard(): Node {
  return (
    <div className="chat-message approval-approved">
      <div className="chat-message-role">✓ Approved</div>
      <div className="chat-message-content">
        <div style={STYLES.approved}>
          <div style={STYLES.statusText}>Tool approved - executing...</div>
        </div>
      </div>
      <div className="chat-message-time">Just now</div>
    </div>
  )
}

function RejectedCard(): Node {
  return (
    <div className="chat-message approval-rejected">
      <div className="chat-message-role">✕ Approval Rejected</div>
      <div className="chat-message-content">
        <div style={STYLES.rejected}>
          <div style={STYLES.statusText}>Tool execution was rejected</div>
        </div>
      </div>
      <div className="chat-message-time">Just now</div>
    </div>
  )
}

// ============================================================================
// Container
// ============================================================================

const chatMessagesElement = () => document.getElementById('chat-messages') as HTMLDivElement | null
const renderedApprovals = new Set<string>()

/**
 * Initialize inline approval UI - subscribes to pending approval events
 * and renders approval cards in the chat
 */
export function initInlineApprovals(): void {
  pendingApprovalEvents.subscribe((request) => {
    renderInlineApproval(request)
  })

  // Also check for pending approvals on page load
  void checkAndRenderPending()
}

/**
 * Check for pending approvals on page load and render them
 */
async function checkAndRenderPending(): Promise<void> {
  const pending = await getPendingApprovals()
  for (const request of pending) {
    renderInlineApproval(request)
  }
}

/**
 * Render an inline approval card in the chat
 */
function renderInlineApproval(request: ToolApprovalRequest): void {
  // Don't render if already exists
  if (renderedApprovals.has(request.id)) return

  const container = chatMessagesElement()
  if (!container) return

  const card = ApprovalCard({
    request,
    onAction: handleApprovalAction,
  })

  container.appendChild(card)
  container.scrollTop = container.scrollHeight
  renderedApprovals.add(request.id)
}

/**
 * Handle approval button click
 */
async function handleApprovalAction(
  requestId: string,
  approved: boolean,
  scope: ApprovalScope,
): Promise<void> {
  const card = document.getElementById(`approval-${requestId}`)
  if (!card) return

  // Disable all buttons
  const buttons = card.querySelectorAll('.btn')
  buttons.forEach(btn => (btn as HTMLButtonElement).disabled = true)

  if (!approved) {
    // Mark as rejected
    await updateApprovalStatus(requestId, 'rejected')
    await respondToApproval({
      requestId,
      approved: false,
      scope: 'once',
      timestamp: Date.now(),
    })

    // Update UI
    const newCard = RejectedCard()
    card.replaceWith(newCard)
    renderedApprovals.delete(requestId)
    return
  }

  // Approve
  await respondToApproval({
    requestId,
    approved: true,
    scope,
    timestamp: Date.now(),
  })

  // Update tool permissions if not 'once'
  if (scope !== 'once') {
    const request = await getApprovalRequest(requestId)
    if (request) {
      await addToolApproval(request.toolName, scope)
    }
  }

  // Update UI to show approved/executing
  const newCard = ApprovedCard()
  card.replaceWith(newCard)
  renderedApprovals.delete(requestId)
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

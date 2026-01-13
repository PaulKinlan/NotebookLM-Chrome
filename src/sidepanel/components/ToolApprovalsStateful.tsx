/**
 * ToolApprovalsStateful Component
 *
 * Renders and manages tool approval cards in the chat.
 * Converts imperative approval-ui.tsx to hooks-based architecture.
 */

import { useToolApprovals, toolApprovalsUtils } from '../hooks/useToolApprovals.ts'
import type { ApprovalScope } from '../../types/index.js'

/**
 * ToolApprovalsStateful - Renders pending tool approval requests
 */
export function ToolApprovalsStateful(): Node {
  const { pendingApprovals, approvalStatuses, handleApproval } = useToolApprovals()

  if (pendingApprovals.length === 0 && approvalStatuses.size === 0) {
    return <></>
  }

  // Get all approvals to render (pending + recently acted upon)
  const allIds = new Set([
    ...pendingApprovals.map(p => p.id),
    ...approvalStatuses.keys(),
  ])

  const approvalCards: Node[] = []
  for (const id of allIds) {
    const status = approvalStatuses.get(id)
    const pending = pendingApprovals.find(p => p.id === id)

    if (status?.status === 'approved') {
      approvalCards.push(<ApprovedCard />)
    }
    else if (status?.status === 'rejected') {
      approvalCards.push(<RejectedCard />)
    }
    else if (pending) {
      approvalCards.push(
        <ApprovalCard
          request={pending}
          onAction={(approved: boolean, scope: ApprovalScope) => {
            void handleApproval(id, approved, scope)
          }}
        />,
      )
    }
  }

  return <>{approvalCards}</>
}

/**
 * ApprovalCardProps
 */
interface ApprovalCardProps {
  request: {
    id: string
    toolName: string
    reason: string
    args: Record<string, unknown>
  }
  onAction: (approved: boolean, scope: ApprovalScope) => void | Promise<void>
}

/**
 * ApprovalCard - Renders a pending tool approval request
 */
function ApprovalCard({ request, onAction }: ApprovalCardProps): Node {
  const { escapeHtml, formatArgValue } = toolApprovalsUtils

  const argRows: Node[] = []
  for (const [key, value] of Object.entries(request.args)) {
    argRows.push(
      <div key={key} className="approval-arg-row">
        <strong>
          {escapeHtml(key)}
          :
        </strong>
        {' '}
        {escapeHtml(formatArgValue(value))}
      </div>,
    )
  }

  return (
    <div id={`approval-${request.id}`} className="chat-message approval-pending">
      <div className="chat-message-role">⏸️ Awaiting Approval</div>
      <div className="chat-message-content">
        <div className="approval-card">
          <div className="approval-tool-name">{request.toolName}</div>
          <div className="approval-reason">{request.reason}</div>
          <div className="approval-args">
            <div className="approval-args-label">Arguments:</div>
            <div className="approval-args-content">{argRows}</div>
          </div>
          <div className="approval-actions">
            <button
              className="btn btn-outline approval-reject-btn"
              type="button"
              onClick={() => void onAction(false, 'once')}
            >
              ✕ Reject
            </button>
            <button
              className="btn btn-primary approval-approve-btn"
              type="button"
              onClick={() => void onAction(true, 'once')}
            >
              ✓ Allow Once
            </button>
            <button
              className="btn btn-primary approval-approve-btn"
              type="button"
              onClick={() => void onAction(true, 'session')}
            >
              ✓ Allow Session
            </button>
            <button
              className="btn btn-primary approval-approve-btn"
              type="button"
              onClick={() => void onAction(true, 'forever')}
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

/**
 * ApprovedCard - Shows approved state
 */
function ApprovedCard(): Node {
  return (
    <div className="chat-message approval-approved">
      <div className="chat-message-role">✓ Approved</div>
      <div className="chat-message-content">
        <div className="approval-status approval-status-approved">
          <div className="approval-status-text">Tool approved - executing...</div>
        </div>
      </div>
      <div className="chat-message-time">Just now</div>
    </div>
  )
}

/**
 * RejectedCard - Shows rejected state
 */
function RejectedCard(): Node {
  return (
    <div className="chat-message approval-rejected">
      <div className="chat-message-role">✕ Approval Rejected</div>
      <div className="chat-message-content">
        <div className="approval-status approval-status-rejected">
          <div className="approval-status-text">Tool execution was rejected</div>
        </div>
      </div>
      <div className="chat-message-time">Just now</div>
    </div>
  )
}

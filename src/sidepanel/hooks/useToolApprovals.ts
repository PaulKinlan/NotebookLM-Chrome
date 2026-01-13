/**
 * useToolApprovals Hook
 *
 * Manages runtime tool approval requests in agentic mode.
 * Converts imperative approval-ui.tsx to hooks-based approach.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import type { ToolApprovalRequest, ApprovalScope } from '../../types/index.ts'
import {
  getPendingApprovals,
  respondToApproval,
  pendingApprovalEvents,
  updateApprovalStatus,
} from '../../lib/tool-approvals.ts'
import { addToolApproval } from '../../lib/tool-permissions.ts'

/**
 * Approval status tracking
 */
export interface ApprovalStatus {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  scope?: ApprovalScope
}

/**
 * Hook return type
 */
export interface UseToolApprovalsReturn {
  pendingApprovals: ToolApprovalRequest[]
  approvalStatuses: Map<string, ApprovalStatus>
  handleApproval: (requestId: string, approved: boolean, scope: ApprovalScope) => Promise<void>
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Format argument value for display
 */
function formatArgValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  // Remaining types are primitives: string, number, bigint, boolean
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

/**
 * useToolApprovals hook
 *
 * Manages tool approval UI state for runtime approval requests.
 */
export function useToolApprovals(): UseToolApprovalsReturn {
  const [pendingApprovals, setPendingApprovals] = useState<ToolApprovalRequest[]>([])
  const [approvalStatuses, setApprovalStatuses] = useState<Map<string, ApprovalStatus>>(new Map())

  /**
   * Load pending approvals on mount
   */
  useEffect(() => {
    async function loadPending(): Promise<void> {
      const pending = await getPendingApprovals()
      setPendingApprovals(pending)
    }
    void loadPending()
  }, [])

  /**
   * Subscribe to new approval requests
   */
  useEffect(() => {
    const unsubscribe = pendingApprovalEvents.subscribe((request) => {
      setPendingApprovals((prev) => {
        // Don't add if already exists
        if (prev.some(p => p.id === request.id)) {
          return prev
        }
        return [...prev, request]
      })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * Handle approval action (approve/reject)
   */
  async function handleApproval(
    requestId: string,
    approved: boolean,
    scope: ApprovalScope,
  ): Promise<void> {
    // Update local status immediately
    setApprovalStatuses(prev => new Map(prev).set(requestId, {
      id: requestId,
      status: approved ? 'approved' : 'rejected',
      scope,
    }))

    if (!approved) {
      // Mark as rejected
      await updateApprovalStatus(requestId, 'rejected')
      await respondToApproval({
        requestId,
        approved: false,
        scope: 'once',
        timestamp: Date.now(),
      })

      // Remove from pending
      setPendingApprovals(prev => prev.filter(p => p.id !== requestId))
      setApprovalStatuses((prev) => {
        const next = new Map(prev)
        next.delete(requestId)
        return next
      })
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
      const request = pendingApprovals.find(p => p.id === requestId)
      if (request) {
        await addToolApproval(request.toolName, scope)
      }
    }

    // Remove from pending after a delay (to show approved state)
    setTimeout(() => {
      setPendingApprovals(prev => prev.filter(p => p.id !== requestId))
      setApprovalStatuses((prev) => {
        const next = new Map(prev)
        next.delete(requestId)
        return next
      })
    }, 2000)
  }

  return {
    pendingApprovals,
    approvalStatuses,
    handleApproval,
  }
}

/**
 * Export utilities for components
 */
export const toolApprovalsUtils = {
  escapeHtml,
  formatArgValue,
}

/**
 * Tool Approval Management
 *
 * Manages user approval workflow for tool execution in agentic mode.
 * Certain tools may require user approval before execution (e.g., modifying data).
 */

import type { ToolApprovalRequest, ToolApprovalResponse, ApprovalStatus } from '../types/index.ts'
import { dbGet, dbPut, dbGetAll } from './db.ts'

const APPROVAL_REQUESTS_STORE = 'approvalRequests'

// ============================================================================
// Event Emitters for Approval System
// ============================================================================

type ApprovalListener = (requestId: string, approved: boolean) => void
type PendingApprovalListener = (request: ToolApprovalRequest) => void

class ApprovalEventEmitter {
  private listeners = new Map<string, ApprovalListener>()

  on(requestId: string, callback: ApprovalListener): void {
    this.listeners.set(requestId, callback)
  }

  off(requestId: string): void {
    this.listeners.delete(requestId)
  }

  emit(requestId: string, approved: boolean): void {
    const listener = this.listeners.get(requestId)
    if (listener) {
      listener(requestId, approved)
      this.off(requestId) // Auto-cleanup after firing
    }
  }
}

class PendingApprovalEventEmitter {
  private listeners: PendingApprovalListener[] = []

  subscribe(callback: PendingApprovalListener): () => void {
    this.listeners.push(callback)
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  emit(request: ToolApprovalRequest): void {
    for (const listener of this.listeners) {
      listener(request)
    }
  }
}

export const approvalEvents = new ApprovalEventEmitter()
export const pendingApprovalEvents = new PendingApprovalEventEmitter()

/**
 * Create a new approval request for a tool call
 */
export async function createApprovalRequest(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  reason: string,
): Promise<ToolApprovalRequest> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const request: ToolApprovalRequest = {
    id,
    toolCallId,
    toolName,
    args,
    reason,
    timestamp: now,
    status: 'pending',
  }

  try {
    await dbPut(APPROVAL_REQUESTS_STORE, { key: id, value: request })
  }
  catch {
    // If store doesn't exist yet, skip persistence
    // This will be created when DB is upgraded
  }

  // Emit event so UI can show inline approval
  pendingApprovalEvents.emit(request)

  return request
}

/**
 * Get an approval request by ID
 */
export async function getApprovalRequest(
  id: string,
): Promise<ToolApprovalRequest | null> {
  try {
    const result = await dbGet<{ key: string, value: ToolApprovalRequest }>(
      APPROVAL_REQUESTS_STORE,
      id,
    )
    return result?.value || null
  }
  catch {
    return null
  }
}

/**
 * Get all pending approval requests
 */
export async function getPendingApprovals(): Promise<ToolApprovalRequest[]> {
  try {
    const results = await dbGetAll<{ key: string, value: ToolApprovalRequest }>(
      APPROVAL_REQUESTS_STORE,
    )

    return results
      .map(r => r.value)
      .filter(r => r.status === 'pending')
  }
  catch {
    return []
  }
}

/**
 * Update approval request status
 */
export async function updateApprovalStatus(
  id: string,
  status: ApprovalStatus,
): Promise<void> {
  const request = await getApprovalRequest(id)
  if (!request) {
    throw new Error(`Approval request ${id} not found`)
  }

  const updated: ToolApprovalRequest = {
    ...request,
    status,
  }

  try {
    await dbPut(APPROVAL_REQUESTS_STORE, { key: id, value: updated })
  }
  catch {
    // If store doesn't exist yet, skip persistence
  }
}

/**
 * Respond to an approval request
 */
export async function respondToApproval(
  response: ToolApprovalResponse,
): Promise<void> {
  await updateApprovalStatus(
    response.requestId,
    response.approved ? 'approved' : 'rejected',
  )

  // Emit event for waiting tool execution
  approvalEvents.emit(response.requestId, response.approved)
}

/**
 * Check if an approval request is still pending
 */
export async function isApprovalPending(id: string): Promise<boolean> {
  const request = await getApprovalRequest(id)
  if (!request) return false

  return request.status === 'pending'
}

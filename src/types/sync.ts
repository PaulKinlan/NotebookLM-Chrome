// ============================================================================
// Sync Infrastructure
// ============================================================================

/**
 * Sync status for entities that sync with remote storage
 */
export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict'

/**
 * Base interface for entities that can be synced
 */
export interface SyncableEntity {
  id: string
  remoteId?: string
  syncStatus: SyncStatus
  lastSynced?: number
  createdAt: number
  updatedAt: number
}

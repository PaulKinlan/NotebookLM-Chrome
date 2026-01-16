// ============================================================================
// Storage Interface
// ============================================================================

import type {
  Notebook,
  Source,
  ChatEvent,
  CachedResponse,
  NotebookSummary,
} from './core.ts'
import type { Transformation } from './transform.ts'

/**
 * Storage interface for data persistence
 * Implemented by IndexedDB, chrome.storage, or other adapters
 */
export interface StorageAdapter {
  // Notebooks
  getNotebooks(): Promise<Notebook[]>
  getNotebook(id: string): Promise<Notebook | null>
  saveNotebook(notebook: Notebook): Promise<void>
  deleteNotebook(id: string): Promise<void>

  // Sources
  getSourcesByNotebook(notebookId: string): Promise<Source[]>
  getSource(id: string): Promise<Source | null>
  saveSource(source: Source): Promise<void>
  deleteSource(id: string): Promise<void>
  getSourceCountByNotebook(notebookId: string): Promise<number>

  // Chat Events
  getChatHistory(notebookId: string): Promise<ChatEvent[]>
  saveChatEvent(event: ChatEvent): Promise<void>
  clearChatHistory(notebookId: string): Promise<void>

  // Transformations
  getTransformations(notebookId: string): Promise<Transformation[]>
  saveTransformation(transformation: Transformation): Promise<void>
  deleteTransformation(id: string): Promise<void>

  // Settings
  getSetting<T>(key: string): Promise<T | null>
  setSetting<T>(key: string, value: T): Promise<void>

  // Active notebook
  getActiveNotebookId(): Promise<string | null>
  setActiveNotebookId(id: string | null): Promise<void>

  // Response Cache
  getCachedResponse(cacheKey: string): Promise<CachedResponse | null>
  saveCachedResponse(cached: CachedResponse): Promise<void>
  getCachedResponsesByNotebook(notebookId: string): Promise<CachedResponse[]>
  clearResponseCache(notebookId: string): Promise<void>

  // Notebook Summary
  getSummary(notebookId: string): Promise<NotebookSummary | null>
  saveSummary(summary: NotebookSummary): Promise<void>
  deleteSummary(notebookId: string): Promise<void>

  // Clear all data
  clearAll(): Promise<void>
}

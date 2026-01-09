import type {
  Notebook,
  Source,
  ChatMessage,
  Transformation,
  StorageAdapter,
  SyncStatus,
  CachedResponse,
  Citation,
  NotebookSummary,
} from '../types/index.ts';
import {
  dbGet,
  dbGetAll,
  dbGetByIndex,
  dbPut,
  dbDelete,
  dbDeleteByIndex,
  dbClearAll,
} from './db.ts';

// ============================================================================
// Storage Adapter Implementation
// ============================================================================

class IndexedDBStorage implements StorageAdapter {
  // --------------------------------------------------------------------------
  // Notebooks
  // --------------------------------------------------------------------------

  async getNotebooks(): Promise<Notebook[]> {
    const notebooks = await dbGetAll<Notebook>('notebooks');
    return notebooks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getNotebook(id: string): Promise<Notebook | null> {
    return dbGet<Notebook>('notebooks', id);
  }

  async saveNotebook(notebook: Notebook): Promise<void> {
    const now = Date.now();
    const existing = await this.getNotebook(notebook.id);

    const toSave: Notebook = {
      ...notebook,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
      syncStatus: 'local' as SyncStatus,
    };

    await dbPut('notebooks', toSave);
  }

  async deleteNotebook(id: string): Promise<void> {
    // Delete associated data first
    await dbDeleteByIndex('sources', 'notebookId', id);
    await dbDeleteByIndex('chatMessages', 'notebookId', id);
    await dbDeleteByIndex('transformations', 'notebookId', id);
    await dbDeleteByIndex('summaries', 'notebookId', id);

    // Then delete the notebook
    await dbDelete('notebooks', id);

    // Clear active notebook if it was this one
    const activeId = await this.getActiveNotebookId();
    if (activeId === id) {
      await this.setActiveNotebookId(null);
    }
  }

  // --------------------------------------------------------------------------
  // Sources
  // --------------------------------------------------------------------------

  async getSourcesByNotebook(notebookId: string): Promise<Source[]> {
    const sources = await dbGetByIndex<Source>('sources', 'notebookId', notebookId);
    return sources.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getSource(id: string): Promise<Source | null> {
    return dbGet<Source>('sources', id);
  }

  async saveSource(source: Source): Promise<void> {
    const now = Date.now();
    const existing = await this.getSource(source.id);

    const toSave: Source = {
      ...source,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
      syncStatus: 'local' as SyncStatus,
    };

    await dbPut('sources', toSave);
  }

  async deleteSource(id: string): Promise<void> {
    await dbDelete('sources', id);
  }

  // --------------------------------------------------------------------------
  // Chat Messages
  // --------------------------------------------------------------------------

  async getChatHistory(notebookId: string): Promise<ChatMessage[]> {
    const messages = await dbGetByIndex<ChatMessage>('chatMessages', 'notebookId', notebookId);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async saveChatMessage(message: ChatMessage): Promise<void> {
    await dbPut('chatMessages', message);
  }

  async clearChatHistory(notebookId: string): Promise<void> {
    await dbDeleteByIndex('chatMessages', 'notebookId', notebookId);
  }

  // --------------------------------------------------------------------------
  // Transformations
  // --------------------------------------------------------------------------

  async getTransformations(notebookId: string): Promise<Transformation[]> {
    const transformations = await dbGetByIndex<Transformation>('transformations', 'notebookId', notebookId);
    return transformations.sort((a, b) => b.createdAt - a.createdAt);
  }

  async saveTransformation(transformation: Transformation): Promise<void> {
    const now = Date.now();
    const existing = await dbGet<Transformation>('transformations', transformation.id);

    const toSave: Transformation = {
      ...transformation,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
      syncStatus: 'local' as SyncStatus,
    };

    await dbPut('transformations', toSave);
  }

  async deleteTransformation(id: string): Promise<void> {
    await dbDelete('transformations', id);
  }

  // --------------------------------------------------------------------------
  // Response Cache (Offline Support)
  // --------------------------------------------------------------------------

  async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
    return dbGet<CachedResponse>('responseCache', cacheKey);
  }

  async saveCachedResponse(cached: CachedResponse): Promise<void> {
    await dbPut('responseCache', cached);
  }

  async getCachedResponsesByNotebook(notebookId: string): Promise<CachedResponse[]> {
    return dbGetByIndex<CachedResponse>('responseCache', 'notebookId', notebookId);
  }

  async clearResponseCache(notebookId: string): Promise<void> {
    await dbDeleteByIndex('responseCache', 'notebookId', notebookId);
  }

  // --------------------------------------------------------------------------
  // Notebook Summary
  // --------------------------------------------------------------------------

  async getSummary(notebookId: string): Promise<NotebookSummary | null> {
    const summaries = await dbGetByIndex<NotebookSummary>('summaries', 'notebookId', notebookId);
    return summaries[0] ?? null;
  }

  async saveSummary(summary: NotebookSummary): Promise<void> {
    await dbPut('summaries', summary);
  }

  async deleteSummary(notebookId: string): Promise<void> {
    await dbDeleteByIndex('summaries', 'notebookId', notebookId);
  }

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------

  async getSetting<T>(key: string): Promise<T | null> {
    const result = await dbGet<{ key: string; value: T }>('settings', key);
    return result?.value ?? null;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await dbPut('settings', { key, value });
  }

  // --------------------------------------------------------------------------
  // Active Notebook
  // --------------------------------------------------------------------------

  async getActiveNotebookId(): Promise<string | null> {
    return this.getSetting<string>('activeNotebookId');
  }

  async setActiveNotebookId(id: string | null): Promise<void> {
    if (id === null) {
      await dbDelete('settings', 'activeNotebookId');
    } else {
      await this.setSetting('activeNotebookId', id);
    }
  }

  async clearAll(): Promise<void> {
    await dbClearAll();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const storage: StorageAdapter = new IndexedDBStorage();

// ============================================================================
// Helper Functions
// ============================================================================

export function createNotebook(name: string): Notebook {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

export function createSource(
  notebookId: string,
  type: Source['type'],
  url: string,
  title: string,
  content: string
): Source {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    notebookId,
    type,
    url,
    title,
    content,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
    metadata: {
      wordCount: content.split(/\s+/).length,
    },
  };
}

export function createChatMessage(
  notebookId: string,
  role: ChatMessage['role'],
  content: string,
  citations?: ChatMessage['citations']
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    notebookId,
    role,
    content,
    citations,
    timestamp: Date.now(),
  };
}

export function createTransformation(
  notebookId: string,
  type: Transformation['type'],
  title: string,
  content: string,
  sourceIds: string[]
): Transformation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    notebookId,
    type,
    title,
    content,
    sourceIds,
    syncStatus: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

export function createCacheKey(query: string, sourceIds: string[]): string {
  // Create a deterministic cache key from query and sorted source IDs
  const normalized = `${query.toLowerCase().trim()}:${sourceIds.sort().join(',')}`;
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `cache_${Math.abs(hash).toString(36)}`;
}

export function createCachedResponse(
  notebookId: string,
  query: string,
  sourceIds: string[],
  response: string,
  citations: Citation[]
): CachedResponse {
  return {
    id: createCacheKey(query, sourceIds),
    notebookId,
    query,
    sourceIds,
    response,
    citations,
    createdAt: Date.now(),
  };
}

// ============================================================================
// Convenience Exports (backwards compatibility)
// ============================================================================

export const getNotebooks = () => storage.getNotebooks();
export const getNotebook = (id: string) => storage.getNotebook(id);
export const saveNotebook = (notebook: Notebook) => storage.saveNotebook(notebook);
export const deleteNotebook = (id: string) => storage.deleteNotebook(id);
export const getActiveNotebookId = () => storage.getActiveNotebookId();
export const setActiveNotebookId = (id: string | null) => storage.setActiveNotebookId(id);

export const getSourcesByNotebook = (notebookId: string) => storage.getSourcesByNotebook(notebookId);
export const saveSource = (source: Source) => storage.saveSource(source);
export const deleteSource = (id: string) => storage.deleteSource(id);

export const getChatHistory = (notebookId: string) => storage.getChatHistory(notebookId);
export const saveChatMessage = (message: ChatMessage) => storage.saveChatMessage(message);

export const getTransformations = (notebookId: string) => storage.getTransformations(notebookId);
export const saveTransformation = (transformation: Transformation) => storage.saveTransformation(transformation);

export const getCachedResponse = (cacheKey: string) => storage.getCachedResponse(cacheKey);
export const saveCachedResponse = (cached: CachedResponse) => storage.saveCachedResponse(cached);
export const clearChatHistory = (notebookId: string) => storage.clearChatHistory(notebookId);

export const getSummary = (notebookId: string) => storage.getSummary(notebookId);
export const saveSummary = (summary: NotebookSummary) => storage.saveSummary(summary);
export const deleteSummary = (notebookId: string) => storage.deleteSummary(notebookId);

export function createSummary(
  notebookId: string,
  sourceIds: string[],
  content: string
): NotebookSummary {
  const now = Date.now();
  return {
    id: `summary_${notebookId}`,
    notebookId,
    sourceIds,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

export const clearAllData = () => storage.clearAll();

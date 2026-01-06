// ============================================================================
// Sync Infrastructure
// ============================================================================

export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict';

export interface SyncableEntity {
  id: string;
  remoteId?: string;
  syncStatus: SyncStatus;
  lastSynced?: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Core Data Models
// ============================================================================

export interface Source extends SyncableEntity {
  notebookId: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text';
  url: string;
  title: string;
  content: string;
  htmlContent?: string;
  metadata?: {
    favicon?: string;
    description?: string;
    wordCount?: number;
  };
}

export interface Notebook extends SyncableEntity {
  name: string;
}

export interface ChatMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: number;
}

export interface Citation {
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
}

// ============================================================================
// Response Cache (Offline Support)
// ============================================================================

export interface CachedResponse {
  id: string; // hash of query + sourceIds
  notebookId: string;
  query: string;
  sourceIds: string[];
  response: string;
  citations: Citation[];
  createdAt: number;
}

// ============================================================================
// AI Configuration
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'chrome';

export interface AISettings {
  provider: AIProvider;
  model: string;
  apiKeys: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
}

export type TTSProvider = 'openai' | 'elevenlabs' | 'google' | 'browser';

export interface TTSSettings {
  provider: TTSProvider;
  apiKey?: string;
  voice1: string;
  voice2: string;
}

// ============================================================================
// Transformations
// ============================================================================

export type TransformationType =
  | 'podcast'
  | 'quiz'
  | 'takeaways'
  | 'email';

export interface Transformation extends SyncableEntity {
  notebookId: string;
  type: TransformationType;
  title: string;
  content: string;
  sourceIds: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Quiz {
  questions: QuizQuestion[];
}

// ============================================================================
// Message Passing
// ============================================================================

export type MessageType =
  | 'EXTRACT_CONTENT'
  | 'EXTRACT_FROM_URL'
  | 'CONTENT_EXTRACTED'
  | 'ADD_SOURCE'
  | 'REMOVE_SOURCE'
  | 'GET_SOURCES'
  | 'QUERY_SOURCES'
  | 'REQUEST_PERMISSION'
  | 'REBUILD_CONTEXT_MENUS'
  | 'SOURCE_ADDED'
  | 'CREATE_NOTEBOOK_AND_ADD_PAGE'
  | 'CREATE_NOTEBOOK_AND_ADD_LINK';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

// ============================================================================
// Content Extraction
// ============================================================================

export interface ContentExtractionResult {
  url: string;
  title: string;
  content: string;
  textContent: string;
}

// ============================================================================
// Permissions
// ============================================================================

export interface PermissionStatus {
  tabs: boolean;
  tabGroups: boolean;
  bookmarks: boolean;
  history: boolean;
}

// ============================================================================
// Storage Interface
// ============================================================================

export interface StorageAdapter {
  // Notebooks
  getNotebooks(): Promise<Notebook[]>;
  getNotebook(id: string): Promise<Notebook | null>;
  saveNotebook(notebook: Notebook): Promise<void>;
  deleteNotebook(id: string): Promise<void>;

  // Sources
  getSourcesByNotebook(notebookId: string): Promise<Source[]>;
  getSource(id: string): Promise<Source | null>;
  saveSource(source: Source): Promise<void>;
  deleteSource(id: string): Promise<void>;

  // Chat
  getChatHistory(notebookId: string): Promise<ChatMessage[]>;
  saveChatMessage(message: ChatMessage): Promise<void>;
  clearChatHistory(notebookId: string): Promise<void>;

  // Transformations
  getTransformations(notebookId: string): Promise<Transformation[]>;
  saveTransformation(transformation: Transformation): Promise<void>;
  deleteTransformation(id: string): Promise<void>;

  // Settings
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;

  // Active notebook
  getActiveNotebookId(): Promise<string | null>;
  setActiveNotebookId(id: string | null): Promise<void>;

  // Response Cache
  getCachedResponse(cacheKey: string): Promise<CachedResponse | null>;
  saveCachedResponse(cached: CachedResponse): Promise<void>;
  getCachedResponsesByNotebook(notebookId: string): Promise<CachedResponse[]>;
  clearResponseCache(notebookId: string): Promise<void>;
}

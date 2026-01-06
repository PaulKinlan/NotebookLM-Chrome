export interface Source {
  id: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual';
  url: string;
  title: string;
  content?: string;
  addedAt: number;
  metadata?: Record<string, unknown>;
}

export interface Notebook {
  id: string;
  name: string;
  sources: Source[];
  createdAt: number;
  updatedAt: number;
}

export interface ContentExtractionResult {
  url: string;
  title: string;
  content: string;
  textContent: string;
}

export type MessageType =
  | 'EXTRACT_CONTENT'
  | 'CONTENT_EXTRACTED'
  | 'ADD_SOURCE'
  | 'REMOVE_SOURCE'
  | 'GET_SOURCES'
  | 'QUERY_SOURCES'
  | 'REQUEST_PERMISSION';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface PermissionStatus {
  tabs: boolean;
  bookmarks: boolean;
  history: boolean;
}

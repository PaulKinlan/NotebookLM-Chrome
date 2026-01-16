/**
 * BroadcastChannel Utility for Cross-Context Communication
 *
 * Provides type-safe channels for communicating between different
 * contexts (sidepanel, background script, content scripts, E2E tests).
 *
 * BroadcastChannel is a native Web API that allows different browsing
 * contexts (windows, tabs, workers, etc.) to communicate without
 * going through a server.
 */

import type { ThemePreference } from '../../types/index.ts'

// ============================================================================
// Channel Names
// ============================================================================

export const CHANNELS = {
  SOURCES: 'foliolm:sources',
  NOTEBOOKS: 'foliolm:notebooks',
  CHAT: 'foliolm:chat',
  SETTINGS: 'foliolm:settings',
} as const

// ============================================================================
// Event Types
// ============================================================================

export interface SourceCreatedEvent {
  type: 'source:created'
  notebookId: string
  sourceId: string
}

export interface SourceDeletedEvent {
  type: 'source:deleted'
  notebookId: string
  sourceId: string
}

export interface SourceRefreshedEvent {
  type: 'source:refreshed'
  notebookId: string
  sourceId: string
}

export type SourcesEvent = SourceCreatedEvent | SourceDeletedEvent | SourceRefreshedEvent

export interface NotebookCreatedEvent {
  type: 'notebook:created'
  notebookId: string
}

export interface NotebookDeletedEvent {
  type: 'notebook:deleted'
  notebookId: string
}

export interface NotebookSelectedEvent {
  type: 'notebook:selected'
  notebookId: string | null
}

export type NotebooksEvent
  = | NotebookCreatedEvent
    | NotebookDeletedEvent
    | NotebookSelectedEvent

export interface ChatAddedEvent {
  type: 'chat:added'
  notebookId: string
  messageId: string
}

export interface ChatClearedEvent {
  type: 'chat:cleared'
  notebookId: string
}

export type ChatEvent = ChatAddedEvent | ChatClearedEvent

export interface ThemeChangedEvent {
  type: 'theme:changed'
  preference: ThemePreference
}

export interface PermissionsChangedEvent {
  type: 'permissions:changed'
}

export type SettingsEvent = ThemeChangedEvent | PermissionsChangedEvent

// ============================================================================
// Channel Management
// ============================================================================

/** Singleton channels (lazily created) */
const channels = new Map<string, BroadcastChannel>()

/** Get or create a BroadcastChannel for the given name */
export function getChannel(name: string): BroadcastChannel {
  if (!channels.has(name)) {
    channels.set(name, new BroadcastChannel(name))
  }
  return channels.get(name)!
}

// ============================================================================
// Post Message Helpers
// ============================================================================

export function postSourcesMessage(event: SourcesEvent): void {
  getChannel(CHANNELS.SOURCES).postMessage(event)
}

export function postNotebooksMessage(event: NotebooksEvent): void {
  getChannel(CHANNELS.NOTEBOOKS).postMessage(event)
}

export function postChatMessage(event: ChatEvent): void {
  getChannel(CHANNELS.CHAT).postMessage(event)
}

export function postSettingsMessage(event: SettingsEvent): void {
  getChannel(CHANNELS.SETTINGS).postMessage(event)
}

// ============================================================================
// Listener Setup
// ============================================================================

/**
 * Initialize all broadcast listeners
 * Call this once during app initialization (in main.tsx)
 */
export function initBroadcastListeners(): void {
  // Sources channel - triggers reload in useSources hook
  getChannel(CHANNELS.SOURCES).onmessage = () => {
    // The useSources hook will listen and reload when needed
    // We dispatch a custom event for backward compatibility during migration
    window.dispatchEvent(new CustomEvent('foliolm:sources-changed'))
  }

  // Notebooks channel - triggers reload in useNotebook hook
  getChannel(CHANNELS.NOTEBOOKS).onmessage = (
    event: MessageEvent<NotebooksEvent>,
  ) => {
    // The useNotebook hook will handle notebook selection changes
    window.dispatchEvent(new CustomEvent('foliolm:notebooks-changed', { detail: event.data }))

    // When notebooks are created or deleted, rebuild context menus
    if (event.data.type === 'notebook:created' || event.data.type === 'notebook:deleted') {
      chrome.runtime.sendMessage({ type: 'REBUILD_CONTEXT_MENUS' }).catch(() => {
        // Background script may not be ready yet
      })
    }
  }

  // Chat channel - triggers reload in useChat hook
  getChannel(CHANNELS.CHAT).onmessage = () => {
    window.dispatchEvent(new CustomEvent('foliolm:chat-changed'))
  }

  // Settings channel - theme changes, etc.
  getChannel(CHANNELS.SETTINGS).onmessage = (
    event: MessageEvent<SettingsEvent>,
  ) => {
    window.dispatchEvent(new CustomEvent('foliolm:settings-changed', { detail: event.data }))
  }
}

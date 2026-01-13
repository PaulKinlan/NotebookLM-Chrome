/**
 * useChatHistory Hook
 *
 * Manages chat event history for a notebook.
 * Loads and persists chat events from IndexedDB storage.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import type { ChatEvent } from '../../types/index.ts'
import { getChatHistory, saveChatEvent, clearChatHistory } from '../../lib/storage.ts'

export interface UseChatHistoryReturn {
  /** Chat events for the notebook */
  events: ChatEvent[]
  /** Loading state */
  isLoading: boolean
  /** Load chat history for a notebook */
  loadHistory: (notebookId: string) => Promise<void>
  /** Add a chat event */
  addEvent: (event: ChatEvent) => Promise<void>
  /** Clear all chat events for a notebook */
  clearHistory: (notebookId: string) => Promise<void>
  /** Set events manually (for streaming updates) */
  setEvents: (events: ChatEvent[]) => void
}

/**
 * Hook for managing chat history from storage
 *
 * @param notebookId - The notebook ID to load history for
 *
 * @example
 * ```tsx
 * function ChatTab() {
 *   const { events, isLoading, loadHistory, addEvent } = useChatHistory(notebookId)
 *
 *   useEffect(() => {
 *     if (notebookId) {
 *       loadHistory(notebookId)
 *     }
 *   }, [notebookId])
 *
 *   return (
 *     <div>
 *       {events.map(event => <div key={event.id}>{event.content}</div>)}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChatHistory(notebookId: string | null): UseChatHistoryReturn {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load events when notebookId changes
  useEffect(() => {
    if (notebookId) {
      void loadHistory(notebookId)
    }
    else {
      setEvents([])
    }
  }, [notebookId])

  const loadHistory = async (id: string): Promise<void> => {
    setIsLoading(true)
    try {
      const history = await getChatHistory(id)
      setEvents(history)
    }
    finally {
      setIsLoading(false)
    }
  }

  const addEvent = async (event: ChatEvent): Promise<void> => {
    // For transient chats (no notebook), just add to local state without persisting
    if (!event.notebookId) {
      setEvents(prev => [...prev, event])
      return
    }

    await saveChatEvent(event)
    // Reload history to get the updated list
    await loadHistory(event.notebookId)
  }

  const clearHistory = async (id: string): Promise<void> => {
    await clearChatHistory(id)
    setEvents([])
  }

  return {
    events,
    isLoading,
    loadHistory,
    addEvent,
    clearHistory,
    setEvents,
  }
}

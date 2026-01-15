/**
 * useChat Hook
 *
 * Manages chat state, messages, and streaming responses.
 * Uses global signals for state to sync with ChatTab component.
 */

import { useState, useCallback, useEffect } from 'preact/hooks'
import type { ChatEvent, Source } from '../../types/index.ts'
import { chatMessages, chatQuerying, chatStatus } from '../store'
import {
  createUserEvent,
  createAssistantEvent,
  getChatHistory,
  saveChatEvent,
  clearChatHistory as clearChatHistoryStorage,
} from '../../lib/storage'
import { streamChat } from '../../lib/ai'

export interface UseChatReturn {
  /** Chat messages for current notebook */
  messages: ChatEvent[]
  /** Whether a query is in progress */
  isQuerying: boolean
  /** Current status message */
  status: string
  /** Send a chat query */
  query: (question: string) => Promise<void>
  /** Clear chat history */
  clearChat: () => Promise<void>
  /** Reload chat history */
  reloadHistory: () => Promise<void>
  /** Sources for context (should be passed from parent) */
  setSources: (sources: Source[]) => void
}

/**
 * Hook for managing chat state
 */
export function useChat(notebookId: string | null): UseChatReturn {
  const [sources, setSources] = useState<Source[]>([])

  // Load chat history when notebook changes
  useEffect(() => {
    if (notebookId) {
      void loadHistory()
    }
    else {
      chatMessages.value = []
    }
  }, [notebookId])

  const loadHistory = useCallback(async () => {
    if (!notebookId) {
      chatMessages.value = []
      return
    }

    const history = await getChatHistory(notebookId)
    chatMessages.value = history
  }, [notebookId])

  const query = useCallback(async (question: string) => {
    // Allow chat without a notebook - use empty string for transient chats
    const effectiveNotebookId = notebookId || ''

    if (!question.trim()) {
      return
    }

    chatQuerying.value = true
    chatStatus.value = 'Thinking...'

    try {
      // Save user message
      const userEvent = createUserEvent(effectiveNotebookId, question)
      await saveChatEvent(userEvent)
      appendMessage(userEvent)

      // Get conversation history
      const history = await getChatHistory(effectiveNotebookId)

      // Stream the response
      let responseContent = ''
      const assistantEvent = createAssistantEvent(effectiveNotebookId, '')
      await saveChatEvent(assistantEvent) // Save placeholder
      appendMessage(assistantEvent)

      let hasContent = false

      // streamChat returns AsyncGenerator<StreamEvent, ChatResult>
      // The return value is captured as the second value in for-await-of
      for await (const chunk of streamChat(sources, question, history)) {
        if (chunk.type === 'text') {
          responseContent += chunk.content
          if (!hasContent) {
            hasContent = true
            chatStatus.value = 'Receiving response...'
          }
          // Update the last message content
          const updated = [...chatMessages.value]
          const lastEvent = updated[updated.length - 1]
          if (lastEvent && lastEvent.type === 'assistant') {
            lastEvent.content = responseContent
          }
          chatMessages.value = updated
        }
      }

      // The return value from AsyncGenerator is not directly captured by for-await
      // We need to call streamChat again or track it differently
      // For now, we'll save the accumulated content without citations
      const finalEvent = createAssistantEvent(
        effectiveNotebookId,
        responseContent,
      )
      await saveChatEvent(finalEvent)
      const updated = [...chatMessages.value]
      updated[updated.length - 1] = finalEvent
      chatMessages.value = updated

      chatStatus.value = 'Ask questions to synthesize information from your sources.'
    }
    catch (error) {
      console.error('[useChat] Query failed:', error)
      chatStatus.value = error instanceof Error ? error.message : 'Query failed. Please try again.'

      // Add error message
      const errorEvent = createAssistantEvent(
        effectiveNotebookId,
        `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      await saveChatEvent(errorEvent)
      appendMessage(errorEvent)
    }
    finally {
      chatQuerying.value = false
    }
  }, [notebookId, sources])

  const clearChat = useCallback(async () => {
    if (!notebookId) {
      chatMessages.value = []
      return
    }

    await clearChatHistoryStorage(notebookId)
    chatMessages.value = []
    chatStatus.value = 'Chat history cleared.'
  }, [notebookId])

  const reloadHistory = useCallback(async () => {
    await loadHistory()
  }, [loadHistory])

  // Helper to append a message to the state
  const appendMessage = useCallback((event: ChatEvent) => {
    chatMessages.value = [...chatMessages.value, event]
  }, [])

  return {
    messages: chatMessages.value,
    isQuerying: chatQuerying.value,
    status: chatStatus.value,
    query,
    clearChat,
    reloadHistory,
    setSources,
  }
}

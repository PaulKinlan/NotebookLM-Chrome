/**
 * useChat Hook
 *
 * Manages chat state for query and transformation operations.
 * Handles loading states, chat history, and status messages.
 */

import { useState } from '../../jsx-runtime/hooks/index.ts'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface UseChatReturn {
  /** Chat history messages */
  messages: ChatMessage[]
  /** Currently generated text */
  generatedText: string
  /** Whether a query is in progress */
  isGenerating: boolean
  /** Status message for the current operation */
  chatStatus: string
  /** Set a status message */
  setChatStatus: (status: string) => void
  /** Add a user message to the chat */
  addMessage: (content: string) => void
  /** Add an assistant message to the chat */
  addAssistantMessage: (content: string) => void
  /** Clear all messages */
  clearMessages: () => void
  /** Set generated text (for streaming responses) */
  setGeneratedText: (text: string) => void
  /** Start a query operation */
  startQuery: () => void
  /** End a query operation */
  endQuery: () => void
}

/**
 * Hook for managing chat state
 *
 * @example
 * ```tsx
 * function ChatTab() {
 *   const { messages, isGenerating, chatStatus, addMessage, startQuery, endQuery } = useChat()
 *
 *   const handleQuery = async (query: string) => {
 *     addMessage(query)
 *     startQuery()
 *     try {
 *       setChatStatus('Thinking...')
 *       const response = await api.query(query)
 *       addAssistantMessage(response)
 *     } finally {
 *       endQuery()
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       {messages.map(msg => <div key={msg.id}>{msg.content}</div>)}
 *       {isGenerating && <div>{chatStatus}</div>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [chatStatus, setChatStatus] = useState('')

  const addMessage = (content: string): void => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, message])
  }

  const addAssistantMessage = (content: string): void => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, message])
  }

  const clearMessages = (): void => {
    setMessages([])
    setGeneratedText('')
  }

  const startQuery = (): void => {
    setIsGenerating(true)
  }

  const endQuery = (): void => {
    setIsGenerating(false)
    setChatStatus('')
  }

  return {
    messages,
    generatedText,
    isGenerating,
    chatStatus,
    setChatStatus,
    addMessage,
    addAssistantMessage,
    clearMessages,
    setGeneratedText,
    startQuery,
    endQuery,
  }
}

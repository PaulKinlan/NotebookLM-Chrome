/**
 * ChatTabStateful Component
 *
 * A fully stateful chat tab component that manages its own state and business logic.
 * Uses hooks for notebook selection, source management, and chat history.
 * Handles streaming chat responses with tool support.
 */

import { useState, useRef } from '../../jsx-runtime/hooks/index.ts'
import { useNotebook } from '../hooks/useNotebook.ts'
import { useSources } from '../hooks/useSources.ts'
import { useChatHistory } from '../hooks/useChatHistory.ts'
import { useNotification } from '../hooks/useNotification.ts'
import { ChatMessages } from './ChatMessages.tsx'
import { ChatInput } from './ChatInput.tsx'
import { SourcesList } from './SourcesList.tsx'
import { PickerModal } from './PickerModal.tsx'
import { importTabs, importBookmarks, importHistory, addHighlightedTabs } from '../services/sources.ts'
import type { Source, ChatEvent, Citation, ToolCall } from '../../types/index.ts'
import type { PickerItem } from '../services/sources.ts'
import type { SlashCommand } from './ChatInput.tsx'
import * as storage from '../../lib/storage.ts'
import { getContextMode } from '../../lib/settings.ts'
import { getSourceTools } from '../../lib/agent-tools.ts'
import { streamChat, formatErrorForUser } from '../../lib/ai.ts'
import { generateSummary } from '../../lib/transforms/summary.ts'
import styles from './ChatTab.module.css'

// Available slash commands
const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: 'clear',
    description: 'Clear chat history',
    usage: '/clear',
  },
  {
    command: 'summary',
    description: 'Generate notebook overview',
    usage: '/summary',
  },
  {
    command: 'help',
    description: 'Show available commands',
    usage: '/help',
  },
]

interface ChatTabStatefulProps {
  active: boolean
}

/**
 * Parse slash command from input
 */
function parseSlashCommand(input: string): { command: string, args: string } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.slice(1).split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1).join(' ')

  return { command, args }
}

/**
 * ChatTabStateful - Fully self-contained chat component
 */
export function ChatTabStateful({ active }: ChatTabStatefulProps): JSX.Element {
  // Notebook state
  const { currentNotebookId } = useNotebook()

  // Sources state
  const { sources, removeSource } = useSources(currentNotebookId)

  // Notification state
  const { showNotification } = useNotification()

  // Chat history state
  const { events, addEvent, clearHistory } = useChatHistory(currentNotebookId)

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [chatStatus, setChatStatus] = useState('Ask questions to synthesize information from your sources.')
  const [showPicker, setShowPicker] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([])
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([])

  // Ref for streaming event ID tracking
  const streamingEventIdRef = useRef<string | null>(null)

  /**
   * Handle adding sources from picker modal
   */
  async function handleAddSources(items: PickerItem[]): Promise<void> {
    if (!currentNotebookId) {
      console.warn('No notebook selected')
      return
    }

    // Group items by type for efficient importing
    const tabIds: string[] = []
    const bookmarkIds: string[] = []
    const historyUrls: string[] = []

    for (const item of items) {
      if (item.id.startsWith('tab-')) {
        tabIds.push(item.id.replace('tab-', ''))
      }
      else if (item.id.startsWith('bookmark-')) {
        bookmarkIds.push(item.id.replace('bookmark-', ''))
      }
      else if (item.id.startsWith('history-')) {
        historyUrls.push(item.url)
      }
    }

    // Import each batch
    const sourcesToAdd: Source[] = []
    if (tabIds.length > 0) {
      const tabSources = await importTabs(tabIds)
      sourcesToAdd.push(...tabSources)
    }
    if (bookmarkIds.length > 0) {
      const bookmarkSources = await importBookmarks(bookmarkIds)
      sourcesToAdd.push(...bookmarkSources)
    }
    if (historyUrls.length > 0) {
      const historySources = await importHistory(historyUrls)
      sourcesToAdd.push(...historySources)
    }

    setShowPicker(false)
    // Sources will reload via useSources hook
  }

  /**
   * Handle citation click - open source in new tab
   */
  async function handleCitationClick(url: string): Promise<void> {
    await chrome.tabs.create({ url })
  }

  /**
   * Handle query submission
   */
  async function handleQuery(query: string): Promise<void> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || isGenerating) return

    const notebookId = currentNotebookId || ''

    // Check for slash commands first
    const slashCommand = parseSlashCommand(trimmedQuery)
    if (slashCommand) {
      await executeSlashCommand(slashCommand.command)
      return
    }

    // Get sources if we have a notebook
    const sourcesForQuery = notebookId ? await storage.getSourcesByNotebook(notebookId) : []

    setIsGenerating(true)
    setChatStatus('Preparing...')

    // Create user event
    const userEvent = storage.createUserEvent(notebookId, trimmedQuery)
    await addEvent(userEvent)

    // Get conversation history for context
    const history = events.length > 0 ? events : [userEvent]

    try {
      // Get context mode and source tools
      const contextMode = await getContextMode()
      const tools = contextMode === 'agentic' ? await getSourceTools() : undefined

      const stream = streamChat(sourcesForQuery, trimmedQuery, history, {
        tools,
        contextMode,
        onStatus: (status) => {
          setChatStatus(status)
        },
      })

      // Create placeholder assistant event for streaming
      const assistantEvent = storage.createAssistantEvent(notebookId, '')
      streamingEventIdRef.current = assistantEvent.id

      let fullContent = ''
      let citations: Citation[] = []
      const toolCalls: ToolCall[] = []

      // Consume the stream
      let streamResult = await stream.next()
      while (!streamResult.done) {
        const event = streamResult.value

        if (event.type === 'text') {
          fullContent += event.content
          setStreamingContent(fullContent)
        }
        else if (event.type === 'tool-call') {
          toolCalls.push({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            timestamp: Date.now(),
          })
          setStreamingToolCalls([...toolCalls])
        }
        else if (event.type === 'tool-result') {
          const toolResultEvent = storage.createToolResultEvent(
            notebookId,
            event.toolCallId,
            event.toolName,
            event.result,
          )
          await addEvent(toolResultEvent)
        }

        streamResult = await stream.next()
      }

      // Stream finished - get final result with citations
      fullContent = streamResult.value.content
      citations = streamResult.value.citations

      // Update the assistant event with final content, citations, and tool calls
      const finalAssistantEvent = storage.createAssistantEvent(notebookId, fullContent, {
        citations,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      })
      await addEvent(finalAssistantEvent)

      // Clear streaming state
      setStreamingContent('')
      setStreamingCitations([])
      setStreamingToolCalls([])

      setChatStatus('Ask questions to synthesize information from your sources.')
    }
    catch (error) {
      console.error('Query failed:', error)
      const userFriendlyError = formatErrorForUser(error)

      const errorEvent = storage.createAssistantEvent(
        notebookId,
        `Failed to generate response: ${userFriendlyError}`,
      )
      await addEvent(errorEvent)

      setChatStatus(userFriendlyError)
    }
    finally {
      setIsGenerating(false)
    }
  }

  /**
   * Execute a slash command
   */
  async function executeSlashCommand(command: string): Promise<void> {
    switch (command) {
      case 'clear': {
        if (currentNotebookId) {
          const confirmed = window.confirm('Are you sure you want to clear all chat messages for this notebook?')
          if (confirmed) {
            await clearHistory(currentNotebookId)
          }
        }
        break
      }
      case 'summary': {
        if (!currentNotebookId) {
          setChatStatus('Please select a notebook first')
          return
        }
        setChatStatus('Generating overview...')
        setIsGenerating(true)
        try {
          const summary = await generateSummary(sources)
          const sourceIds = sources.map(s => s.id)
          const summaryEntity = storage.createSummary(currentNotebookId, sourceIds, summary)
          await storage.saveSummary(summaryEntity)

          // Add as assistant message
          const assistantEvent = storage.createAssistantEvent(currentNotebookId, `## Overview\n\n${summary}`)
          await addEvent(assistantEvent)

          setChatStatus('Ask questions to synthesize information from your sources.')
        }
        catch (error) {
          console.error('Summary generation failed:', error)
          setChatStatus('Failed to generate overview')
        }
        finally {
          setIsGenerating(false)
        }
        break
      }
      case 'help': {
        const helpText = `Available commands:
${SLASH_COMMANDS.map(c => `  /${c.command} - ${c.description}`).join('\n')}
`
        const notebookId = currentNotebookId || ''
        const assistantEvent = storage.createAssistantEvent(notebookId, helpText)
        await addEvent(assistantEvent)
        break
      }
      default:
        setChatStatus(`Unknown command: /${command}`)
    }
  }

  /**
   * Handle clear chat button click
   */
  async function handleClearChat(): Promise<void> {
    if (!currentNotebookId) return

    const confirmed = window.confirm('Are you sure you want to clear all chat messages for this notebook?')
    if (!confirmed) return

    await clearHistory(currentNotebookId)
  }

  /**
   * Handle regenerate summary button click
   */
  async function handleRegenerateSummary(): Promise<void> {
    if (!currentNotebookId) return

    setChatStatus('Regenerating overview...')
    setIsGenerating(true)
    try {
      const summary = await generateSummary(sources)
      const sourceIds = sources.map(s => s.id)
      const summaryEntity = storage.createSummary(currentNotebookId, sourceIds, summary)
      await storage.saveSummary(summaryEntity)

      // Add as assistant message
      const assistantEvent = storage.createAssistantEvent(currentNotebookId, `## Overview\n\n${summary}`)
      await addEvent(assistantEvent)

      setChatStatus('Ask questions to synthesize information from your sources.')
    }
    catch (error) {
      console.error('Summary generation failed:', error)
      setChatStatus('Failed to generate overview')
    }
    finally {
      setIsGenerating(false)
    }
  }

  /**
   * Handle add current tab button click
   */
  async function handleAddCurrentTabClick(): Promise<void> {
    if (!currentNotebookId) {
      showNotification('Please select a notebook first')
      return
    }

    try {
      const result = await addHighlightedTabs()
      if (result.added > 0) {
        showNotification(`Added ${result.added} source${result.added > 1 ? 's' : ''}`)
      }
    }
    catch (error) {
      console.error('Failed to add tab:', error)
      showNotification('Failed to add tab')
    }
  }

  function handlePickerClose(): void {
    setShowPicker(false)
  }

  // Build combined events list with streaming content
  const displayEvents = streamingContent
    ? [
        ...events,
        {
          id: streamingEventIdRef.current || crypto.randomUUID(),
          notebookId: currentNotebookId || '',
          timestamp: Date.now(),
          type: 'assistant',
          content: streamingContent,
          citations: streamingCitations,
          toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
        } as ChatEvent,
      ]
    : events

  const allSources = sources

  return (
    <section id="tab-chat" className={`tab-content ${active ? 'active' : ''}`}>
      {/* Summary Section (Collapsible) */}
      <details className="summary-section" style={{ display: 'none' }}>
        <summary className="summary-header">
          <h3 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            Overview
          </h3>
          <div className="summary-header-actions">
            <button
              className="btn btn-small btn-outline"
              onClick={handleRegenerateSummary}
              title="Regenerate overview"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <svg className="summary-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div className="summary-content">
          <div className="summary-loading">
            <span className="loading-spinner"></span>
            <span>Generating overview...</span>
          </div>
        </div>
      </details>

      {/* Sources Section */}
      <h3 className="section-title">
        Active Sources (
        <span>
          {sources.length}
        </span>
        )
        <a
          href="#"
          className="link"
          onClick={(e: Event): void => {
            e.preventDefault()
            setShowPicker(true)
          }}
        >
          Manage
        </a>
      </h3>
      <div className="sources-list compact">
        <SourcesList
          notebookId={currentNotebookId}
          onRemoveSource={(sourceId: string): void => {
            void removeSource(sourceId)
          }}
          limit={5}
        />
      </div>

      <button
        className="btn btn-outline btn-small"
        onClick={handleAddCurrentTabClick}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Current Page
      </button>

      {/* Chat Section */}
      <div className={styles.chatSection}>
        <div className={styles.chatHeader}>
          <h3 className={styles.chatHeaderSectionTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Chat History
          </h3>
          <button
            id="clear-chat-btn"
            className="btn btn-small btn-outline"
            onClick={handleClearChat}
            title="Clear chat history"
            type="button"
          >
            Clear
          </button>
        </div>
        <div id="chat-messages" className={styles.chatMessages}>
          <ChatMessages
            notebookId={currentNotebookId}
            events={displayEvents}
            sources={allSources}
            isStreaming={isGenerating}
            onCitationClick={(url: string): void => {
              void handleCitationClick(url)
            }}
          />
        </div>
      </div>

      {/* Query Input */}
      <div className="query-box">
        <ChatInput
          notebookId={currentNotebookId}
          onQuery={(query: string): void => {
            void handleQuery(query)
          }}
          slashCommands={SLASH_COMMANDS}
          isGenerating={isGenerating}
        />
      </div>
      <p id="chat-status" className="helper-text">{chatStatus}</p>

      {/* Picker Modal */}
      {showPicker && (
        <PickerModal
          onAddSources={handleAddSources}
          onClose={handlePickerClose}
        />
      )}
    </section>
  )
}

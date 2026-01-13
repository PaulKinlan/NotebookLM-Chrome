/**
 * ChatMessages Component
 *
 * Renders chat history with support for user, assistant, and tool-result messages.
 * Handles citations, tool calls, and streaming updates.
 */

import type { ChatEvent, Source, Citation } from '../../types/index.ts'
import { formatMarkdown, escapeHtml } from '../dom-utils.ts'
import { ToolApprovalsStateful } from './ToolApprovalsStateful.tsx'

interface ChatMessagesProps {
  notebookId: string | null
  events: ChatEvent[]
  sources: Source[]
  isStreaming?: boolean
  onCitationClick?: (url: string, excerpt: string) => void
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ============================================================================
// Types
// ============================================================================

interface GroupedCitation {
  sourceId: string
  sourceTitle: string
  sourceUrl: string
  excerpts: string[]
}

// ============================================================================
// Citation Components
// ============================================================================

interface ChatCitationsProps {
  key?: string // JSX key prop, extracted by runtime
  citations: Citation[]
  sources: Source[]
  onCitationClick?: (url: string, excerpt: string) => void
}

function groupCitations(citations: Citation[], sources: Source[]): GroupedCitation[] {
  const groupedMap = new Map<string, GroupedCitation>()

  for (const citation of citations) {
    const source = sources.find(s => s.id === citation.sourceId)
    const sourceUrl = source?.url || ''

    if (groupedMap.has(citation.sourceId)) {
      const group = groupedMap.get(citation.sourceId)
      if (group && !group.excerpts.includes(citation.excerpt)) {
        group.excerpts.push(citation.excerpt)
      }
    }
    else {
      groupedMap.set(citation.sourceId, {
        sourceId: citation.sourceId,
        sourceTitle: citation.sourceTitle,
        sourceUrl,
        excerpts: [citation.excerpt],
      })
    }
  }

  return Array.from(groupedMap.values())
}

function CitationItem({
  sourceId,
  sourceUrl,
  sourceTitle,
  excerpt,
  index,
  onCitationClick,
}: {
  sourceId: string
  sourceUrl: string
  sourceTitle: string
  excerpt: string
  index: string
  onCitationClick?: (url: string, excerpt: string) => void
}): Node {
  const handleClick = () => {
    if (onCitationClick) {
      onCitationClick(sourceUrl, excerpt)
    }
  }

  return (
    <div
      className="citation-item"
      data-source-id={sourceId}
      data-source-url={sourceUrl}
      data-excerpt={excerpt}
      onClick={handleClick}
    >
      <div className="citation-number">{index}</div>
      <div className="citation-content">
        <div className="citation-source">{sourceTitle}</div>
        <div className="citation-excerpt">{excerpt}</div>
      </div>
    </div>
  )
}

function CitationGroup({
  group,
  sourceIndex,
  onCitationClick,
}: {
  key?: string // JSX key prop, extracted by runtime
  group: GroupedCitation
  sourceIndex: number
  onCitationClick?: (url: string, excerpt: string) => void
}): Node {
  const sourceNumber = sourceIndex + 1

  if (group.excerpts.length === 1) {
    return CitationItem({
      sourceId: group.sourceId,
      sourceUrl: group.sourceUrl,
      sourceTitle: group.sourceTitle,
      excerpt: group.excerpts[0],
      index: String(sourceNumber),
      onCitationClick,
    })
  }

  return (
    <div className="citation-group">
      <div className="citation-group-header">
        <div className="citation-number">{sourceNumber}</div>
        <div className="citation-source">{group.sourceTitle}</div>
        <div className="citation-excerpt-count">
          {group.excerpts.length}
          {' '}
          references
        </div>
      </div>
      <div className="citation-group-excerpts">
        {group.excerpts.map((excerpt, excerptIndex) => {
          const subLabel = String.fromCharCode(97 + excerptIndex)
          return CitationItem({
            sourceId: group.sourceId,
            sourceUrl: group.sourceUrl,
            sourceTitle: group.sourceTitle,
            excerpt,
            index: `${sourceNumber}${subLabel}`,
            onCitationClick,
          })
        })}
      </div>
    </div>
  )
}

function ChatCitations({ citations, sources, onCitationClick }: ChatCitationsProps): Node | null {
  if (citations.length === 0) return null

  const grouped = groupCitations(citations, sources)

  return (
    <div className="chat-citations">
      <div className="chat-citations-title">
        Sources cited
        {' '}
        (
        {grouped.length}
        {' '}
        source
        {grouped.length !== 1 ? 's' : ''}
        )
      </div>
      {grouped.map((group, index) => (
        <CitationGroup
          key={group.sourceId}
          group={group}
          sourceIndex={index}
          onCitationClick={onCitationClick}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Tool Call Components
// ============================================================================

interface ToolCallProps {
  key?: string // JSX key prop, extracted by runtime
  toolName: string
  args: Record<string, unknown>
  status: 'calling' | 'done' | 'error'
}

function ToolCall({ toolName, args, status }: ToolCallProps): Node {
  const argsStr = JSON.stringify(args, null, 2)
  const statusText = status === 'calling'
    ? 'Calling...'
    : status === 'done'
      ? 'Called'
      : 'Error'

  return (
    <div className="assistant-tool-call">
      <div className="tool-call-header">
        <span className="tool-call-icon">🔧</span>
        <span className="tool-call-name">{escapeHtml(toolName)}</span>
        <span className={`tool-call-status ${status}`}>{statusText}</span>
      </div>
      {argsStr.length > 0 && (
        <div className="tool-call-args">
          <pre>{escapeHtml(argsStr)}</pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Message Components
// ============================================================================

interface UserMessageProps {
  key?: string // JSX key prop, extracted by runtime
  content: string
  timestamp: number
}

function UserMessage({ content, timestamp }: UserMessageProps): Node {
  const timeStr = formatRelativeTime(timestamp)

  return (
    <div className="chat-message user">
      <div className="chat-message-role">You</div>
      <div
        className="chat-message-content"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
      />
      <div className="chat-message-time">{timeStr}</div>
    </div>
  )
}

interface AssistantMessageProps {
  key?: string // JSX key prop, extracted by runtime
  content: string
  timestamp: number
  citations?: Citation[]
  sources: Source[]
  toolCalls?: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
  }>
  isStreaming?: boolean
  onCitationClick?: (url: string, excerpt: string) => void
}

function AssistantMessage({
  content,
  timestamp,
  citations,
  sources,
  toolCalls,
  isStreaming = false,
  onCitationClick,
}: AssistantMessageProps): Node {
  const timeStr = formatRelativeTime(timestamp)

  return (
    <div className="chat-message assistant">
      <div className="chat-message-role">Assistant</div>
      <div
        className="chat-message-content"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
      />
      {citations && citations.length > 0 && !isStreaming && (
        <ChatCitations
          citations={citations}
          sources={sources}
          onCitationClick={onCitationClick}
        />
      )}
      {toolCalls && toolCalls.length > 0 && (
        <div className="assistant-tool-calls">
          {toolCalls.map(tc => (
            <ToolCall
              key={tc.toolCallId}
              toolName={tc.toolName}
              args={tc.args}
              status="done"
            />
          ))}
        </div>
      )}
      <div className="chat-message-time">{timeStr}</div>
    </div>
  )
}

interface ToolResultMessageProps {
  key?: string // JSX key prop, extracted by runtime
  toolName: string
  result: unknown
  error?: string
  duration?: number
  timestamp: number
}

function ToolResultMessage({ toolName, result, error, duration, timestamp }: ToolResultMessageProps): Node {
  const timeStr = formatRelativeTime(timestamp)
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)

  return (
    <div className="chat-message tool-result">
      <div className="chat-message-role">📊 Result</div>
      <div className="chat-message-content">
        <div className="tool-result-source">
          from
          {' '}
          {escapeHtml(toolName)}
        </div>
        <div className="tool-result-data">
          <pre>{escapeHtml(resultStr)}</pre>
        </div>
        {error && <div className="tool-result-error">{escapeHtml(error)}</div>}
        {duration && (
          <div className="tool-result-duration">
            {duration}
            ms
          </div>
        )}
      </div>
      <div className="chat-message-time">{timeStr}</div>
    </div>
  )
}

// ============================================================================
// Main ChatMessages Component
// ============================================================================

export function ChatMessages({
  notebookId,
  events,
  sources,
  isStreaming = false,
  onCitationClick,
}: ChatMessagesProps): Node {
  // Handle empty notebook
  if (!notebookId) {
    return (
      <div className="empty-state">
        <p>Select a notebook to view chat history.</p>
      </div>
    )
  }

  // Handle no events
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <p>Ask a question to get started.</p>
      </div>
    )
  }

  // Render events
  return (
    <>
      {events.map((event) => {
        if (event.type === 'user') {
          return <UserMessage key={event.id} content={event.content} timestamp={event.timestamp} />
        }
        else if (event.type === 'assistant') {
          return (
            <AssistantMessage
              key={event.id}
              content={event.content}
              timestamp={event.timestamp}
              citations={event.citations}
              sources={sources}
              toolCalls={event.toolCalls}
              isStreaming={isStreaming}
              onCitationClick={onCitationClick}
            />
          )
        }
        else if (event.type === 'tool-result') {
          return (
            <ToolResultMessage
              key={event.id}
              toolName={event.toolName}
              result={event.result}
              error={event.error}
              duration={event.duration}
              timestamp={event.timestamp}
            />
          )
        }
        return null
      })}
      <ToolApprovalsStateful />
    </>
  )
}

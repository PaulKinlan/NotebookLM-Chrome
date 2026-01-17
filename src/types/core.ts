// ============================================================================
// Core Data Models
// ============================================================================

import type { JSONValue } from '@ai-sdk/provider'

// Re-export JSONValue for convenience
export type { JSONValue }

import type { SyncableEntity } from './sync.ts'

/**
 * A link extracted from source content
 */
export interface ExtractedLink {
  url: string
  text: string // Anchor text
  context: string // Surrounding text for context (~50 chars)
}

export interface Source extends SyncableEntity {
  notebookId: string
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text' | 'note' | 'image'
  url: string
  title: string
  content: string
  htmlContent?: string
  links?: ExtractedLink[] // Links extracted from the source content
  metadata?: {
    favicon?: string
    description?: string
    wordCount?: number
    // Image-specific metadata
    imageUrl?: string // Original image URL
    thumbnailUrl?: string // Data URL for thumbnail (base64)
    dimensions?: { width: number, height: number }
    altText?: string
    sourcePageUrl?: string // URL of the page the image was taken from
  }
  aiSummary?: {
    content: string // 2-3 sentence summary
    keyPoints: string[] // 3-5 bullet points
    generatedAt: number
  }
}

export interface Notebook extends SyncableEntity {
  name: string
  modelConfigId?: string // References ModelConfig.id. Optional: uses default if not set
  credentialOverrideId?: string // Optional: override credential for this notebook only
}

/**
 * Base event interface - all chat events have these fields
 */
export interface BaseChatEvent {
  id: string
  notebookId: string
  timestamp: number
}

/**
 * User message event
 */
export interface UserEvent extends BaseChatEvent {
  type: 'user'
  content: string
}

/**
 * Assistant message event - can contain inline tool calls
 */
export interface AssistantEvent extends BaseChatEvent {
  type: 'assistant'
  content: string
  citations?: Citation[]
  toolCalls?: ToolCall[] // Tool calls made during this response
}

/**
 * Tool result event - separate timeline entry showing tool execution result
 */
export interface ToolResultEvent extends BaseChatEvent {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  result: JSONValue
  error?: string
  duration?: number // milliseconds
}

/**
 * ChatEvent - union type for all events in chat history
 * Replaces ChatMessage to support tool call and result persistence
 */
export type ChatEvent = UserEvent | AssistantEvent | ToolResultEvent

/**
 * @deprecated Use ChatEvent instead. Kept for backward compatibility during migration.
 */
export interface ChatMessage {
  id: string
  notebookId: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  timestamp: number
}

export interface Citation {
  sourceId: string
  sourceTitle: string
  excerpt: string
}

export interface ToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  timestamp: number
}

/**
 * Response Cache (Offline Support)
 */
export interface CachedResponse {
  id: string // hash of query + sourceIds
  notebookId: string
  query: string
  sourceIds: string[]
  response: string
  citations: Citation[]
  createdAt: number
}

/**
 * Notebook Summary (Cached Overview)
 */
export interface NotebookSummary {
  id: string
  notebookId: string
  sourceIds: string[] // Track which sources were used to generate
  content: string
  createdAt: number
  updatedAt: number
}

/**
 * Suggested Links (AI-filtered)
 */

/**
 * A link that has been analyzed and recommended by AI
 */
export interface SuggestedLink {
  url: string
  title: string // AI-inferred or extracted title
  description: string // Why this link is relevant
  relevanceScore: number // 0-1 score from AI
  sourceId: string // Which source this link came from
  sourceTitle: string // Title of the source for attribution
}

/**
 * Cached suggested links for a notebook
 */
export interface SuggestedLinksCache {
  id: string
  notebookId: string
  sourceIds: string[] // Track which sources were analyzed
  links: SuggestedLink[]
  createdAt: number
  updatedAt: number
}

/**
 * Usage Tracking
 */

/**
 * Record of a single API usage event
 */
export interface UsageRecord {
  id: string
  modelConfigId: string // References ModelConfig.id
  providerId: string // Provider ID for pricing lookup
  model: string // Model ID used
  inputTokens: number // Prompt tokens
  outputTokens: number // Completion tokens
  totalTokens: number // Total tokens
  cost?: number // Calculated cost in USD (if pricing available)
  timestamp: number // When the API call was made
  operation: 'chat' | 'transform' | 'ranking' | 'summarization' | 'test' // Type of operation
}

/**
 * Aggregated usage statistics for a time period
 */
export interface UsageStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  requestCount: number
  records: UsageRecord[]
}

/**
 * Usage stats grouped by day/period for charting
 */
export interface UsageDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  requestCount: number
}

/**
 * Time range options for usage statistics
 */
export type UsageTimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * Content Extraction
 */
export interface ContentExtractionResult {
  url: string
  title: string
  content: string
  textContent: string
  links?: ExtractedLink[]
}

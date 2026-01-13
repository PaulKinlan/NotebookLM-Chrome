// ============================================================================
// Sync Infrastructure
// ============================================================================

export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict'

// Import JSONValue from Vercel AI SDK for type-safe tool results
import type { JSONValue } from '@ai-sdk/provider'

// Re-export for convenience
export type { JSONValue }

export interface SyncableEntity {
  id: string
  remoteId?: string
  syncStatus: SyncStatus
  lastSynced?: number
  createdAt: number
  updatedAt: number
}

// ============================================================================
// Core Data Models
// ============================================================================

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
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text'
  url: string
  title: string
  content: string
  htmlContent?: string
  links?: ExtractedLink[] // Links extracted from the source content
  metadata?: {
    favicon?: string
    description?: string
    wordCount?: number
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

// ============================================================================
// Response Cache (Offline Support)
// ============================================================================

export interface CachedResponse {
  id: string // hash of query + sourceIds
  notebookId: string
  query: string
  sourceIds: string[]
  response: string
  citations: Citation[]
  createdAt: number
}

// ============================================================================
// Notebook Summary (Cached Overview)
// ============================================================================

export interface NotebookSummary {
  id: string
  notebookId: string
  sourceIds: string[] // Track which sources were used to generate
  content: string
  createdAt: number
  updatedAt: number
}

// ============================================================================
// Suggested Links (AI-filtered)
// ============================================================================

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

// ============================================================================
// Usage Tracking
// ============================================================================

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

// ============================================================================
// AI Configuration
// ============================================================================

import type { AIProvider } from '../lib/provider-registry.js'

// ============================================================================
// AI Configuration System (Credentials + ModelConfigs)
// ============================================================================

// Credential: Named API key (user-managed)
// e.g., "Work OpenAI", "Personal Anthropic"
export interface Credential {
  id: string
  name: string // User-defined name
  apiKey: string
  createdAt: number
  updatedAt: number
}

// ModelConfig: Model settings (user-managed)
// References a Credential and a registry Provider entry
export interface ModelConfig {
  id: string
  name: string // User-defined name, e.g., "GPT-4 Turbo"
  credentialId: string // References Credential.id
  providerId: string // References registry entry id (e.g., "openai-z-ai")
  model: string // Model ID: "gpt-4-turbo", "claude-3-5-sonnet-20241022"
  temperature?: number
  maxTokens?: number
  isDefault?: boolean // Default model config
  compressionMode?: 'two-pass' | 'single-pass' // Context compression strategy
  createdAt: number
  updatedAt: number
}

// ============================================================================
// Agentic Tool-Calling
// ============================================================================

/**
 * Context delivery mode - controls how sources are provided to the LLM
 */
export type ContextMode = 'agentic' | 'classic'

/**
 * Represents a single tool call made by the LLM
 */
export interface ToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  timestamp: number
}

/**
 * Represents the result of a tool execution
 */
export interface ToolResult {
  toolCallId: string
  toolName: string
  result: unknown
  error?: string
  timestamp: number
  duration: number // milliseconds
}

/**
 * Stream event type - yielded by streamChat
 * Can be text delta, tool call, pending tool call (awaiting approval), or tool result
 */
export type StreamEvent
  = | { type: 'text', content: string }
    | { type: 'tool-call', toolName: string, args: Record<string, unknown>, toolCallId: string }
    | { type: 'tool-call-pending', toolName: string, args: Record<string, unknown>, toolCallId: string, approvalRequestId: string, reason: string }
    | { type: 'tool-result', toolName: string, result: JSONValue, toolCallId: string }

/**
 * Status of a tool approval request
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

/**
 * Scope of tool approval - how long the approval lasts
 */
export type ApprovalScope = 'once' | 'session' | 'forever'

/**
 * Permission configuration for a specific tool
 */
export interface ToolPermission {
  toolName: string
  visible: boolean // Whether tool is visible to LLM
  requiresApproval: boolean // Whether tool requires approval before execution
  autoApproved: boolean // If true, tool is auto-approved (set when user approves 'forever')
}

/**
 * Global tool permissions configuration
 */
export interface ToolPermissionsConfig {
  permissions: Record<string, ToolPermission>
  sessionApprovals: string[] // Tools approved for current session
  lastModified: number
}

/**
 * A request for user approval before executing a tool
 */
export interface ToolApprovalRequest {
  id: string // Unique ID for this approval request
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  reason: string // Human-readable explanation of why approval is needed
  timestamp: number
  status: ApprovalStatus
}

/**
 * User's response to a tool approval request
 */
export interface ToolApprovalResponse {
  requestId: string
  approved: boolean
  scope: ApprovalScope // How long this approval lasts
  timestamp: number
}

// Settings storage for new system
export interface CredentialSettings {
  credentials: Credential[]
  defaultCredentialId?: string
}

export interface ModelConfigSettings {
  modelConfigs: ModelConfig[]
  defaultModelConfigId: string
}

// Current AISettings (on main branch)
export interface AISettings {
  provider: AIProvider
  model: string
  apiKeys: Record<string, string>
  temperature?: number
  maxTokens?: number
  baseURL?: string // Deprecated: base URLs now hardcoded in registry
  contextMode?: 'classic' | 'agentic' // How to provide sources to AI
}

export type TTSProvider = 'openai' | 'elevenlabs' | 'google' | 'browser'

export interface TTSSettings {
  provider: TTSProvider
  apiKey?: string
  voice1: string
  voice2: string
}

// ============================================================================
// Transformations
// ============================================================================

export type TransformationType
  = | 'podcast'
    | 'quiz'
    | 'takeaways'
    | 'email'
    | 'slidedeck'
    | 'report'
    | 'datatable'
    | 'mindmap'
    | 'flashcards'
    | 'timeline'
    | 'glossary'
    | 'comparison'
    | 'faq'
    | 'actionitems'
    | 'executivebrief'
    | 'studyguide'
    | 'proscons'
    | 'citations'
    | 'outline'

export interface Transformation extends SyncableEntity {
  notebookId: string
  type: TransformationType
  title: string
  content: string
  sourceIds: string[]
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export interface Quiz {
  questions: QuizQuestion[]
}

// ============================================================================
// Transformation Configuration
// ============================================================================

/**
 * Common fields shared by all transformation configs
 */
export interface BaseTransformConfig {
  /** Custom instructions to append to the prompt */
  customInstructions?: string
}

/**
 * Podcast Script configuration
 */
export interface PodcastConfig extends BaseTransformConfig {
  /** Approximate duration in minutes */
  lengthMinutes: number
  /** Tone of the conversation */
  tone: 'casual' | 'professional' | 'educational' | 'entertaining'
  /** Number of speakers/hosts */
  speakerCount: 2 | 3
  /** Names for the speakers (optional) */
  speakerNames?: string[]
  /** Focus area or topic angle */
  focusArea?: string
}

/**
 * Quiz configuration
 */
export interface QuizConfig extends BaseTransformConfig {
  /** Number of questions to generate */
  questionCount: number
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  /** Types of questions to include */
  questionTypes: ('multiple-choice' | 'true-false')[]
  /** Whether to include explanations */
  includeExplanations: boolean
}

/**
 * Key Takeaways configuration
 */
export interface TakeawaysConfig extends BaseTransformConfig {
  /** Number of key points to extract */
  pointCount: number
  /** Format style */
  format: 'bullets' | 'numbered' | 'paragraphs'
  /** Include supporting details */
  includeDetails: boolean
}

/**
 * Email Summary configuration
 */
export interface EmailConfig extends BaseTransformConfig {
  /** Tone of the email */
  tone: 'formal' | 'casual' | 'professional'
  /** Target length */
  length: 'brief' | 'standard' | 'detailed'
  /** Include call to action */
  includeCallToAction: boolean
  /** Recipient context (e.g., "for my team", "for executives") */
  recipientContext?: string
}

/**
 * Slide Deck configuration
 */
export interface SlideDeckConfig extends BaseTransformConfig {
  /** Number of slides to generate */
  slideCount: number
  /** Style of the presentation */
  style: 'minimal' | 'detailed' | 'visual'
  /** Include speaker notes */
  includeSpeakerNotes: boolean
}

/**
 * Report configuration
 */
export interface ReportConfig extends BaseTransformConfig {
  /** Report format/style */
  format: 'academic' | 'business' | 'technical' | 'executive'
  /** Sections to include */
  sections: ('executive-summary' | 'introduction' | 'findings' | 'analysis' | 'conclusions' | 'recommendations')[]
  /** Target length */
  length: 'brief' | 'standard' | 'comprehensive'
}

/**
 * Data Table configuration
 */
export interface DataTableConfig extends BaseTransformConfig {
  /** Maximum number of columns */
  maxColumns: number
  /** Maximum number of rows */
  maxRows: number
  /** Include summary row */
  includeSummary: boolean
}

/**
 * Mind Map configuration
 */
export interface MindMapConfig extends BaseTransformConfig {
  /** Maximum depth of branches */
  maxDepth: number
  /** Maximum nodes per branch */
  maxNodesPerBranch: number
  /** Layout style */
  layout: 'radial' | 'tree' | 'organic'
}

/**
 * Flashcards configuration
 */
export interface FlashcardsConfig extends BaseTransformConfig {
  /** Number of flashcards to generate */
  cardCount: number
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  /** Card style */
  cardStyle: 'question-answer' | 'term-definition' | 'concept-example'
  /** Include hints */
  includeHints: boolean
}

/**
 * Timeline configuration
 */
export interface TimelineConfig extends BaseTransformConfig {
  /** Layout orientation */
  layout: 'vertical' | 'horizontal'
  /** Maximum number of events */
  maxEvents: number
  /** Include descriptions */
  includeDescriptions: boolean
  /** Group by category */
  groupByCategory: boolean
}

/**
 * Glossary configuration
 */
export interface GlossaryConfig extends BaseTransformConfig {
  /** Definition length */
  definitionLength: 'concise' | 'standard' | 'detailed'
  /** Include examples */
  includeExamples: boolean
  /** Include related terms */
  includeRelatedTerms: boolean
  /** Sort order */
  sortOrder: 'alphabetical' | 'by-importance' | 'by-category'
}

/**
 * Comparison configuration
 */
export interface ComparisonConfig extends BaseTransformConfig {
  /** Maximum items to compare */
  maxItems: number
  /** Comparison format */
  format: 'table' | 'side-by-side' | 'prose'
  /** Include overall recommendation */
  includeRecommendation: boolean
}

/**
 * FAQ configuration
 */
export interface FAQConfig extends BaseTransformConfig {
  /** Number of questions to generate */
  questionCount: number
  /** Answer length */
  answerLength: 'brief' | 'standard' | 'detailed'
  /** Question style */
  questionStyle: 'formal' | 'conversational'
  /** Group by topic */
  groupByTopic: boolean
}

/**
 * Action Items configuration
 */
export interface ActionItemsConfig extends BaseTransformConfig {
  /** Include priority levels */
  includePriority: boolean
  /** Priority format */
  priorityFormat: 'high-medium-low' | 'p1-p2-p3' | 'urgent-normal-low'
  /** Include deadlines/timeframes */
  includeTimeframes: boolean
  /** Group by category */
  groupByCategory: boolean
}

/**
 * Executive Brief configuration
 */
export interface ExecutiveBriefConfig extends BaseTransformConfig {
  /** Target length */
  length: 'one-page' | 'half-page' | 'two-pages'
  /** Sections to include */
  sections: ('overview' | 'key-findings' | 'implications' | 'recommendations' | 'next-steps')[]
  /** Focus area */
  focusArea?: string
}

/**
 * Study Guide configuration
 */
export interface StudyGuideConfig extends BaseTransformConfig {
  /** Depth of coverage */
  depth: 'overview' | 'standard' | 'comprehensive'
  /** Sections to include */
  sections: ('summary' | 'key-concepts' | 'examples' | 'practice-questions' | 'resources')[]
  /** Target audience level */
  audienceLevel: 'beginner' | 'intermediate' | 'advanced'
}

/**
 * Pros & Cons configuration
 */
export interface ProsConsConfig extends BaseTransformConfig {
  /** Format style */
  format: 'table' | 'lists' | 'detailed'
  /** Include neutral points */
  includeNeutral: boolean
  /** Include overall assessment */
  includeAssessment: boolean
  /** Weigh importance */
  weighImportance: boolean
}

/**
 * Citation List configuration
 */
export interface CitationsConfig extends BaseTransformConfig {
  /** Citation styles to generate */
  styles: ('apa' | 'mla' | 'chicago' | 'harvard' | 'ieee')[]
  /** Include annotations */
  includeAnnotations: boolean
  /** Group by type */
  groupByType: boolean
}

/**
 * Outline configuration
 */
export interface OutlineConfig extends BaseTransformConfig {
  /** Maximum depth of headings */
  maxDepth: number
  /** Outline style */
  style: 'alphanumeric' | 'decimal' | 'roman' | 'bullets'
  /** Include descriptions */
  includeDescriptions: boolean
}

/**
 * Union type mapping transformation types to their config types
 */
export interface TransformConfigMap {
  podcast: PodcastConfig
  quiz: QuizConfig
  takeaways: TakeawaysConfig
  email: EmailConfig
  slidedeck: SlideDeckConfig
  report: ReportConfig
  datatable: DataTableConfig
  mindmap: MindMapConfig
  flashcards: FlashcardsConfig
  timeline: TimelineConfig
  glossary: GlossaryConfig
  comparison: ComparisonConfig
  faq: FAQConfig
  actionitems: ActionItemsConfig
  executivebrief: ExecutiveBriefConfig
  studyguide: StudyGuideConfig
  proscons: ProsConsConfig
  citations: CitationsConfig
  outline: OutlineConfig
}

/**
 * Generic transformation config - type-safe based on transformation type
 */
export type TransformConfig<T extends TransformationType> = TransformConfigMap[T]

/**
 * Storage for all user transformation configs
 */
export interface TransformConfigSettings {
  configs: Partial<TransformConfigMap>
}

// ============================================================================
// Message Passing
// ============================================================================

export type MessageType
  = | 'EXTRACT_CONTENT'
    | 'EXTRACT_FROM_URL'
    | 'CONTENT_EXTRACTED'
    | 'ADD_SOURCE'
    | 'REMOVE_SOURCE'
    | 'GET_SOURCES'
    | 'QUERY_SOURCES'
    | 'REQUEST_PERMISSION'
    | 'REBUILD_CONTEXT_MENUS'
    | 'SOURCE_ADDED'
    | 'SOURCE_REFRESHED'
    | 'REFRESH_SOURCE'
    | 'REFRESH_ALL_SOURCES'
    | 'CREATE_NOTEBOOK'
    | 'CREATE_NOTEBOOK_AND_ADD_PAGE'
    | 'CREATE_NOTEBOOK_AND_ADD_LINK'
    | 'CREATE_NOTEBOOK_AND_ADD_SELECTION'
    | 'CREATE_NOTEBOOK_AND_ADD_SELECTION_LINKS'
  // Browser tools messages
    | 'LIST_WINDOWS'
    | 'LIST_TABS'
    | 'LIST_TAB_GROUPS'
    | 'READ_PAGE_CONTENT'

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

// ============================================================================
// Content Extraction
// ============================================================================

export interface ContentExtractionResult {
  url: string
  title: string
  content: string
  textContent: string
  links?: ExtractedLink[]
}

// ============================================================================
// Permissions
// ============================================================================

export interface PermissionStatus {
  tabs: boolean
  tabGroups: boolean
  bookmarks: boolean
  history: boolean
}

// ============================================================================
// Theme / UI Settings
// ============================================================================

/**
 * Theme preference options
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow system preference (prefers-color-scheme)
 */
export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * Resolved theme (what's actually applied to the UI)
 */
export type ResolvedTheme = 'light' | 'dark'

/**
 * UI Settings stored in chrome.storage.local
 */
export interface UISettings {
  themePreference: ThemePreference
}

// ============================================================================
// Storage Interface
// ============================================================================

export interface StorageAdapter {
  // Notebooks
  getNotebooks(): Promise<Notebook[]>
  getNotebook(id: string): Promise<Notebook | null>
  saveNotebook(notebook: Notebook): Promise<void>
  deleteNotebook(id: string): Promise<void>

  // Sources
  getSourcesByNotebook(notebookId: string): Promise<Source[]>
  getSource(id: string): Promise<Source | null>
  saveSource(source: Source): Promise<void>
  deleteSource(id: string): Promise<void>

  // Chat Events
  getChatHistory(notebookId: string): Promise<ChatEvent[]>
  saveChatEvent(event: ChatEvent): Promise<void>
  clearChatHistory(notebookId: string): Promise<void>

  // Transformations
  getTransformations(notebookId: string): Promise<Transformation[]>
  saveTransformation(transformation: Transformation): Promise<void>
  deleteTransformation(id: string): Promise<void>

  // Settings
  getSetting<T>(key: string): Promise<T | null>
  setSetting<T>(key: string, value: T): Promise<void>

  // Active notebook
  getActiveNotebookId(): Promise<string | null>
  setActiveNotebookId(id: string | null): Promise<void>

  // Response Cache
  getCachedResponse(cacheKey: string): Promise<CachedResponse | null>
  saveCachedResponse(cached: CachedResponse): Promise<void>
  getCachedResponsesByNotebook(notebookId: string): Promise<CachedResponse[]>
  clearResponseCache(notebookId: string): Promise<void>

  // Notebook Summary
  getSummary(notebookId: string): Promise<NotebookSummary | null>
  saveSummary(summary: NotebookSummary): Promise<void>
  deleteSummary(notebookId: string): Promise<void>

  // Clear all data
  clearAll(): Promise<void>
}

// ============================================================================
// AI Configuration System (Credentials + ModelConfigs)
// ============================================================================

import type { JSONValue } from '@ai-sdk/provider'
import type { AIProvider } from '../lib/provider-registry.js'

/**
 * Credential: Named API key (user-managed)
 * e.g., "Work OpenAI", "Personal Anthropic"
 */
export interface Credential {
  id: string
  name: string // User-defined name
  apiKey: string
  createdAt: number
  updatedAt: number
}

/**
 * ModelConfig: Model settings (user-managed)
 * References a Credential and a registry Provider entry
 */
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

/**
 * Settings storage for new system
 */
export interface CredentialSettings {
  credentials: Credential[]
  defaultCredentialId?: string
}

export interface ModelConfigSettings {
  modelConfigs: ModelConfig[]
  defaultModelConfigId: string
}

/**
 * Current AISettings
 */
export interface AISettings {
  provider: AIProvider
  model: string
  apiKeys: Record<string, string>
  temperature?: number
  maxTokens?: number
  baseURL?: string // Deprecated: base URLs now hardcoded in registry
  contextMode?: 'classic' | 'agentic' // How to provide sources to AI
}

/**
 * TTS Settings
 */
export type TTSProvider = 'openai' | 'elevenlabs' | 'google' | 'browser'

export interface TTSSettings {
  provider: TTSProvider
  apiKey?: string
  voice1: string
  voice2: string
}

// ============================================================================
// Agentic Tool-Calling
// ============================================================================

/**
 * Context delivery mode - controls how sources are provided to the LLM
 */
export type ContextMode = 'agentic' | 'classic'

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
 * Can be text delta, tool call, or tool result
 */
export type StreamEvent
  = | { type: 'text', content: string }
    | { type: 'tool-call', toolName: string, args: Record<string, unknown>, toolCallId: string }
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

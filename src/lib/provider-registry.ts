/**
 * Centralized Provider Registry
 *
 * Single source of truth for all provider configurations.
 * This registry defines metadata, defaults, and capabilities for each AI provider.
 *
 * Factory functions define common patterns; providers specify only their unique values.
 * Unique providers are defined inline.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createHuggingFace } from '@ai-sdk/huggingface'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { builtInAI } from '@built-in-ai/core'
import { createVertexExpress } from './vertex-express'
import type { LanguageModel } from 'ai'

/**
 * Authentication style for API requests
 */
export type AuthStyle = 'bearer' | 'x-api-key' | 'query' | 'none'

/**
 * Model pricing per million tokens (in USD)
 */
export interface ModelPricing {
  inputPerMillion: number // Cost per million input tokens
  outputPerMillion: number // Cost per million output tokens
}

/**
 * Pricing map for models within a provider
 * Key is the model ID (or prefix for wildcard matching)
 */
export type ProviderPricingMap = Record<string, ModelPricing>

/**
 * Provider feature flags
 */
export interface ProviderFeatures {
  /** Supports dynamic model fetching via API */
  supportsModelFetching: boolean
  /** Requires API key for model fetching */
  requiresApiKeyForFetching: boolean
  /** Requires API key for chat completion */
  requiresApiKey: boolean
  /** Authentication style for API requests */
  authStyle: AuthStyle
  /** Additional headers to include in requests (e.g., anthropic-version) */
  extraHeaders?: Record<string, string>
}

/**
 * Model list response format configuration
 */
export interface ModelsResponseFormat {
  /** Path to models array in response: 'data', 'models', or '' for root array */
  modelsPath: string
  /** Field to use as model ID */
  idField: string
  /** Field to use as display name */
  nameField: string
}

/**
 * Model option for fuzzy search dropdown
 */
export interface ModelOption {
  /** Model ID to send to API */
  value: string
  /** Human-readable display name */
  label: string
}

/**
 * Model ID transformation function
 */
export type ModelIdTransform = (id: string) => string

/**
 * Provider configuration metadata
 */
export interface ProviderConfig<Id extends string = string> {
  /** Internal provider identifier */
  id: Id
  /** Human-readable display name */
  displayName: string
  /** Default model to use if none specified */
  defaultModel: string
  /** API base URL for chat completion (hardcoded for CSP compliance) */
  baseURL?: string
  /** API endpoint for fetching available models */
  modelsAPIEndpoint?: string
  /** Feature support flags */
  features: ProviderFeatures
  /** Response format for model list API */
  modelsResponseFormat: ModelsResponseFormat
  /** Optional transform function to process model IDs (e.g., strip prefixes) */
  modelIdTransform?: ModelIdTransform
  /** Group name for organizing providers in UI */
  group: string
  /** Function to create a LanguageModel instance for this provider */
  createModel: (apiKey: string, modelId: string, baseURL?: string) => LanguageModel
  /** Commonly used models for fuzzy search dropdown */
  commonModels?: readonly ModelOption[]
  /** Whether custom model IDs (not in the fetched list) are allowed. Default: true */
  allowCustomModels?: boolean
  /** Model pricing information for cost calculation */
  pricing?: ProviderPricingMap
}

// ============================================================================
// Provider Factory Functions (for shared patterns)
// ============================================================================

/**
 * Factory for Anthropic-compatible providers
 * Used by: anthropic, zai-anthropic
 */
function anthropicProvider(
  config: { id: string, displayName: string, defaultModel: string, baseURL: string, pricing?: ProviderPricingMap },
): ProviderConfig {
  const { id, displayName, defaultModel, baseURL, pricing } = config
  return {
    id,
    displayName,
    defaultModel,
    baseURL,
    modelsAPIEndpoint: `${baseURL}/models`,
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: true,
      requiresApiKey: true,
      authStyle: 'x-api-key',
      extraHeaders: { 'anthropic-version': '2023-06-01' },
    },
    modelsResponseFormat: { modelsPath: 'data', idField: 'id', nameField: 'display_name' },
    group: 'Anthropic',
    createModel: (apiKey, modelId, baseURL) =>
      createAnthropic({ apiKey, baseURL })(modelId),
    pricing,
  }
}

/**
 * Factory for OpenAI-compatible providers
 * Used by: openrouter, mistral, together, deepinfra, perplexity, fireworks, zai-openai, zai-coding
 */
function openAICompatibleProvider(
  config: {
    id: string
    displayName: string
    defaultModel: string
    baseURL: string
    modelsAPIEndpoint?: string
    authStyle?: 'bearer' | 'none'
    requiresApiKeyForFetching?: boolean
    modelIdTransform?: ModelIdTransform
    pricing?: ProviderPricingMap
  },
): ProviderConfig {
  const { id, displayName, defaultModel, baseURL, modelsAPIEndpoint, authStyle, requiresApiKeyForFetching, modelIdTransform, pricing } = config
  return {
    id,
    displayName,
    defaultModel,
    baseURL,
    modelsAPIEndpoint: modelsAPIEndpoint ?? `${baseURL}/models`,
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: requiresApiKeyForFetching ?? true,
      requiresApiKey: true,
      authStyle: authStyle ?? 'bearer',
    },
    modelsResponseFormat: { modelsPath: 'data', idField: 'id', nameField: 'id' },
    modelIdTransform,
    group: 'OpenAI-Compatible',
    createModel: (apiKey, modelId, baseURL) =>
      createOpenAICompatible({ name: id, apiKey, baseURL: baseURL ?? '' })(modelId),
    pricing,
  }
}

/**
 * Provider Registry
 *
 * Centralized configuration for all supported AI providers.
 * All base URLs are hardcoded for Chrome extension CSP compliance.
 * The type is inferred from the registry keys - add providers here and they're automatically available.
 */
export const PROVIDER_REGISTRY = {
  // ==========================================================================
  // Anthropic (Claude)
  // ==========================================================================
  'anthropic': anthropicProvider({
    id: 'anthropic',
    displayName: 'Anthropic',
    defaultModel: 'claude-sonnet-4-5-20250514',
    baseURL: 'https://api.anthropic.com/v1',
    pricing: {
      // Claude 4.5 models
      'claude-opus-4-5': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
      'claude-sonnet-4-5': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
      // Claude 4 models
      'claude-4-opus': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
      'claude-4-sonnet': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
      // Claude 3.5 models
      'claude-3-5-sonnet': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
      'claude-3-5-haiku': { inputPerMillion: 0.80, outputPerMillion: 4.00 },
      // Claude 3 models
      'claude-3-opus': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
      'claude-3-sonnet': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
      'claude-3-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
    },
  }),

  // ==========================================================================
  // OpenAI
  // ==========================================================================
  'openai': {
    id: 'openai',
    displayName: 'OpenAI',
    defaultModel: 'gpt-5',
    baseURL: 'https://api.openai.com/v1',
    modelsAPIEndpoint: 'https://api.openai.com/v1/models',
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: true,
      requiresApiKey: true,
      authStyle: 'bearer',
    },
    modelsResponseFormat: {
      modelsPath: 'data',
      idField: 'id',
      nameField: 'id',
    },
    group: 'OpenAI',
    createModel: (apiKey: string, modelId: string, baseURL?: string) =>
      createOpenAI({ apiKey, baseURL })(modelId),
    pricing: {
      // GPT-5 models
      'gpt-5': { inputPerMillion: 5.00, outputPerMillion: 15.00 },
      'gpt-5-mini': { inputPerMillion: 0.30, outputPerMillion: 1.20 },
      // GPT-4.1 models
      'gpt-4.1': { inputPerMillion: 2.00, outputPerMillion: 8.00 },
      'gpt-4.1-mini': { inputPerMillion: 0.40, outputPerMillion: 1.60 },
      'gpt-4.1-nano': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
      // GPT-4o models
      'gpt-4o': { inputPerMillion: 2.50, outputPerMillion: 10.00 },
      'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
      // GPT-4 Turbo
      'gpt-4-turbo': { inputPerMillion: 10.00, outputPerMillion: 30.00 },
      // o1/o3 reasoning models
      'o1': { inputPerMillion: 15.00, outputPerMillion: 60.00 },
      'o1-mini': { inputPerMillion: 3.00, outputPerMillion: 12.00 },
      'o3': { inputPerMillion: 10.00, outputPerMillion: 40.00 },
      'o3-mini': { inputPerMillion: 1.10, outputPerMillion: 4.40 },
    },
  },

  // ==========================================================================
  // OpenRouter (aggregator)
  // ==========================================================================
  'openrouter': {
    id: 'openrouter',
    displayName: 'OpenRouter',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    baseURL: 'https://openrouter.ai/api/v1',
    modelsAPIEndpoint: 'https://openrouter.ai/api/v1/models',
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: false,
      requiresApiKey: true,
      authStyle: 'bearer',
    },
    modelsResponseFormat: {
      modelsPath: 'data',
      idField: 'id',
      nameField: 'name',
    },
    group: 'OpenRouter',
    createModel: (apiKey: string, modelId: string) =>
      createOpenRouter({ apiKey })(modelId),
  },

  // ==========================================================================
  // Google (Gemini)
  // ==========================================================================
  'google': {
    id: 'google',
    displayName: 'Google',
    defaultModel: 'gemini-3-pro-preview',
    modelsAPIEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: true,
      requiresApiKey: true,
      authStyle: 'query',
    },
    modelsResponseFormat: {
      modelsPath: 'models',
      idField: 'name',
      nameField: 'displayName',
    },
    modelIdTransform: (id: string) => id.replace('models/', ''),
    group: 'Google',
    createModel: (apiKey: string, modelId: string) =>
      createGoogleGenerativeAI({ apiKey })(modelId),
    pricing: {
      // Gemini 3 series
      'gemini-3-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      'gemini-3-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
      // Gemini 2.5 series
      'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      'gemini-2.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
      'gemini-2.5-flash-lite': { inputPerMillion: 0.02, outputPerMillion: 0.08 },
      // Gemini 2.0 series
      'gemini-2.0-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
      'gemini-2.0-flash-lite': { inputPerMillion: 0.025, outputPerMillion: 0.10 },
      // Gemini 1.5 series
      'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
    },
  },

  // ==========================================================================
  // Google Vertex Express (API key auth)
  // ==========================================================================
  // Note: Vertex Express has no model listing API - common models are provided
  // @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode
  // @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models
  'vertex-express': {
    id: 'vertex-express',
    displayName: 'Vertex Express',
    defaultModel: 'gemini-2.5-flash',
    features: {
      supportsModelFetching: false,
      requiresApiKeyForFetching: false,
      requiresApiKey: true,
      authStyle: 'bearer',
    },
    modelsResponseFormat: {
      modelsPath: '',
      idField: 'id',
      nameField: 'name',
    },
    group: 'Google',
    createModel: (apiKey: string, modelId: string) =>
      createVertexExpress(modelId, { apiKey }),
    commonModels: [
      // Gemini 3 series
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
      { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
      // Gemini 2.5 series
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
      // Gemini 2.0 series
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      // Gemini 1.5 series
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ] as const,
    // Same pricing as Google AI Studio
    pricing: {
      'gemini-3-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      'gemini-3-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
      'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      'gemini-2.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
      'gemini-2.5-flash-lite': { inputPerMillion: 0.02, outputPerMillion: 0.08 },
      'gemini-2.0-flash': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
      'gemini-2.0-flash-lite': { inputPerMillion: 0.025, outputPerMillion: 0.10 },
      'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
    },
  },

  // ==========================================================================
  // Groq
  // ==========================================================================
  'groq': {
    id: 'groq',
    displayName: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
    modelsAPIEndpoint: 'https://api.groq.com/openai/v1/models',
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: true,
      requiresApiKey: true,
      authStyle: 'bearer',
    },
    modelsResponseFormat: {
      modelsPath: 'data',
      idField: 'id',
      nameField: 'id',
    },
    group: 'Groq',
    createModel: (apiKey: string, modelId: string, baseURL?: string) =>
      createGroq({ apiKey, baseURL })(modelId),
    pricing: {
      // Llama 3.3 models
      'llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
      'llama-3.3-70b-specdec': { inputPerMillion: 0.59, outputPerMillion: 0.99 },
      // Llama 3.1 models
      'llama-3.1-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
      'llama-3.1-8b-instant': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
      // Llama 3 models
      'llama3-70b-8192': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
      'llama3-8b-8192': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
      // Mixtral
      'mixtral-8x7b-32768': { inputPerMillion: 0.24, outputPerMillion: 0.24 },
      // Gemma
      'gemma2-9b-it': { inputPerMillion: 0.20, outputPerMillion: 0.20 },
    },
  },

  // ==========================================================================
  // Hugging Face
  // ==========================================================================
  'huggingface': {
    id: 'huggingface',
    displayName: 'Hugging Face',
    defaultModel: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    baseURL: 'https://router.huggingface.co/v1',
    modelsAPIEndpoint: 'https://huggingface.co/api/models',
    features: {
      supportsModelFetching: true,
      requiresApiKeyForFetching: false,
      requiresApiKey: true,
      authStyle: 'none',
    },
    modelsResponseFormat: {
      modelsPath: '', // Root array
      idField: 'id',
      nameField: 'modelId',
    },
    group: 'Hugging Face',
    createModel: (apiKey: string, modelId: string, baseURL?: string) =>
      createHuggingFace({
        apiKey,
        baseURL: baseURL || '',
      })(modelId),
  },

  // ==========================================================================
  // Mistral AI
  // ==========================================================================
  'mistral': openAICompatibleProvider({
    id: 'mistral',
    displayName: 'Mistral',
    defaultModel: 'mistral-large-latest',
    baseURL: 'https://api.mistral.ai/v1',
    pricing: {
      'mistral-large': { inputPerMillion: 2.00, outputPerMillion: 6.00 },
      'mistral-medium': { inputPerMillion: 2.70, outputPerMillion: 8.10 },
      'mistral-small': { inputPerMillion: 0.20, outputPerMillion: 0.60 },
      'codestral': { inputPerMillion: 0.20, outputPerMillion: 0.60 },
      'open-mixtral-8x22b': { inputPerMillion: 2.00, outputPerMillion: 6.00 },
      'open-mixtral-8x7b': { inputPerMillion: 0.70, outputPerMillion: 0.70 },
      'open-mistral-7b': { inputPerMillion: 0.25, outputPerMillion: 0.25 },
    },
  }),

  // ==========================================================================
  // Together AI
  // ==========================================================================
  'together': openAICompatibleProvider({
    id: 'together',
    displayName: 'Together AI',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    baseURL: 'https://api.together.xyz/v1',
    pricing: {
      'Meta-Llama-3.1-405B': { inputPerMillion: 3.50, outputPerMillion: 3.50 },
      'Meta-Llama-3.1-70B': { inputPerMillion: 0.88, outputPerMillion: 0.88 },
      'Meta-Llama-3.1-8B': { inputPerMillion: 0.18, outputPerMillion: 0.18 },
      'Mixtral-8x22B': { inputPerMillion: 1.20, outputPerMillion: 1.20 },
      'Mixtral-8x7B': { inputPerMillion: 0.60, outputPerMillion: 0.60 },
      'Qwen2.5-72B': { inputPerMillion: 1.20, outputPerMillion: 1.20 },
    },
  }),

  // ==========================================================================
  // DeepInfra
  // ==========================================================================
  'deepinfra': openAICompatibleProvider({
    id: 'deepinfra',
    displayName: 'DeepInfra',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    requiresApiKeyForFetching: false,
    pricing: {
      'Meta-Llama-3.1-405B': { inputPerMillion: 1.79, outputPerMillion: 1.79 },
      'Meta-Llama-3.1-70B': { inputPerMillion: 0.35, outputPerMillion: 0.40 },
      'Meta-Llama-3.1-8B': { inputPerMillion: 0.06, outputPerMillion: 0.06 },
      'Mixtral-8x22B': { inputPerMillion: 0.65, outputPerMillion: 0.65 },
      'Qwen2.5-72B': { inputPerMillion: 0.35, outputPerMillion: 0.40 },
    },
  }),

  // ==========================================================================
  // Perplexity
  // ==========================================================================
  'perplexity': openAICompatibleProvider({
    id: 'perplexity',
    displayName: 'Perplexity',
    defaultModel: 'sonar',
    baseURL: 'https://api.perplexity.ai',
    modelsAPIEndpoint: 'https://openrouter.ai/api/v1/models',
    modelIdTransform: (id: string) => id.replace('perplexity/', ''),
    pricing: {
      'sonar': { inputPerMillion: 1.00, outputPerMillion: 1.00 },
      'sonar-pro': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
      'sonar-reasoning': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
    },
  }),

  // ==========================================================================
  // Fireworks AI
  // ==========================================================================
  'fireworks': openAICompatibleProvider({
    id: 'fireworks',
    displayName: 'Fireworks AI',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    pricing: {
      'llama-v3p1-405b': { inputPerMillion: 3.00, outputPerMillion: 3.00 },
      'llama-v3p1-70b': { inputPerMillion: 0.90, outputPerMillion: 0.90 },
      'llama-v3p1-8b': { inputPerMillion: 0.20, outputPerMillion: 0.20 },
      'mixtral-8x22b': { inputPerMillion: 0.90, outputPerMillion: 0.90 },
      'qwen2p5-72b': { inputPerMillion: 0.90, outputPerMillion: 0.90 },
    },
  }),

  // ==========================================================================
  // z.ai - GLM Models (Zhipu AI)
  // ==========================================================================

  // z.ai Anthropic-compatible API (general usage)
  'zai-anthropic': anthropicProvider({
    id: 'zai-anthropic',
    displayName: 'z.ai (GLM - Anthropic)',
    defaultModel: 'glm-4.7',
    baseURL: 'https://api.z.ai/api/anthropic/v1',
  }),

  // z.ai OpenAI-compatible API (general usage)
  'zai-openai': openAICompatibleProvider({
    id: 'zai-openai',
    displayName: 'z.ai (GLM - OpenAI)',
    defaultModel: 'glm-4.7',
    baseURL: 'https://api.z.ai/api/paas/v4',
  }),

  // z.ai Coding API (coding scenarios only with GLM Coding Plan)
  'zai-coding': openAICompatibleProvider({
    id: 'zai-coding',
    displayName: 'z.ai (GLM - Coding)',
    defaultModel: 'glm-4.7',
    baseURL: 'https://api.z.ai/api/coding/paas/v4',
  }),

  // ==========================================================================
  // Chrome Built-in AI
  // ==========================================================================
  'chrome': {
    id: 'chrome',
    displayName: 'Chrome Built-in',
    defaultModel: 'chrome-built-in',
    features: {
      supportsModelFetching: false,
      requiresApiKeyForFetching: false,
      requiresApiKey: false,
      authStyle: 'none',
    },
    modelsResponseFormat: {
      modelsPath: '',
      idField: 'id',
      nameField: 'name',
    },
    group: 'Built-in',
    createModel: () => builtInAI(),
  },
} as const

/**
 * AI Provider type - inferred from registry keys
 *
 * This type is automatically derived from the PROVIDER_REGISTRY object.
 * When you add a new provider to the registry, it's automatically included in this type.
 */
export type AIProvider = typeof PROVIDER_REGISTRY[keyof typeof PROVIDER_REGISTRY]['id']

/**
 * Type guard to check if a string is a valid provider key
 */
function isValidProviderKey(key: string): key is keyof typeof PROVIDER_REGISTRY {
  return key in PROVIDER_REGISTRY
}

/**
 * Get provider configuration from registry
 */
export function getProviderConfig(provider: AIProvider): ProviderConfig {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider]
  }
  throw new Error(`Invalid provider: ${provider}`)
}

/**
 * Get provider configuration by registry entry ID
 */
export function getProviderConfigById(id: string): ProviderConfig | null {
  return getAllProviders().find(p => p.id === id) || null
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: AIProvider): string {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].displayName
  }
  throw new Error(`Invalid provider: ${provider}`)
}

/**
 * Get provider default model
 */
export function getProviderDefaultModel(provider: AIProvider): string {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].defaultModel
  }
  throw new Error(`Invalid provider: ${provider}`)
}

/**
 * Get provider base URL (hardcoded for CSP compliance)
 */
export function getProviderBaseURL(provider: AIProvider): string | undefined {
  if (isValidProviderKey(provider)) {
    const config = PROVIDER_REGISTRY[provider]
    return 'baseURL' in config ? config.baseURL : undefined
  }
  throw new Error(`Invalid provider: ${provider}`)
}

/**
 * Check if provider supports model fetching
 */
export function providerSupportsModelFetching(provider: AIProvider): boolean {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].features.supportsModelFetching
  }
  return false
}

/**
 * Check if provider requires API key
 */
export function providerRequiresApiKey(provider: AIProvider): boolean {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].features.requiresApiKey
  }
  return false
}

/**
 * Check if provider requires API key for model fetching
 */
export function providerRequiresApiKeyForFetching(provider: AIProvider): boolean {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].features.requiresApiKeyForFetching
  }
  return false
}

/**
 * Get all providers that support model fetching
 */
export function getProvidersWithModelFetching(): AIProvider[] {
  return Object.keys(PROVIDER_REGISTRY).filter(isValidProviderKey).filter(
    p => PROVIDER_REGISTRY[p].features.supportsModelFetching,
  )
}

/**
 * Get all providers as an array for UI rendering
 */
export function getAllProviders(): ProviderConfig[] {
  return Object.keys(PROVIDER_REGISTRY).filter(isValidProviderKey).map(
    p => PROVIDER_REGISTRY[p],
  )
}

// ============================================================================
// Model Pricing
// ============================================================================

/**
 * Get pricing for a specific model from a provider
 * Uses prefix matching to find the best pricing entry for a model
 *
 * @param providerId - The provider ID
 * @param modelId - The model ID to look up
 * @returns ModelPricing if found, null if no pricing data available
 */
export function getModelPricing(providerId: string, modelId: string): ModelPricing | null {
  const provider = getProviderConfigById(providerId)
  if (!provider?.pricing) {
    return null
  }

  // Try exact match first
  if (provider.pricing[modelId]) {
    return provider.pricing[modelId]
  }

  // Try prefix matching (e.g., "claude-sonnet-4-5-20250514" matches "claude-sonnet-4-5")
  // Sort keys by length (longest first) to get most specific match
  const sortedKeys = Object.keys(provider.pricing).sort((a, b) => b.length - a.length)

  for (const key of sortedKeys) {
    if (modelId.startsWith(key) || modelId.includes(key)) {
      return provider.pricing[key]
    }
  }

  return null
}

/**
 * Calculate cost for a given number of tokens
 *
 * @param providerId - The provider ID
 * @param modelId - The model ID
 * @param inputTokens - Number of input/prompt tokens
 * @param outputTokens - Number of output/completion tokens
 * @returns Cost in USD, or null if pricing not available
 */
export function calculateTokenCost(
  providerId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = getModelPricing(providerId, modelId)
  if (!pricing) {
    return null
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion

  return inputCost + outputCost
}

// ============================================================================
// Model Fetching
// ============================================================================

const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

interface CachedModels<T> {
  data: T[]
  timestamp: number
}

/**
 * Type guard to check if value is a record with string keys
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Unified model interface for dropdown
 */
export interface SelectableModel {
  id: string
  name: string
}

/**
 * Generic model fetcher for any provider
 * Uses provider registry configuration for auth and response parsing
 */
async function fetchModelsByProvider(
  providerType: AIProvider,
  apiKey?: string,
): Promise<unknown[]> {
  const config = getProviderConfig(providerType)

  if (!config.modelsAPIEndpoint) {
    throw new Error(`${providerType} does not support model fetching`)
  }

  // Build URL (handle query param auth)
  let url = config.modelsAPIEndpoint
  if (config.features.authStyle === 'query' && apiKey) {
    url += `?key=${apiKey}`
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.features.extraHeaders,
  }

  if (apiKey) {
    switch (config.features.authStyle) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${apiKey}`
        break
      case 'x-api-key':
        headers['x-api-key'] = apiKey
        break
    }
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`${providerType} API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  // Extract models array based on configured path
  if (config.modelsResponseFormat.modelsPath === '') {
    // Root array
    return Array.isArray(data) ? data : []
  }

  // Nested path (e.g., 'data', 'models')
  const path = config.modelsResponseFormat.modelsPath
  return data[path] || []
}

/**
 * Get cached models or fetch if expired
 * Generic function for all providers
 */
async function getModelsByProvider(
  providerType: AIProvider,
  apiKey?: string,
  forceRefresh = false,
): Promise<unknown[]> {
  const cacheKey = `${providerType}_models_cache`

  if (!forceRefresh) {
    try {
      const cached = await getCachedModels<unknown>(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`[ProviderRegistry] Using cached ${providerType} models`)
        return cached.data
      }
      console.log(`[ProviderRegistry] Cache expired or missing, fetching fresh ${providerType} models`)
    }
    catch (error) {
      console.error('[ProviderRegistry] Failed to read cache:', error)
    }
  }

  const models = await fetchModelsByProvider(providerType, apiKey)
  await setCachedModels(cacheKey, models)

  return models
}

/**
 * Fetch and map models to SelectableModel format
 */
export async function fetchProviderSelectableModels(
  providerType: AIProvider,
  apiKey?: string,
  forceRefresh = false,
): Promise<SelectableModel[]> {
  const config = getProviderConfig(providerType)
  const models = await getModelsByProvider(providerType, apiKey, forceRefresh)
  const fmt = config.modelsResponseFormat

  return models
    .map((m: unknown) => {
      if (!isRecord(m)) return null
      const model = m // Type is now Record<string, unknown> via type guard
      let id = model[fmt.idField]
      const name = model[fmt.nameField] || id

      // Apply model ID transformation if configured
      if (id && typeof id === 'string' && config.modelIdTransform) {
        id = config.modelIdTransform(id)
      }

      return id && typeof id === 'string' ? { id, name: String(name ?? id) } : null
    })
    .filter((m): m is SelectableModel => m !== null)
}

/**
 * Auto-fetch models for a provider after it is saved
 * Returns count of fetched models (0 if fetch not supported or failed)
 */
export async function autoFetchProviderModels(provider: { provider: AIProvider, apiKey?: string, name?: string }): Promise<number> {
  const providerType = provider.provider

  if (!providerSupportsModelFetching(providerType)) {
    console.log(`[ProviderRegistry] Provider ${providerType} does not support model fetching`)
    return 0
  }

  if (providerRequiresApiKeyForFetching(providerType) && !provider.apiKey) {
    console.log(`[ProviderRegistry] Provider ${providerType} requires API key for fetching, skipping`)
    return 0
  }

  try {
    const selectableModels = await fetchProviderSelectableModels(
      providerType,
      provider.apiKey,
      true, // force refresh
    )

    console.log(`[ProviderRegistry] Auto-fetched ${selectableModels.length} models for ${provider.name || providerType}`)
    return selectableModels.length
  }
  catch (error) {
    console.error(`[ProviderRegistry] Auto-fetch failed for ${provider.name || providerType}:`, error)
    return 0
  }
}

/**
 * Clear the models cache for a specific provider
 */
export async function clearProviderModelsCache(provider: AIProvider): Promise<void> {
  const cacheKey = `${provider}_models_cache`

  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([cacheKey], () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      }
      else {
        console.log(`[ProviderRegistry] Cache cleared for ${provider}`)
        resolve()
      }
    })
  })
}

/**
 * Get models from chrome.storage.local cache
 */
function getCachedModels<T>(cacheKey: string): Promise<CachedModels<T> | null> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([cacheKey], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      }
      else {
        const cached = result[cacheKey] as CachedModels<T> | undefined
        resolve(cached || null)
      }
    })
  })
}

/**
 * Set models in chrome.storage.local cache
 */
function setCachedModels<T>(cacheKey: string, models: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const cached: CachedModels<T> = {
      data: models,
      timestamp: Date.now(),
    }

    chrome.storage.local.set({ [cacheKey]: cached }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      }
      else {
        console.log(`[ProviderRegistry] Cached ${models.length} models for ${cacheKey}`)
        resolve()
      }
    })
  })
}

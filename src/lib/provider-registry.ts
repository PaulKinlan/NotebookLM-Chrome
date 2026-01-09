/**
 * Centralized Provider Registry
 *
 * Single source of truth for all provider configurations.
 * This registry defines metadata, defaults, and capabilities for each AI provider.
 *
 * Factory functions define common patterns; providers specify only their unique values.
 * Unique providers are defined inline.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { builtInAI } from '@built-in-ai/core';
import { createVertexExpress } from './vertex-express';
import type { LanguageModel } from 'ai';

/**
 * Authentication style for API requests
 */
export type AuthStyle = 'bearer' | 'x-api-key' | 'query' | 'none';

/**
 * Provider feature flags
 */
export interface ProviderFeatures {
  /** Supports dynamic model fetching via API */
  supportsModelFetching: boolean;
  /** Requires API key for model fetching */
  requiresApiKeyForFetching: boolean;
  /** Requires API key for chat completion */
  requiresApiKey: boolean;
  /** Authentication style for API requests */
  authStyle: AuthStyle;
  /** Additional headers to include in requests (e.g., anthropic-version) */
  extraHeaders?: Record<string, string>;
}

/**
 * Model list response format configuration
 */
export interface ModelsResponseFormat {
  /** Path to models array in response: 'data', 'models', or '' for root array */
  modelsPath: string;
  /** Field to use as model ID */
  idField: string;
  /** Field to use as display name */
  nameField: string;
}

/**
 * Model option for fuzzy search dropdown
 */
export interface ModelOption {
  /** Model ID to send to API */
  value: string;
  /** Human-readable display name */
  label: string;
}

/**
 * Model ID transformation function
 */
export type ModelIdTransform = (id: string) => string;

/**
 * Provider configuration metadata
 */
export interface ProviderConfig<Id extends string = string> {
  /** Internal provider identifier */
  id: Id;
  /** Human-readable display name */
  displayName: string;
  /** Default model to use if none specified */
  defaultModel: string;
  /** API base URL for chat completion (hardcoded for CSP compliance) */
  baseURL?: string;
  /** API endpoint for fetching available models */
  modelsAPIEndpoint?: string;
  /** Feature support flags */
  features: ProviderFeatures;
  /** Response format for model list API */
  modelsResponseFormat: ModelsResponseFormat;
  /** Optional transform function to process model IDs (e.g., strip prefixes) */
  modelIdTransform?: ModelIdTransform;
  /** Group name for organizing providers in UI */
  group: string;
  /** Function to create a LanguageModel instance for this provider */
  createModel: (apiKey: string, modelId: string, baseURL?: string) => LanguageModel;
  /** Commonly used models for fuzzy search dropdown */
  commonModels?: readonly ModelOption[];
  /** Whether custom model IDs (not in the fetched list) are allowed. Default: true */
  allowCustomModels?: boolean;
}

// ============================================================================
// Provider Factory Functions (for shared patterns)
// ============================================================================

/**
 * Factory for Anthropic-compatible providers
 * Used by: anthropic, zai-anthropic
 */
function anthropicProvider(
  config: { id: string; displayName: string; defaultModel: string; baseURL: string }
): ProviderConfig {
  const { id, displayName, defaultModel, baseURL } = config;
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
  };
}

/**
 * Factory for OpenAI-compatible providers
 * Used by: openrouter, mistral, together, deepinfra, perplexity, fireworks, zai-openai, zai-coding
 */
function openAICompatibleProvider(
  config: {
    id: string;
    displayName: string;
    defaultModel: string;
    baseURL: string;
    modelsAPIEndpoint?: string;
    authStyle?: 'bearer' | 'none';
    requiresApiKeyForFetching?: boolean;
    modelIdTransform?: ModelIdTransform;
  }
): ProviderConfig {
  const { id, displayName, defaultModel, baseURL, modelsAPIEndpoint, authStyle, requiresApiKeyForFetching, modelIdTransform } = config;
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
  };
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
  anthropic: anthropicProvider({
    id: 'anthropic',
    displayName: 'Anthropic',
    defaultModel: 'claude-sonnet-4-5-20250514',
    baseURL: 'https://api.anthropic.com/v1',
  }),

  // ==========================================================================
  // OpenAI
  // ==========================================================================
  openai: {
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
  },

  // ==========================================================================
  // OpenRouter (aggregator)
  // ==========================================================================
  openrouter: {
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
  google: {
    id: 'google',
    displayName: 'Google',
    defaultModel: 'gemini-2.5-flash',
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
    createModel: (apiKey: string, modelId: string, _baseURL?: string) =>
      createGoogleGenerativeAI({ apiKey })(modelId),
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
  },

  // ==========================================================================
  // Groq
  // ==========================================================================
  groq: {
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
  },

  // ==========================================================================
  // Hugging Face
  // ==========================================================================
  huggingface: {
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
      modelsPath: '',  // Root array
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
  mistral: openAICompatibleProvider({
    id: 'mistral',
    displayName: 'Mistral',
    defaultModel: 'mistral-large-latest',
    baseURL: 'https://api.mistral.ai/v1',
  }),

  // ==========================================================================
  // Together AI
  // ==========================================================================
  together: openAICompatibleProvider({
    id: 'together',
    displayName: 'Together AI',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    baseURL: 'https://api.together.xyz/v1',
  }),

  // ==========================================================================
  // DeepInfra
  // ==========================================================================
  deepinfra: openAICompatibleProvider({
    id: 'deepinfra',
    displayName: 'DeepInfra',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    requiresApiKeyForFetching: false,
  }),

  // ==========================================================================
  // Perplexity
  // ==========================================================================
  perplexity: openAICompatibleProvider({
    id: 'perplexity',
    displayName: 'Perplexity',
    defaultModel: 'sonar',
    baseURL: 'https://api.perplexity.ai',
    modelsAPIEndpoint: 'https://openrouter.ai/api/v1/models',
    modelIdTransform: (id: string) => id.replace('perplexity/', ''),
  }),

  // ==========================================================================
  // Fireworks AI
  // ==========================================================================
  fireworks: openAICompatibleProvider({
    id: 'fireworks',
    displayName: 'Fireworks AI',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    baseURL: 'https://api.fireworks.ai/inference/v1',
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
  chrome: {
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
    createModel: (_apiKey: string, _modelId: string, _baseURL?: string) => builtInAI(),
  },
} as const;

/**
 * AI Provider type - inferred from registry keys
 *
 * This type is automatically derived from the PROVIDER_REGISTRY object.
 * When you add a new provider to the registry, it's automatically included in this type.
 */
export type AIProvider = typeof PROVIDER_REGISTRY[keyof typeof PROVIDER_REGISTRY]['id'];

/**
 * Type guard to check if a string is a valid provider key
 */
function isValidProviderKey(key: string): key is keyof typeof PROVIDER_REGISTRY {
  return key in PROVIDER_REGISTRY;
}

/**
 * Get provider configuration from registry
 */
export function getProviderConfig(provider: AIProvider): ProviderConfig {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider];
  }
  throw new Error(`Invalid provider: ${provider}`);
}

/**
 * Get provider configuration by registry entry ID
 */
export function getProviderConfigById(id: string): ProviderConfig | null {
  return getAllProviders().find((p) => p.id === id) || null;
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: AIProvider): string {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].displayName;
  }
  throw new Error(`Invalid provider: ${provider}`);
}

/**
 * Get provider default model
 */
export function getProviderDefaultModel(provider: AIProvider): string {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].defaultModel;
  }
  throw new Error(`Invalid provider: ${provider}`);
}

/**
 * Get provider base URL (hardcoded for CSP compliance)
 */
export function getProviderBaseURL(provider: AIProvider): string | undefined {
  if (isValidProviderKey(provider)) {
    const config = PROVIDER_REGISTRY[provider];
    return 'baseURL' in config ? config.baseURL : undefined;
  }
  throw new Error(`Invalid provider: ${provider}`);
}

/**
 * Check if provider supports model fetching
 */
export function providerSupportsModelFetching(provider: AIProvider): boolean {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].features.supportsModelFetching;
  }
  return false;
}

/**
 * Check if provider requires API key
 */
export function providerRequiresApiKey(provider: AIProvider): boolean {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].features.requiresApiKey;
  }
  return false;
}

/**
 * Check if provider requires API key for model fetching
 */
export function providerRequiresApiKeyForFetching(provider: AIProvider): boolean {
  if (isValidProviderKey(provider)) {
    return PROVIDER_REGISTRY[provider].features.requiresApiKeyForFetching;
  }
  return false;
}

/**
 * Get all providers that support model fetching
 */
export function getProvidersWithModelFetching(): AIProvider[] {
  return Object.keys(PROVIDER_REGISTRY).filter(isValidProviderKey).filter(
    (p) => PROVIDER_REGISTRY[p].features.supportsModelFetching
  );
}

/**
 * Get all providers as an array for UI rendering
 */
export function getAllProviders(): ProviderConfig[] {
  return Object.keys(PROVIDER_REGISTRY).filter(isValidProviderKey).map(
    (p) => PROVIDER_REGISTRY[p]
  );
}

// ============================================================================
// Model Fetching
// ============================================================================

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedModels<T> {
  data: T[];
  timestamp: number;
}

/**
 * Unified model interface for dropdown
 */
export interface SelectableModel {
  id: string;
  name: string;
}

/**
 * Generic model fetcher for any provider
 * Uses provider registry configuration for auth and response parsing
 */
async function fetchModelsByProvider(
  providerType: AIProvider,
  apiKey?: string
): Promise<unknown[]> {
  const config = getProviderConfig(providerType);

  if (!config.modelsAPIEndpoint) {
    throw new Error(`${providerType} does not support model fetching`);
  }

  // Build URL (handle query param auth)
  let url = config.modelsAPIEndpoint;
  if (config.features.authStyle === 'query' && apiKey) {
    url += `?key=${apiKey}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.features.extraHeaders,
  };

  if (apiKey) {
    switch (config.features.authStyle) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'x-api-key':
        headers['x-api-key'] = apiKey;
        break;
    }
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`${providerType} API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Extract models array based on configured path
  if (config.modelsResponseFormat.modelsPath === '') {
    // Root array
    return Array.isArray(data) ? data : [];
  }

  // Nested path (e.g., 'data', 'models')
  const path = config.modelsResponseFormat.modelsPath;
  return data[path] || [];
}

/**
 * Get cached models or fetch if expired
 * Generic function for all providers
 */
async function getModelsByProvider(
  providerType: AIProvider,
  apiKey?: string,
  forceRefresh = false
): Promise<unknown[]> {
  const cacheKey = `${providerType}_models_cache`;

  if (!forceRefresh) {
    try {
      const cached = await getCachedModels<unknown>(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    } catch (error) {
      console.error('[ProviderRegistry] Failed to read cache:', error);
    }
  }

  const models = await fetchModelsByProvider(providerType, apiKey);
  await setCachedModels(cacheKey, models);

  return models;
}

/**
 * Fetch and map models to SelectableModel format
 */
export async function fetchProviderSelectableModels(
  providerType: AIProvider,
  apiKey?: string,
  forceRefresh = false
): Promise<SelectableModel[]> {
  const config = getProviderConfig(providerType);
  const models = await getModelsByProvider(providerType, apiKey, forceRefresh);
  const fmt = config.modelsResponseFormat;

  return models
    .map((m: unknown) => {
      if (typeof m !== 'object' || m === null) return null;
      const model = m as Record<string, unknown>;
      let id = model[fmt.idField];
      const name = model[fmt.nameField] || id;

      // Apply model ID transformation if configured
      if (id && typeof id === 'string' && config.modelIdTransform) {
        id = config.modelIdTransform(id);
      }

      return id && typeof id === 'string' ? { id, name: String(name ?? id) } : null;
    })
    .filter((m): m is SelectableModel => m !== null);
}

/**
 * Auto-fetch models for a provider after it is saved
 * Returns count of fetched models (0 if fetch not supported or failed)
 */
export async function autoFetchProviderModels(provider: { provider: AIProvider; apiKey?: string; name?: string }): Promise<number> {
  const providerType = provider.provider;

  if (!providerSupportsModelFetching(providerType)) {
    return 0;
  }

  if (providerRequiresApiKeyForFetching(providerType) && !provider.apiKey) {
    return 0;
  }

  try {
    const selectableModels = await fetchProviderSelectableModels(
      providerType,
      provider.apiKey,
      true  // force refresh
    );

    return selectableModels.length;
  } catch (error) {
    console.error(`[ProviderRegistry] Auto-fetch failed for ${provider.name || providerType}:`, error);
    return 0;
  }
}

/**
 * Clear the models cache for a specific provider
 */
export async function clearProviderModelsCache(provider: AIProvider): Promise<void> {
  const cacheKey = `${provider}_models_cache`;

  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([cacheKey], () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get models from chrome.storage.local cache
 */
function getCachedModels<T>(cacheKey: string): Promise<CachedModels<T> | null> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([cacheKey], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[cacheKey] || null);
      }
    });
  });
}

/**
 * Set models in chrome.storage.local cache
 */
function setCachedModels<T>(cacheKey: string, models: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const cached: CachedModels<T> = {
      data: models,
      timestamp: Date.now(),
    };

    chrome.storage.local.set({ [cacheKey]: cached }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

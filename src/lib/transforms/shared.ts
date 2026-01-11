/**
 * Shared utilities for transform functions
 */
import { generateText, type LanguageModel } from 'ai';
import type { Source, Notebook } from '../../types/index.ts';
import { getActiveNotebookId, getNotebook } from '../storage.ts';
import { resolveModelConfig } from '../model-configs.ts';
import {
  getProviderConfig,
  getProviderDefaultModel,
  providerRequiresApiKey,
  type AIProvider,
} from '../provider-registry.ts';

// Re-export generateText for use in transforms
export { generateText };

// Re-export Source type for convenience
export type { Source };

/**
 * Model with config info for usage tracking
 */
export interface ModelWithConfig {
  model: LanguageModel;
  modelConfigId: string;
  providerId: string;
  modelId: string;
}

/**
 * Create a LanguageModel instance for the given provider
 */
function createProviderInstance(
  providerType: AIProvider,
  apiKey: string,
  modelId: string,
  baseURL?: string
): LanguageModel | null {
  const config = getProviderConfig(providerType);

  if (!baseURL) {
    baseURL = config.baseURL;
  }

  return config.createModel(apiKey, modelId, baseURL);
}

/**
 * Get the configured AI model
 */
export async function getModel(): Promise<LanguageModel | null> {
  const activeNotebookId = await getActiveNotebookId();

  let notebook: Notebook | undefined;
  if (activeNotebookId) {
    const notebookResult = await getNotebook(activeNotebookId);
    if (notebookResult) {
      notebook = notebookResult;
    }
  }

  const resolved = await resolveModelConfig(notebook);

  if (!resolved) {
    throw new Error('No AI model configured. Please add a model configuration in settings.');
  }

  const { modelConfig, credential, providerType, baseURL } = resolved;
  const apiKey = credential.apiKey;
  const modelId = modelConfig.model;

  const defaultModel = getProviderDefaultModel(providerType);
  const requiresApiKey = providerRequiresApiKey(providerType);

  if (requiresApiKey && !apiKey) {
    return null;
  }

  return createProviderInstance(
    providerType,
    apiKey,
    modelId || defaultModel,
    baseURL
  );
}

/**
 * Get the configured AI model with config info for usage tracking
 */
export async function getModelWithConfig(): Promise<ModelWithConfig | null> {
  const activeNotebookId = await getActiveNotebookId();

  let notebook: Notebook | undefined;
  if (activeNotebookId) {
    const notebookResult = await getNotebook(activeNotebookId);
    if (notebookResult) {
      notebook = notebookResult;
    }
  }

  const resolved = await resolveModelConfig(notebook);

  if (!resolved) {
    throw new Error('No AI model configured. Please add a model configuration in settings.');
  }

  const { modelConfig, credential, providerType, providerId, baseURL } = resolved;
  const apiKey = credential.apiKey;
  const modelId = modelConfig.model;

  const defaultModel = getProviderDefaultModel(providerType);
  const requiresApiKey = providerRequiresApiKey(providerType);

  if (requiresApiKey && !apiKey) {
    return null;
  }

  const model = createProviderInstance(
    providerType,
    apiKey,
    modelId || defaultModel,
    baseURL
  );

  if (!model) {
    return null;
  }

  return {
    model,
    modelConfigId: modelConfig.id,
    providerId,
    modelId: modelId || defaultModel,
  };
}

/**
 * Simple context builder for transformations (no compression)
 * Used when there's no specific query to rank against
 */
export function buildSourceContextSimple(sources: Source[]): string {
  return sources
    .map((source, i) => {
      return `[Source ${i + 1}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`;
    })
    .join('\n\n---\n\n');
}

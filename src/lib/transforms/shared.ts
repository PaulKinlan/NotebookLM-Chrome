/**
 * Shared utilities for transform functions
 */
import { generateText, type LanguageModel } from 'ai'
import type { Source, Notebook } from '../../types/index.ts'
import { getActiveNotebookId, getNotebook } from '../storage.ts'
import { resolveModelConfig } from '../model-configs.ts'
import {
  getProviderConfig,
  getProviderDefaultModel,
  providerRequiresApiKey,
  providerSupportsVision,
  type AIProvider,
} from '../provider-registry.ts'

// Re-export generateText for use in transforms
export { generateText }

// Re-export Source type for convenience
export type { Source }

/**
 * Model with config info for usage tracking
 */
export interface ModelWithConfig {
  model: LanguageModel
  modelConfigId: string
  providerId: string
  modelId: string
  supportsVision: boolean
  providerType: AIProvider
}

/**
 * Create a LanguageModel instance for the given provider
 */
function createProviderInstance(
  providerType: AIProvider,
  apiKey: string,
  modelId: string,
  baseURL?: string,
): LanguageModel | null {
  const config = getProviderConfig(providerType)

  if (!baseURL) {
    baseURL = config.baseURL
  }

  return config.createModel(apiKey, modelId, baseURL)
}

/**
 * Get the configured AI model
 */
export async function getModel(): Promise<LanguageModel | null> {
  const activeNotebookId = await getActiveNotebookId()

  let notebook: Notebook | undefined
  if (activeNotebookId) {
    const notebookResult = await getNotebook(activeNotebookId)
    if (notebookResult) {
      notebook = notebookResult
    }
  }

  const resolved = await resolveModelConfig(notebook)

  if (!resolved) {
    throw new Error('No AI model configured. Please add a model configuration in settings.')
  }

  const { modelConfig, credential, providerType, baseURL } = resolved
  const apiKey = credential.apiKey
  const modelId = modelConfig.model

  const defaultModel = getProviderDefaultModel(providerType)
  const requiresApiKey = providerRequiresApiKey(providerType)

  if (requiresApiKey && !apiKey) {
    return null
  }

  return createProviderInstance(
    providerType,
    apiKey,
    modelId || defaultModel,
    baseURL,
  )
}

/**
 * Get the configured AI model with config info for usage tracking
 */
export async function getModelWithConfig(): Promise<ModelWithConfig | null> {
  const activeNotebookId = await getActiveNotebookId()

  let notebook: Notebook | undefined
  if (activeNotebookId) {
    const notebookResult = await getNotebook(activeNotebookId)
    if (notebookResult) {
      notebook = notebookResult
    }
  }

  const resolved = await resolveModelConfig(notebook)

  if (!resolved) {
    throw new Error('No AI model configured. Please add a model configuration in settings.')
  }

  const { modelConfig, credential, providerType, providerId, baseURL } = resolved
  const apiKey = credential.apiKey
  const modelId = modelConfig.model

  const defaultModel = getProviderDefaultModel(providerType)
  const requiresApiKey = providerRequiresApiKey(providerType)

  if (requiresApiKey && !apiKey) {
    return null
  }

  const model = createProviderInstance(
    providerType,
    apiKey,
    modelId || defaultModel,
    baseURL,
  )

  if (!model) {
    return null
  }

  return {
    model,
    modelConfigId: modelConfig.id,
    providerId,
    modelId: modelId || defaultModel,
    supportsVision: providerSupportsVision(providerType),
    providerType,
  }
}

/**
 * Simple context builder for transformations (no compression)
 * Used when there's no specific query to rank against
 */
export function buildSourceContextSimple(sources: Source[]): string {
  return sources
    .map((source, i) => {
      return `[Source ${i + 1}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`
    })
    .join('\n\n---\n\n')
}

// ============================================================================
// Multimodal Support for Transforms
// ============================================================================

/**
 * Image source with URL for multimodal AI
 */
export interface ImageSource {
  id: string
  title: string
  url: string
  altText?: string
}

/**
 * Extract image sources from the sources array
 */
export function extractImageSources(sources: Source[]): ImageSource[] {
  return sources
    .filter(source => source.type === 'image')
    .map(source => ({
      id: source.id,
      title: source.title,
      url: source.metadata?.imageUrl || source.url,
      altText: source.metadata?.altText,
    }))
    .filter(img => img.url && !img.url.startsWith('data:')) // Filter out data URLs (too large)
}

/**
 * Multimodal content type for user messages
 */
export type MultimodalContent = Array<
  | { type: 'text', text: string }
  | { type: 'image', image: URL }
>

/**
 * Build multimodal user message content with text and images
 * Uses Vercel AI SDK format: array of { type: 'text' | 'image', ... }
 */
export function buildMultimodalPrompt(
  textPrompt: string,
  images: ImageSource[],
): MultimodalContent {
  const content: MultimodalContent = []

  // Add text content first
  content.push({ type: 'text', text: textPrompt })

  // Add images (limit to 10 to avoid token limits)
  const imagesToInclude = images.slice(0, 10)
  for (const img of imagesToInclude) {
    try {
      content.push({
        type: 'image',
        image: new URL(img.url),
      })
      // Add image description as text
      if (img.altText || img.title) {
        content.push({
          type: 'text',
          text: `[Image: ${img.title}${img.altText ? ` - ${img.altText}` : ''}]`,
        })
      }
    }
    catch (error) {
      console.warn(`[Transform] Failed to create URL for image ${img.id}:`, error)
    }
  }

  return content
}

/**
 * Generate text with optional multimodal support
 * Automatically uses multimodal format when images are available and provider supports vision
 */
export async function generateTextWithImages(
  modelConfig: ModelWithConfig,
  systemPrompt: string,
  textPrompt: string,
  sources: Source[],
): Promise<{ text: string, usage?: { inputTokens?: number, outputTokens?: number } }> {
  const images = modelConfig.supportsVision ? extractImageSources(sources) : []
  const hasImages = images.length > 0

  if (hasImages) {
    console.log(`[Transform] Including ${images.length} images in multimodal context`)

    // Use messages API for multimodal content
    const result = await generateText({
      model: modelConfig.model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: buildMultimodalPrompt(textPrompt, images),
        },
      ],
    })

    return { text: result.text, usage: result.usage }
  }

  // Text-only: use simple prompt API
  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: textPrompt,
  })

  return { text: result.text, usage: result.usage }
}

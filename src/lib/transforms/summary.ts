import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'

export async function generateSummary(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig()
  if (!config) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates concise overviews.
Write a single cohesive paragraph that provides an overview of all the materials.
The paragraph should flow naturally and cover what the sources are about, their key themes, and how they relate to each other.
Be concise but thorough - the paragraph can be long if needed to capture the essence of all sources.
Do not use bullet points, headings, or multiple paragraphs. Output only the overview paragraph.`,
    prompt: `Write a concise overview paragraph for these sources:

${buildSourceContextSimple(sources)}`,
  })

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: config.modelConfigId,
      providerId: config.providerId,
      model: config.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch(err => console.warn('[Transform] Failed to track summary usage:', err))
  }

  return result.text
}

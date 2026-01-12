import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'

export async function generateKeyTakeaways(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig()
  if (!config) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that extracts key takeaways.
Create a bulleted list of the most important points from the sources.
Each takeaway should be clear, actionable, and self-contained.`,
    prompt: `Extract the key takeaways from these sources:

${buildSourceContextSimple(sources)}

Format as a bulleted list with clear, concise points.`,
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
    }).catch(err => console.warn('[Transform] Failed to track key-takeaways usage:', err))
  }

  return result.text
}

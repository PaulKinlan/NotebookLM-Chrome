import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { TakeawaysConfig } from '../../types/index.ts'
import { DEFAULT_TAKEAWAYS_CONFIG } from '../transform-config.ts'

export async function generateKeyTakeaways(
  sources: Source[],
  config: Partial<TakeawaysConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_TAKEAWAYS_CONFIG, ...config }

  // Format descriptions
  const formatDesc: Record<typeof c.format, string> = {
    bullets: 'bullet points (using - or •)',
    numbered: 'a numbered list',
    paragraphs: 'short paragraphs with clear headings',
  }

  const detailsNote = c.includeDetails
    ? 'Include a brief supporting detail or context for each point.'
    : 'Keep each point concise and self-contained without additional details.'

  const systemPrompt = `You are a helpful AI assistant that extracts key takeaways.
Create ${formatDesc[c.format]} with the ${c.pointCount} most important points from the sources.
Each takeaway should be clear, actionable, and self-contained.
${detailsNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: `Extract the ${c.pointCount} key takeaways from these sources:

${buildSourceContextSimple(sources)}

Format as ${formatDesc[c.format]} with clear, concise points.`,
  })

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: modelConfig.modelConfigId,
      providerId: modelConfig.providerId,
      model: modelConfig.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch(err => console.warn('[Transform] Failed to track key-takeaways usage:', err))
  }

  return result.text
}

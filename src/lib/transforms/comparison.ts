import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { ComparisonConfig } from '../../types/index.ts'
import { DEFAULT_COMPARISON_CONFIG } from '../transform-config.ts'

export async function generateComparison(
  sources: Source[],
  config: Partial<ComparisonConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_COMPARISON_CONFIG, ...config }

  // Format descriptions
  const formatDesc: Record<typeof c.format, string> = {
    'table': 'a markdown table format',
    'side-by-side': 'side-by-side columns for each item',
    'prose': 'narrative prose format with clear comparisons',
  }

  const recommendationNote = c.includeRecommendation
    ? '\nInclude a recommendation or conclusion based on the comparison.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates comparison charts.
Identify up to ${c.maxItems} items, concepts, or options that can be compared from the sources.
Present a balanced comparison using ${formatDesc[c.format]} with relevant criteria.${recommendationNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const formatExample = c.format === 'table'
    ? `Format as a markdown table:
| Criteria | ${Array.from({ length: c.maxItems }, (_, i) => `Option ${i + 1}`).join(' | ')} |
|----------|${Array.from({ length: c.maxItems }, () => '----------|').join('')}
| Feature 1| Detail${Array.from({ length: c.maxItems - 1 }, () => '   | Detail').join('')}   |`
    : c.format === 'side-by-side'
      ? `Format with clear side-by-side sections for each item being compared, using headers and consistent criteria.`
      : `Format as narrative prose, clearly comparing the items point by point.`

  const textPrompt = `Create a comparison of items found in these sources:

${buildSourceContextSimple(sources)}

Compare up to ${c.maxItems} items.
${formatExample}

${c.includeRecommendation ? 'Include a summary with your recommendation based on the comparison.' : 'Include a summary of key differences and similarities.'}`

  const result = await generateTextWithImages(modelConfig, systemPrompt, textPrompt, sources)

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: modelConfig.modelConfigId,
      providerId: modelConfig.providerId,
      model: modelConfig.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch(err => console.warn('[Transform] Failed to track comparison usage:', err))
  }

  return result.text
}

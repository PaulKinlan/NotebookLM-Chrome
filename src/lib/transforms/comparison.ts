import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'

export async function generateComparison(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig()
  if (!config) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates comparison charts.
Identify items, concepts, or options that can be compared from the sources.
Present a balanced side-by-side comparison with relevant criteria.`,
    prompt: `Create a comparison chart based on these sources:

${buildSourceContextSimple(sources)}

Format as a markdown table comparing key items:
| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Feature 1| Detail   | Detail   | Detail   |
| Feature 2| Detail   | Detail   | Detail   |

Include a summary of key differences and similarities after the table.`,
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
    }).catch(err => console.warn('[Transform] Failed to track comparison usage:', err))
  }

  return result.text
}

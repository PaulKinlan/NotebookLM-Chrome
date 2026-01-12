import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'

export async function generateGlossary(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig()
  if (!config) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates glossaries.
Identify key terms, concepts, and jargon from the sources.
Provide clear, concise definitions for each term.`,
    prompt: `Create a glossary of key terms from these sources:

${buildSourceContextSimple(sources)}

Format as an alphabetically organized list:
## Glossary

**Term 1**: Definition of the term in clear, accessible language.

**Term 2**: Definition...

Include technical terms, acronyms, and important concepts.`,
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
    }).catch(err => console.warn('[Transform] Failed to track glossary usage:', err))
  }

  return result.text
}

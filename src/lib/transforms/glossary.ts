import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { GlossaryConfig } from '../../types/index.ts'
import { DEFAULT_GLOSSARY_CONFIG } from '../transform-config.ts'

export async function generateGlossary(
  sources: Source[],
  config: Partial<GlossaryConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_GLOSSARY_CONFIG, ...config }

  // Definition length descriptions
  const lengthDesc: Record<typeof c.definitionLength, string> = {
    concise: 'very brief, one-sentence definitions',
    standard: 'clear, moderate-length definitions with context',
    detailed: 'comprehensive definitions with full explanations',
  }

  // Sort order descriptions
  const sortDesc: Record<typeof c.sortOrder, string> = {
    'alphabetical': 'alphabetically',
    'by-importance': 'by importance/frequency of use',
    'by-category': 'grouped by category or topic',
  }

  const examplesNote = c.includeExamples
    ? '\nInclude a usage example for each term where appropriate.'
    : ''

  const relatedNote = c.includeRelatedTerms
    ? '\nInclude related terms or see-also references.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates glossaries.
Identify key terms, concepts, and jargon from the sources.
Provide ${lengthDesc[c.definitionLength]} for each term.
Organize terms ${sortDesc[c.sortOrder]}.${examplesNote}${relatedNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const formatExample = c.includeExamples
    ? '\n  *Example: "The API returned a 404 error..."*'
    : ''
  const relatedExample = c.includeRelatedTerms
    ? '\n  *Related: Term 2, Term 3*'
    : ''

  const textPrompt = `Create a glossary of key terms from these sources:

${buildSourceContextSimple(sources)}

Format as ${c.sortOrder === 'by-category' ? 'category-grouped sections' : c.sortOrder === 'by-importance' ? 'an ordered list by importance' : 'an alphabetically organized list'}:
## Glossary

**Term 1**: ${c.definitionLength === 'concise' ? 'Brief definition.' : c.definitionLength === 'detailed' ? 'Comprehensive definition with full context, background, and nuances of the term.' : 'Clear definition with appropriate context.'}${formatExample}${relatedExample}

**Term 2**: Definition...

Include technical terms, acronyms, and important concepts.`

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
    }).catch(err => console.warn('[Transform] Failed to track glossary usage:', err))
  }

  return result.text
}

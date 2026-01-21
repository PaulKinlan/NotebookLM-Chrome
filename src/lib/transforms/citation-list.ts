import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { CitationsConfig } from '../../types/index.ts'
import { DEFAULT_CITATIONS_CONFIG } from '../transform-config.ts'

export async function generateCitationList(
  sources: Source[],
  config: Partial<CitationsConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_CITATIONS_CONFIG, ...config }

  // Citation style labels
  const styleLabels: Record<string, string> = {
    apa: 'APA (7th Edition)',
    mla: 'MLA (9th Edition)',
    chicago: 'Chicago (17th Edition)',
    harvard: 'Harvard',
    ieee: 'IEEE',
  }

  const selectedStyles = c.styles.map(s => styleLabels[s] || s.toUpperCase()).join(', ')

  const annotationNote = c.includeAnnotations
    ? '\nInclude a brief annotation (1-2 sentences) for each source describing its relevance and content.'
    : ''

  const groupNote = c.groupByType
    ? '\nGroup citations by source type (e.g., Web Articles, Books, Academic Papers).'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates formatted citation lists.
Generate properly formatted references in these styles: ${selectedStyles}.
Include all available source information and ensure accurate formatting.${annotationNote}${groupNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const stylesFormat = c.styles
    .map((style) => {
      const label = styleLabels[style] || style.toUpperCase()
      const example = c.includeAnnotations
        ? `1. [Formatted citation]
   *Annotation: Brief description of the source content and relevance.*`
        : '1. [Formatted citation]'
      return `### ${label} Format

${example}

2. ...`
    })
    .join('\n\n')

  const textPrompt = `Create a citation list for these sources:

${buildSourceContextSimple(sources)}

${c.groupByType ? 'Group by source type, then format as:' : 'Format as:'}

## References

${stylesFormat}

Use the actual titles and URLs from the sources provided. Make your best effort to determine author information, publication dates, and other citation elements from the source content.`

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
    }).catch(err => console.warn('[Transform] Failed to track citation-list usage:', err))
  }

  return result.text
}

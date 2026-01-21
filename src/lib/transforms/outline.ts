import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { OutlineConfig } from '../../types/index.ts'
import { DEFAULT_OUTLINE_CONFIG } from '../transform-config.ts'

export async function generateOutline(
  sources: Source[],
  config: Partial<OutlineConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_OUTLINE_CONFIG, ...config }

  // Style descriptions and examples
  const styleExamples: Record<typeof c.style, string> = {
    alphanumeric: `## I. First Major Section
   A. Subtopic 1
      1. Detail
      2. Detail
   B. Subtopic 2
      1. Detail
         a. Sub-detail
         b. Sub-detail`,
    decimal: `## 1. First Major Section
   1.1. Subtopic 1
      1.1.1. Detail
      1.1.2. Detail
   1.2. Subtopic 2
      1.2.1. Detail`,
    roman: `## I. First Major Section
   i. Subtopic 1
   ii. Subtopic 2
      - Detail
      - Detail`,
    bullets: `## First Major Section
   - Subtopic 1
      - Detail
      - Detail
   - Subtopic 2
      - Detail`,
  }

  const descNote = c.includeDescriptions
    ? '\nInclude brief descriptions or notes for each section.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates detailed outlines.
Organize content into a hierarchical structure with up to ${c.maxDepth} levels of depth.
Use ${c.style} outline formatting.${descNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create a detailed outline based on these sources:

${buildSourceContextSimple(sources)}

Use ${c.style} style formatting with up to ${c.maxDepth} levels of depth.
${c.includeDescriptions ? 'Include brief descriptions for each major section.' : 'Keep entries concise.'}

Format example:
# Main Topic

${styleExamples[c.style]}

## ${c.style === 'alphanumeric' ? 'II' : c.style === 'decimal' ? '2' : c.style === 'roman' ? 'II' : 'Second Major Section'}. Second Major Section
   ...

Create a comprehensive outline that captures all major themes and details.`

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
    }).catch(err => console.warn('[Transform] Failed to track outline usage:', err))
  }

  return result.text
}

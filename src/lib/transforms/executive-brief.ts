import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { ExecutiveBriefConfig } from '../../types/index.ts'
import { DEFAULT_EXECUTIVEBRIEF_CONFIG } from '../transform-config.ts'

export async function generateExecutiveBrief(
  sources: Source[],
  config: Partial<ExecutiveBriefConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_EXECUTIVEBRIEF_CONFIG, ...config }

  // Length descriptions
  const lengthDesc: Record<typeof c.length, string> = {
    'half-page': 'very concise half-page brief',
    'one-page': 'comprehensive one-page summary',
    'two-pages': 'detailed two-page executive summary',
  }

  // Section labels
  const sectionLabels: Record<string, { heading: string, description: string }> = {
    'overview': { heading: 'Situation', description: 'Brief context (2-3 sentences)' },
    'key-findings': { heading: 'Key Findings', description: 'Main insights and discoveries' },
    'implications': { heading: 'Implications', description: 'What this means for stakeholders' },
    'recommendations': { heading: 'Recommendations', description: 'Suggested actions and decisions' },
    'next-steps': { heading: 'Next Steps', description: 'Immediate action items' },
  }

  const sectionsFormat = c.sections
    .map((s) => {
      const section = sectionLabels[s]
      return section ? `### ${section.heading}\n${section.description}` : ''
    })
    .filter(Boolean)
    .join('\n\n')

  const focusNote = c.focusArea ? `\nFocus particularly on: ${c.focusArea}` : ''

  const systemPrompt = `You are a helpful AI assistant that creates executive briefs.
Write a ${lengthDesc[c.length]} for busy decision-makers.
Focus on key insights, implications, and actionable information.${focusNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create an executive brief based on these sources:

${buildSourceContextSimple(sources)}

Format as:
## Executive Brief

${sectionsFormat}

Keep it ${c.length === 'half-page' ? 'very concise' : c.length === 'two-pages' ? 'comprehensive but organized' : 'concise'} and actionable.`

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
    }).catch(err => console.warn('[Transform] Failed to track executive-brief usage:', err))
  }

  return result.text
}

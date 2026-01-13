import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { ReportConfig } from '../../types/index.ts'
import { DEFAULT_REPORT_CONFIG } from '../transform-config.ts'

export async function generateReport(
  sources: Source[],
  config: Partial<ReportConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_REPORT_CONFIG, ...config }

  // Format descriptions
  const formatDesc: Record<typeof c.format, string> = {
    academic: 'academic and scholarly with proper citations and formal language',
    business: 'professional business style with clear structure and actionable insights',
    technical: 'technical and detailed with precise terminology and thorough analysis',
    executive: 'concise executive style focusing on key decisions and high-level insights',
  }

  // Length descriptions
  const lengthDesc: Record<typeof c.length, string> = {
    brief: 'concise, focusing only on essential points',
    standard: 'balanced with appropriate detail',
    comprehensive: 'thorough and detailed with in-depth analysis',
  }

  // Build sections format
  const sectionLabels: Record<string, string> = {
    'executive-summary': '# Executive Summary\nBrief overview of key findings',
    'introduction': '# Introduction\nBackground and context',
    'findings': '# Main Findings\nDetailed analysis organized by topic',
    'analysis': '# Analysis\nIn-depth examination of the data',
    'conclusions': '# Conclusions\nSummary of key conclusions',
    'recommendations': '# Recommendations\nActionable recommendations',
  }

  const sectionsFormat = c.sections
    .map(s => sectionLabels[s] || `# ${s}`)
    .join('\n\n')

  const systemPrompt = `You are a helpful AI assistant that creates ${formatDesc[c.format]} reports.
Write a well-structured report that is ${lengthDesc[c.length]}.
Use clear sections and professional language.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: `Create a formal report based on these sources:

${buildSourceContextSimple(sources)}

Format with the following sections:
${sectionsFormat}`,
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
    }).catch(err => console.warn('[Transform] Failed to track report usage:', err))
  }

  return result.text
}

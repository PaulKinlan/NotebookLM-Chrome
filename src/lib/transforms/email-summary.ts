import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { EmailConfig } from '../../types/index.ts'
import { DEFAULT_EMAIL_CONFIG } from '../transform-config.ts'

export async function generateEmailSummary(
  sources: Source[],
  config: Partial<EmailConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_EMAIL_CONFIG, ...config }

  // Tone descriptions
  const toneDesc: Record<typeof c.tone, string> = {
    formal: 'formal and polished with proper business language',
    casual: 'friendly and conversational while remaining professional',
    professional: 'clear, direct, and professionally courteous',
  }

  // Length descriptions
  const lengthDesc: Record<typeof c.length, string> = {
    brief: 'Keep it very concise - 2-3 short paragraphs maximum.',
    standard: 'Use a balanced length with appropriate detail.',
    detailed: 'Include comprehensive information and context.',
  }

  const recipientNote = c.recipientContext
    ? `\nThis email is intended ${c.recipientContext}.`
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates email summaries.
Write in a ${toneDesc[c.tone]} tone.
${lengthDesc[c.length]}${recipientNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const ctaInstruction = c.includeCallToAction
    ? '- A clear call to action'
    : '- A brief concluding statement'

  const textPrompt = `Create an email summary of these sources:

${buildSourceContextSimple(sources)}

Include:
- A brief introduction
- Key points (bulleted)
${ctaInstruction}`

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
    }).catch(err => console.warn('[Transform] Failed to track email-summary usage:', err))
  }

  return result.text
}

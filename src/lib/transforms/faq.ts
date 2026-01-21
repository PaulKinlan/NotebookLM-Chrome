import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { FAQConfig } from '../../types/index.ts'
import { DEFAULT_FAQ_CONFIG } from '../transform-config.ts'

export async function generateFAQ(
  sources: Source[],
  config: Partial<FAQConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_FAQ_CONFIG, ...config }

  // Answer length descriptions
  const lengthDesc: Record<typeof c.answerLength, string> = {
    brief: 'concise, one-paragraph answers',
    standard: 'moderate-length answers with examples where helpful',
    detailed: 'comprehensive answers with thorough explanations',
  }

  // Question style descriptions
  const styleDesc: Record<typeof c.questionStyle, string> = {
    formal: 'formal, professional question phrasing',
    conversational: 'natural, conversational question phrasing',
  }

  const groupNote = c.groupByTopic
    ? '\nGroup related questions under topic headings.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates FAQ documents.
Use ${styleDesc[c.questionStyle]}.
Provide ${lengthDesc[c.answerLength]} based on the source content.${groupNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const formatExample = c.groupByTopic
    ? `### [Topic Category 1]

#### Q: [Question 1]?
**A:** [Answer based on the sources]

#### Q: [Question 2]?
**A:** [Answer based on the sources]

### [Topic Category 2]

#### Q: [Question 3]?
**A:** [Answer based on the sources]`
    : `### Q: [Question 1]?
**A:** [Detailed answer based on the sources]

### Q: [Question 2]?
**A:** [Detailed answer based on the sources]`

  const textPrompt = `Create a FAQ with ${c.questionCount} questions based on these sources:

${buildSourceContextSimple(sources)}

Format as:
## Frequently Asked Questions

${formatExample}

...

Cover the most important and likely questions about the topics.`

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
    }).catch(err => console.warn('[Transform] Failed to track faq usage:', err))
  }

  return result.text
}

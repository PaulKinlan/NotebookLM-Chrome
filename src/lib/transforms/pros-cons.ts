import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { ProsConsConfig } from '../../types/index.ts'
import { DEFAULT_PROSCONS_CONFIG } from '../transform-config.ts'

export async function generateProsCons(
  sources: Source[],
  config: Partial<ProsConsConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_PROSCONS_CONFIG, ...config }

  // Format descriptions
  const formatDesc: Record<typeof c.format, string> = {
    table: 'a comparison table format',
    lists: 'organized bullet lists',
    detailed: 'detailed narrative format with explanations',
  }

  const neutralNote = c.includeNeutral
    ? '\nInclude a "Neutral" or "Considerations" section for points that are neither strictly positive nor negative.'
    : ''

  const assessmentNote = c.includeAssessment
    ? '\nInclude a bottom-line assessment or recommendation.'
    : ''

  const weightNote = c.weighImportance
    ? '\nIndicate the relative importance or weight of each point (e.g., using importance indicators).'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates balanced pros and cons analyses.
Present the analysis in ${formatDesc[c.format]}.
Identify advantages and disadvantages objectively.${neutralNote}${assessmentNote}${weightNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  let formatTemplate: string
  if (c.format === 'table') {
    formatTemplate = c.includeNeutral
      ? `| Pros | Neutral | Cons |
|------|---------|------|
| Advantage 1 | Consideration 1 | Disadvantage 1 |
| Advantage 2 | Consideration 2 | Disadvantage 2 |`
      : `| Pros | Cons |
|------|------|
| Advantage 1 | Disadvantage 1 |
| Advantage 2 | Disadvantage 2 |`
  }
  else if (c.format === 'detailed') {
    formatTemplate = `#### Pros (Advantages)

**Pro 1**: Detailed explanation of this advantage and its implications.${c.weighImportance ? ' *[High Importance]*' : ''}

**Pro 2**: Detailed explanation...

#### Cons (Disadvantages)

**Con 1**: Detailed explanation of this disadvantage and potential impact.${c.weighImportance ? ' *[Medium Importance]*' : ''}

**Con 2**: Detailed explanation...${c.includeNeutral
  ? `

#### Neutral Considerations

**Point 1**: This aspect can be seen as both positive and negative depending on context.`
  : ''}`
  }
  else {
    formatTemplate = `#### Pros (Advantages)
- ${c.weighImportance ? '**[High]** ' : ''}**Pro 1**: Brief explanation
- ${c.weighImportance ? '**[Medium]** ' : ''}**Pro 2**: Brief explanation

#### Cons (Disadvantages)
- ${c.weighImportance ? '**[High]** ' : ''}**Con 1**: Brief explanation
- ${c.weighImportance ? '**[Low]** ' : ''}**Con 2**: Brief explanation${c.includeNeutral
  ? `

#### Neutral / Considerations
- **Point 1**: Context-dependent factor`
  : ''}`
  }

  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: `Create a pros and cons analysis based on these sources:

${buildSourceContextSimple(sources)}

Format as:
## Pros & Cons Analysis

### Topic/Option: [Main subject]

${formatTemplate}
${c.includeAssessment
  ? `
### Bottom Line
Balanced conclusion with recommendation if applicable.`
  : ''}

If multiple topics can be analyzed, create separate sections for each.`,
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
    }).catch(err => console.warn('[Transform] Failed to track pros-cons usage:', err))
  }

  return result.text
}

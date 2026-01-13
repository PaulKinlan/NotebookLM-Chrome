import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { ActionItemsConfig } from '../../types/index.ts'
import { DEFAULT_ACTIONITEMS_CONFIG } from '../transform-config.ts'

export async function generateActionItems(
  sources: Source[],
  config: Partial<ActionItemsConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_ACTIONITEMS_CONFIG, ...config }

  // Priority format labels
  const priorityLabels: Record<typeof c.priorityFormat, { high: string, medium: string, low: string }> = {
    'high-medium-low': { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority / Future' },
    'p1-p2-p3': { high: 'P1 - Critical', medium: 'P2 - Important', low: 'P3 - Nice to Have' },
    'urgent-normal-low': { high: 'Urgent', medium: 'Normal', low: 'Low Priority' },
  }

  const labels = priorityLabels[c.priorityFormat]

  const priorityNote = c.includePriority
    ? `\nOrganize items by priority level (${labels.high} / ${labels.medium} / ${labels.low}).`
    : ''

  const timeframeNote = c.includeTimeframes
    ? '\nInclude estimated timeframes or deadlines where possible.'
    : ''

  const categoryNote = c.groupByCategory
    ? '\nGroup action items by category or functional area.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that extracts action items and tasks.
Identify actionable steps, recommendations, and to-dos from the sources.${priorityNote}${timeframeNote}${categoryNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  let formatTemplate: string
  if (c.includePriority && c.groupByCategory) {
    formatTemplate = `## Action Items

### ${labels.high}
#### [Category 1]
- [ ] Action item${c.includeTimeframes ? ' (Timeframe: X)' : ''}
#### [Category 2]
- [ ] Action item

### ${labels.medium}
#### [Category 1]
- [ ] Action item

### ${labels.low}
- [ ] Action item`
  }
  else if (c.includePriority) {
    formatTemplate = `## Action Items

### ${labels.high}
- [ ] Action item 1${c.includeTimeframes ? ' (Timeframe: X)' : ''}
- [ ] Action item 2

### ${labels.medium}
- [ ] Action item 3
- [ ] Action item 4

### ${labels.low}
- [ ] Action item 5`
  }
  else if (c.groupByCategory) {
    formatTemplate = `## Action Items

### [Category 1]
- [ ] Action item 1${c.includeTimeframes ? ' (Timeframe: X)' : ''}
- [ ] Action item 2

### [Category 2]
- [ ] Action item 3
- [ ] Action item 4`
  }
  else {
    formatTemplate = `## Action Items

- [ ] Action item 1${c.includeTimeframes ? ' (Timeframe: X)' : ''}
- [ ] Action item 2
- [ ] Action item 3`
  }

  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: `Extract action items and tasks from these sources:

${buildSourceContextSimple(sources)}

Format as:
${formatTemplate}

Include any deadlines, owners, or dependencies mentioned in the sources.`,
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
    }).catch(err => console.warn('[Transform] Failed to track action-items usage:', err))
  }

  return result.text
}

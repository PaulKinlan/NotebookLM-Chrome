import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { DataTableConfig } from '../../types/index.ts'
import { DEFAULT_DATATABLE_CONFIG } from '../transform-config.ts'

export async function generateDataTable(
  sources: Source[],
  config: Partial<DataTableConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_DATATABLE_CONFIG, ...config }

  const summaryNote = c.includeSummary
    ? '\nInclude a summary row at the bottom with totals or averages where applicable.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that extracts and organizes data into tables.
Identify key data points, facts, statistics, or comparisons from the sources.
Create tables with up to ${c.maxColumns} columns and ${c.maxRows} rows.
Present them in a clear tabular format using markdown tables.${summaryNote}${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: `Extract key data and facts from these sources and organize them into tables:

${buildSourceContextSimple(sources)}

Create one or more markdown tables (max ${c.maxColumns} columns, ${c.maxRows} rows each) that capture the most important data points.
Use format:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |
${c.includeSummary ? '| Summary  | Total/Avg | ... |' : ''}

Include relevant categories, metrics, or comparisons found in the sources.`,
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
    }).catch(err => console.warn('[Transform] Failed to track data-table usage:', err))
  }

  return result.text
}

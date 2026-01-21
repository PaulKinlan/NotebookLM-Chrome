import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { TimelineConfig } from '../../types/index.ts'
import { DEFAULT_TIMELINE_CONFIG } from '../transform-config.ts'

export async function generateTimeline(
  sources: Source[],
  config: Partial<TimelineConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_TIMELINE_CONFIG, ...config }

  const layoutDesc = c.layout === 'horizontal'
    ? 'horizontal timeline with events flowing left to right'
    : 'vertical timeline with alternating left/right positioning'

  const categoryNote = c.groupByCategory
    ? '\nGroup events by category and use color coding to distinguish them.'
    : ''

  const descNote = c.includeDescriptions
    ? 'Include detailed descriptions that expand when clicked.'
    : 'Keep event labels concise without detailed descriptions.'

  const systemPrompt = `You are a helpful AI assistant that creates interactive visual timelines as self-contained HTML/CSS/JS.
Create a ${layoutDesc} with up to ${c.maxEvents} events.
${descNote}${categoryNote}

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create an interactive visual timeline based on events and dates found in these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML timeline (maximum ${c.maxEvents} events) with:
1. A ${c.layout} timeline with a connecting line
2. Event nodes/dots along the timeline that are visually distinct
${c.includeDescriptions ? '3. Clickable events that expand to show detailed descriptions' : '3. Clear event labels visible at a glance'}
4. Dates/periods clearly displayed for each event
${c.layout === 'vertical' ? '5. Alternating left/right positioning for visual interest' : '5. Clear spacing between events'}
6. Smooth animations when interacting with events
${c.groupByCategory ? '7. Color coding by category for different types of events' : '7. Consistent styling across all events'}
8. Clean, modern design with good use of spacing

If exact dates aren't available, use relative timing (e.g., "Phase 1", "Early Stage", "Later").

Structure your response as:
<div class="timeline-container">
  <!-- Timeline HTML here - generate ALL events FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles for timeline visualization targeting the structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse - reference elements from HTML above
</script>`

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
    }).catch(err => console.warn('[Transform] Failed to track timeline usage:', err))
  }

  return result.text
}

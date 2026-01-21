import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { StudyGuideConfig } from '../../types/index.ts'
import { DEFAULT_STUDYGUIDE_CONFIG } from '../transform-config.ts'

export async function generateStudyGuide(
  sources: Source[],
  config: Partial<StudyGuideConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_STUDYGUIDE_CONFIG, ...config }

  // Depth descriptions
  const depthDesc: Record<typeof c.depth, string> = {
    overview: 'high-level overview with key points only',
    standard: 'balanced coverage with moderate detail',
    comprehensive: 'thorough, in-depth coverage of all topics',
  }

  // Audience level descriptions
  const audienceDesc: Record<typeof c.audienceLevel, string> = {
    beginner: 'beginners with no prior knowledge - use simple language and explain fundamentals',
    intermediate: 'learners with some background - assume basic understanding',
    advanced: 'advanced learners - include complex details and nuances',
  }

  // Section labels
  const sectionLabels: Record<string, string> = {
    'summary': 'Overview section with main themes',
    'key-concepts': 'Key Concepts with term definitions',
    'examples': 'Examples and applications',
    'practice-questions': 'Review Questions (click to reveal answers)',
    'resources': 'Additional resources and further reading',
  }

  const includedSections = c.sections
    .map(s => sectionLabels[s])
    .filter(Boolean)
    .join('\n- ')

  // Check if we have images
  const hasImages = modelConfig.supportsVision && sources.some(s => s.type === 'image')
  const imageInstructions = hasImages
    ? '\nImages from the sources are included. Reference and describe relevant visual content in the study material.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates interactive study guides as self-contained HTML/CSS/JS.
Create a ${depthDesc[c.depth]} study guide for ${audienceDesc[c.audienceLevel]}.
Organize material for effective learning and review with expandable sections.${imageInstructions}

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create an interactive study guide based on these sources:

${buildSourceContextSimple(sources)}

Include these sections:
- ${includedSections}

Generate a self-contained HTML study guide with:
1. Collapsible/expandable sections for each topic
2. A table of contents with clickable links to sections
3. Highlighted key terms that can be clicked to show definitions
4. ${c.sections.includes('practice-questions') ? 'Interactive review questions at the end (click to reveal answers)' : 'Clear section organization'}
5. Progress tracking (checkboxes for completed sections)
6. Visual hierarchy with clear headings and indentation
7. Summary callout boxes for key takeaways
8. Clean, readable typography with good spacing

Adjust complexity for ${c.audienceLevel} learners.

Structure your response as:
<div class="study-guide-container">
  <!-- Study guide HTML here - generate ALL sections FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles for study guide targeting the structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse and reveal - reference elements from HTML above
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
    }).catch(err => console.warn('[Transform] Failed to track study-guide usage:', err))
  }

  return result.text
}

import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { SlideDeckConfig } from '../../types/index.ts'
import { DEFAULT_SLIDEDECK_CONFIG } from '../transform-config.ts'

export async function generateSlideDeck(
  sources: Source[],
  config: Partial<SlideDeckConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_SLIDEDECK_CONFIG, ...config }

  // Style descriptions
  const styleDesc: Record<typeof c.style, string> = {
    minimal: 'minimalist design with few words per slide, focusing on visuals and key phrases',
    detailed: 'comprehensive slides with bullet points and supporting information',
    visual: 'emphasis on visual hierarchy, icons, and graphical elements',
  }

  const speakerNotesNote = c.includeSpeakerNotes
    ? '\nInclude speaker notes for each slide as HTML comments that can be shown/hidden.'
    : ''

  // Check if we have images
  const hasImages = modelConfig.supportsVision && sources.some(s => s.type === 'image')
  const imageInstructions = hasImages
    ? '\nImages from the sources are included. Reference relevant visual content in your slides where appropriate.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates interactive slide deck presentations as self-contained HTML/CSS/JS.
Create a professional presentation with approximately ${c.slideCount} slides using a ${styleDesc[c.style]} approach.
Each slide should have a clear title and well-structured content.${speakerNotesNote}${imageInstructions}

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create an interactive slide deck presentation with approximately ${c.slideCount} slides based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML slide deck with:
1. Full-width slides that display one at a time
2. Keyboard navigation (arrow keys) and clickable prev/next buttons
3. Slide counter showing current slide / total slides
4. Progress bar at the top
5. Clean, ${c.style === 'minimal' ? 'minimalist' : c.style === 'visual' ? 'visually rich' : 'detailed'} presentation design
6. Title slide with main topic
7. Content slides with ${c.style === 'minimal' ? 'key phrases' : c.style === 'visual' ? 'visual hierarchy and icons' : 'bullet points'}
8. Conclusion slide with key takeaways
9. Smooth slide transition animations
${c.includeSpeakerNotes ? '10. Hidden speaker notes that can be toggled with a keyboard shortcut (n)' : ''}

Structure your response as:
<div class="slides-container">
  <!-- Slides HTML here - generate ALL slides FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the slide structure above */
</style>
<script>
  // Interactive JavaScript for navigation - reference elements from HTML above
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
    }).catch(err => console.warn('[Transform] Failed to track slide-deck usage:', err))
  }

  return result.text
}

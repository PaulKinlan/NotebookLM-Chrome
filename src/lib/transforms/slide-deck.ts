import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateSlideDeck(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates interactive slide deck presentations as self-contained HTML/CSS/JS.
Create a professional presentation with navigable slides that look like a real slideshow.
Each slide should have a clear title and 3-5 key points with visual hierarchy.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive slide deck presentation based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML slide deck with:
1. Full-width slides that display one at a time
2. Keyboard navigation (arrow keys) and clickable prev/next buttons
3. Slide counter showing current slide / total slides
4. Progress bar at the top
5. Clean, presentation-style design with large readable text
6. Title slide with main topic
7. Content slides with bullet points that have good visual hierarchy
8. Conclusion slide with key takeaways
9. Smooth slide transition animations
10. Subtle background color or gradient

Structure your response as:
<div class="slides-container">
  <!-- Slides HTML here - generate ALL slides FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the slide structure above */
</style>
<script>
  // Interactive JavaScript for navigation - reference elements from HTML above
</script>`,
  });

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: config.modelConfigId,
      providerId: config.providerId,
      model: config.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch((err) => console.warn('[Transform] Failed to track slide-deck usage:', err));
  }

  return result.text;
}

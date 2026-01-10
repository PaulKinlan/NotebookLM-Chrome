import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateTimeline(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive visual timelines as self-contained HTML/CSS/JS.
Extract events, dates, and milestones from the sources.
Present them in a visually appealing, interactive timeline format.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive visual timeline based on events and dates found in these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML timeline with:
1. A vertical or horizontal timeline with a connecting line
2. Event nodes/dots along the timeline that are visually distinct
3. Clickable events that expand to show detailed descriptions
4. Dates/periods clearly displayed for each event
5. Alternating left/right positioning for visual interest (if vertical)
6. Smooth animations when expanding/collapsing event details
7. Color coding by category if events fall into different types
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
</script>`,
  });

  return result.text;
}

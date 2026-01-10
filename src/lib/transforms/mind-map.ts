import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateMindMap(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive visual mind maps as self-contained HTML/CSS/JS.
Organize concepts in a visual tree structure showing relationships between ideas.
Create an expandable/collapsible tree visualization.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive visual mind map based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML mind map with:
1. A central topic node prominently displayed
2. Main branches radiating from the center (or top-down tree)
3. Sub-branches for detailed topics
4. Clickable nodes that expand/collapse their children
5. Visual connections (lines) between related nodes
6. Color-coded branches for different main topics
7. Hover effects on nodes
8. Smooth expand/collapse animations
9. Clean, modern design with rounded nodes

Structure your response as:
<div class="mindmap-container">
  <!-- Mind map HTML structure - generate FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the mind map structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse - reference elements from HTML above
</script>`,
  });

  return result.text;
}

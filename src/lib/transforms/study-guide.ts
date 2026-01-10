import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateStudyGuide(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive study guides as self-contained HTML/CSS/JS.
Organize material for effective learning and review with expandable sections.
Include summaries, key concepts, and interactive review questions.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive study guide based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML study guide with:
1. Collapsible/expandable sections for each topic
2. A table of contents with clickable links to sections
3. Highlighted key terms that can be clicked to show definitions
4. Interactive review questions at the end (click to reveal answers)
5. Progress tracking (checkboxes for completed sections)
6. Visual hierarchy with clear headings and indentation
7. Summary callout boxes for key takeaways
8. Clean, readable typography with good spacing

Structure should include:
- Overview section
- Key Concepts section with term definitions
- Main Topics (expandable sections)
- Review Questions (click to reveal answer)
- Summary section

Structure your response as:
<div class="study-guide-container">
  <!-- Study guide HTML here - generate ALL sections FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles for study guide targeting the structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse and reveal - reference elements from HTML above
</script>`,
  });

  return result.text;
}

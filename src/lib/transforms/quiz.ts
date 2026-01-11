import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateQuiz(
  sources: Source[],
  questionCount: number = 5
): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates interactive educational quizzes as self-contained HTML/CSS/JS.
Generate an interactive quiz with multiple choice questions that test understanding of the key concepts.
Each question should have 4 options with one correct answer.
The quiz must be fully functional with immediate feedback when answers are selected.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create a ${questionCount}-question interactive multiple choice quiz based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML quiz with:
1. Each question displayed one at a time with a question counter
2. 4 clickable answer options per question styled as buttons
3. Immediate visual feedback (green for correct, red for incorrect)
4. Show the correct answer and brief explanation after selection
5. Navigation to next question after answering
6. Final score display at the end with option to restart
7. Clean, modern styling with good spacing and hover effects

Structure your response as:
<div class="quiz-container">
  <!-- Quiz HTML here - generate this FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the HTML structure above */
</style>
<script>
  // Interactive JavaScript referencing elements from the HTML above
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
    }).catch((err) => console.warn('[Transform] Failed to track quiz usage:', err));
  }

  return result.text;
}

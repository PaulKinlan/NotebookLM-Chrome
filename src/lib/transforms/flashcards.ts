import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateFlashcards(
  sources: Source[],
  cardCount: number = 10
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive study flashcards as self-contained HTML/CSS/JS.
Create clickable flashcards that flip to reveal answers when clicked.
Questions should be specific and answers should be concise but complete.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create ${cardCount} interactive flashcards based on these sources:

${buildSourceContextSimple(sources)}

Generate self-contained HTML flashcards with:
1. A card counter showing current card / total cards
2. Clickable cards that flip with a smooth 3D animation to reveal the answer
3. Previous/Next navigation buttons
4. Shuffle button to randomize card order
5. Progress indicator
6. Clean, modern card design with good contrast
7. Visual cue that cards are clickable (e.g., "Click to reveal" text)

Structure your response as:
<div class="flashcards-container">
  <!-- Flashcards HTML here - generate ALL cards FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles with 3D flip animation targeting the flashcard structure above */
</style>
<script>
  // Interactive JavaScript for flipping and navigation - reference elements from HTML above
</script>`,
  });

  return result.text;
}

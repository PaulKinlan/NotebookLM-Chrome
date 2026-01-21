import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { FlashcardsConfig } from '../../types/index.ts'
import { DEFAULT_FLASHCARDS_CONFIG } from '../transform-config.ts'

export async function generateFlashcards(
  sources: Source[],
  config: Partial<FlashcardsConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_FLASHCARDS_CONFIG, ...config }

  // Difficulty descriptions
  const difficultyDesc: Record<typeof c.difficulty, string> = {
    easy: 'basic concepts and straightforward facts',
    medium: 'moderately challenging concepts requiring understanding',
    hard: 'complex concepts requiring deep knowledge',
    mixed: 'a mix of easy, medium, and hard cards',
  }

  // Card style descriptions
  const cardStyleDesc: Record<typeof c.cardStyle, string> = {
    'question-answer': 'questions on the front and answers on the back',
    'term-definition': 'terms/vocabulary on the front and definitions on the back',
    'concept-example': 'concepts on the front and examples/applications on the back',
  }

  const hintsNote = c.includeHints
    ? '\nInclude a subtle hint on each card front to help recall.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates interactive study flashcards as self-contained HTML/CSS/JS.
Create flashcards with ${cardStyleDesc[c.cardStyle]}.
Focus on ${difficultyDesc[c.difficulty]}.${hintsNote}
Cards should be clickable and flip to reveal the answer.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create ${c.cardCount} interactive flashcards based on these sources:

${buildSourceContextSimple(sources)}

Generate self-contained HTML flashcards with:
1. A card counter showing current card / total cards
2. Clickable cards that flip with a smooth 3D animation to reveal the answer
3. Previous/Next navigation buttons
4. Shuffle button to randomize card order
5. Progress indicator
6. Clean, modern card design with good contrast
7. Visual cue that cards are clickable (e.g., "Click to reveal" text)
${c.includeHints ? '8. A subtle hint displayed on the front of each card' : ''}

Structure your response as:
<div class="flashcards-container">
  <!-- Flashcards HTML here - generate ALL cards FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles with 3D flip animation targeting the flashcard structure above */
</style>
<script>
  // Interactive JavaScript for flipping and navigation - reference elements from HTML above
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
    }).catch(err => console.warn('[Transform] Failed to track flashcards usage:', err))
  }

  return result.text
}

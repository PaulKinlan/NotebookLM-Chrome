import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { QuizConfig } from '../../types/index.ts'
import { DEFAULT_QUIZ_CONFIG } from '../transform-config.ts'

export async function generateQuiz(
  sources: Source[],
  config: Partial<QuizConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_QUIZ_CONFIG, ...config }

  // Build question type description
  const questionTypeDesc = c.questionTypes.includes('true-false')
    ? c.questionTypes.includes('multiple-choice')
      ? 'a mix of multiple choice and true/false questions'
      : 'true/false questions'
    : 'multiple choice questions with 4 options each'

  // Difficulty description
  const difficultyDesc: Record<typeof c.difficulty, string> = {
    easy: 'straightforward questions testing basic understanding',
    medium: 'moderately challenging questions requiring comprehension',
    hard: 'challenging questions requiring deep understanding and analysis',
    mixed: 'a mix of easy, medium, and hard questions',
  }

  // Check if we have images to include in the quiz
  const hasImages = modelConfig.supportsVision && sources.some(s => s.type === 'image')
  const imageInstructions = hasImages
    ? '\nImages from the sources are included. You may create questions about the visual content in these images.'
    : ''

  const systemPrompt = `You are a helpful AI assistant that creates interactive educational quizzes as self-contained HTML/CSS/JS.
Generate an interactive quiz with ${questionTypeDesc} that test understanding of the key concepts.
The difficulty level should be: ${difficultyDesc[c.difficulty]}.
${c.includeExplanations ? 'Include a brief explanation after each answer is revealed.' : 'Do not include explanations after answers.'}
The quiz must be fully functional with immediate feedback when answers are selected.${imageInstructions}

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const textPrompt = `Create a ${c.questionCount}-question interactive quiz based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML quiz with:
1. Each question displayed one at a time with a question counter
2. Clickable answer options styled as buttons
3. Immediate visual feedback (green for correct, red for incorrect)
${c.includeExplanations ? '4. Show the correct answer and brief explanation after selection' : '4. Show the correct answer after selection'}
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
    }).catch(err => console.warn('[Transform] Failed to track quiz usage:', err))
  }

  return result.text
}

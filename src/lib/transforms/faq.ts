import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateFAQ(
  sources: Source[],
  questionCount: number = 10
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates FAQ documents.
Anticipate common questions readers might have about the topics.
Provide clear, helpful answers based on the source content.`,
    prompt: `Create a FAQ with ${questionCount} questions based on these sources:

${buildSourceContextSimple(sources)}

Format as:
## Frequently Asked Questions

### Q: [Question 1]?
**A:** [Detailed answer based on the sources]

### Q: [Question 2]?
**A:** [Detailed answer based on the sources]

...

Cover the most important and likely questions about the topics.`,
  });

  return result.text;
}

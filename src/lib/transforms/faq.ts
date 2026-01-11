import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateFAQ(
  sources: Source[],
  questionCount: number = 10
): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
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

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: config.modelConfigId,
      providerId: config.providerId,
      model: config.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch((err) => console.warn('[Transform] Failed to track faq usage:', err));
  }

  return result.text;
}

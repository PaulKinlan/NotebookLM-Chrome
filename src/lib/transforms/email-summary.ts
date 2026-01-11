import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateEmailSummary(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates professional email summaries.
Write a concise summary suitable for sharing via email.
Use a professional tone and clear structure.`,
    prompt: `Create a professional email summary of these sources:

${buildSourceContextSimple(sources)}

Include:
- A brief introduction
- Key points (bulleted)
- A conclusion or call to action if appropriate`,
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
    }).catch((err) => console.warn('[Transform] Failed to track email-summary usage:', err));
  }

  return result.text;
}

import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateExecutiveBrief(
  sources: Source[]
): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates executive briefs.
Write a concise one-page summary for busy decision-makers.
Focus on key insights, implications, and recommended actions.`,
    prompt: `Create an executive brief (one-page summary) based on these sources:

${buildSourceContextSimple(sources)}

Format as:
## Executive Brief

### Situation
Brief context (2-3 sentences)

### Key Findings
- Finding 1
- Finding 2
- Finding 3

### Implications
What this means for the reader

### Recommendations
Suggested next steps

Keep it concise and actionable.`,
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
    }).catch((err) => console.warn('[Transform] Failed to track executive-brief usage:', err));
  }

  return result.text;
}

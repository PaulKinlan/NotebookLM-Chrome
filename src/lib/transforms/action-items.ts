import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateActionItems(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that extracts action items and tasks.
Identify actionable steps, recommendations, and to-dos from the sources.
Organize them by priority or category.`,
    prompt: `Extract action items and tasks from these sources:

${buildSourceContextSimple(sources)}

Format as:
## Action Items

### High Priority
- [ ] Action item 1
- [ ] Action item 2

### Medium Priority
- [ ] Action item 3
- [ ] Action item 4

### Low Priority / Future
- [ ] Action item 5

Include any deadlines, owners, or dependencies mentioned in the sources.`,
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
    }).catch((err) => console.warn('[Transform] Failed to track action-items usage:', err));
  }

  return result.text;
}

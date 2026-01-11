import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateOutline(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates detailed outlines.
Organize content into a hierarchical document structure.
Use standard outline formatting with clear sections and subsections.`,
    prompt: `Create a detailed outline based on these sources:

${buildSourceContextSimple(sources)}

Format as:
# Main Topic

## I. Introduction
   A. Background
   B. Purpose
   C. Scope

## II. First Major Section
   A. Subtopic 1
      1. Detail
      2. Detail
   B. Subtopic 2
      1. Detail
      2. Detail

## III. Second Major Section
   A. Subtopic 1
   B. Subtopic 2

## IV. Conclusion
   A. Summary
   B. Key takeaways

Create a comprehensive outline that captures all major themes and details.`,
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
    }).catch((err) => console.warn('[Transform] Failed to track outline usage:', err));
  }

  return result.text;
}

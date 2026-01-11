import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateCitationList(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates formatted citation lists.
Generate properly formatted references and bibliography entries.
Include all available source information.`,
    prompt: `Create a citation list for these sources:

${buildSourceContextSimple(sources)}

Format as:
## References

1. [Author if available]. "[Title]." [Source/Website]. [URL]. Accessed [Date if available].

2. ...

Also provide:
- APA format citations
- MLA format citations
- Chicago format citations

Use the actual titles and URLs from the sources provided.`,
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
    }).catch((err) => console.warn('[Transform] Failed to track citation-list usage:', err));
  }

  return result.text;
}

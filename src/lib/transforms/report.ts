import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts';
import { trackUsage } from '../usage.ts';

export async function generateReport(sources: Source[]): Promise<string> {
  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model: config.model,
    system: `You are a helpful AI assistant that creates formal reports.
Write a well-structured report with clear sections and professional language.
Include an executive summary, main body sections, and conclusions.`,
    prompt: `Create a formal report based on these sources:

${buildSourceContextSimple(sources)}

Format with:
# Executive Summary
Brief overview of key findings

# Introduction
Background and context

# Main Findings
Detailed analysis organized by topic

# Conclusions
Summary and recommendations`,
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
    }).catch((err) => console.warn('[Transform] Failed to track report usage:', err));
  }

  return result.text;
}

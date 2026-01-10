import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateReport(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
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

  return result.text;
}

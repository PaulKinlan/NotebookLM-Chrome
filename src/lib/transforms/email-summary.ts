import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateEmailSummary(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
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

  return result.text;
}

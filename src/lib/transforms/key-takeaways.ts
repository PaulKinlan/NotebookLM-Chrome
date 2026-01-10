import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateKeyTakeaways(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that extracts key takeaways.
Create a bulleted list of the most important points from the sources.
Each takeaway should be clear, actionable, and self-contained.`,
    prompt: `Extract the key takeaways from these sources:

${buildSourceContextSimple(sources)}

Format as a bulleted list with clear, concise points.`,
  });

  return result.text;
}

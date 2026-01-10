import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateSummary(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates concise overviews.
Write a single cohesive paragraph that provides an overview of all the materials.
The paragraph should flow naturally and cover what the sources are about, their key themes, and how they relate to each other.
Be concise but thorough - the paragraph can be long if needed to capture the essence of all sources.
Do not use bullet points, headings, or multiple paragraphs. Output only the overview paragraph.`,
    prompt: `Write a concise overview paragraph for these sources:

${buildSourceContextSimple(sources)}`,
  });

  return result.text;
}

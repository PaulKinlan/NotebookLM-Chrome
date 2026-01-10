import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateComparison(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates comparison charts.
Identify items, concepts, or options that can be compared from the sources.
Present a balanced side-by-side comparison with relevant criteria.`,
    prompt: `Create a comparison chart based on these sources:

${buildSourceContextSimple(sources)}

Format as a markdown table comparing key items:
| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Feature 1| Detail   | Detail   | Detail   |
| Feature 2| Detail   | Detail   | Detail   |

Include a summary of key differences and similarities after the table.`,
  });

  return result.text;
}

import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateDataTable(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that extracts and organizes data into tables.
Identify key data points, facts, statistics, or comparisons from the sources.
Present them in a clear tabular format using markdown tables.`,
    prompt: `Extract key data and facts from these sources and organize them into tables:

${buildSourceContextSimple(sources)}

Create one or more markdown tables that capture the most important data points.
Use format:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

Include relevant categories, metrics, or comparisons found in the sources.`,
  });

  return result.text;
}

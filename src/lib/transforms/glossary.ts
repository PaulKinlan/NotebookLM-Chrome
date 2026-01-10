import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateGlossary(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates glossaries.
Identify key terms, concepts, and jargon from the sources.
Provide clear, concise definitions for each term.`,
    prompt: `Create a glossary of key terms from these sources:

${buildSourceContextSimple(sources)}

Format as an alphabetically organized list:
## Glossary

**Term 1**: Definition of the term in clear, accessible language.

**Term 2**: Definition...

Include technical terms, acronyms, and important concepts.`,
  });

  return result.text;
}

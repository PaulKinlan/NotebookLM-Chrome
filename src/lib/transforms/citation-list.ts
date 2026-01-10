import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateCitationList(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
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

  return result.text;
}

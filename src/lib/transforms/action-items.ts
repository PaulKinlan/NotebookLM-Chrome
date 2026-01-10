import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateActionItems(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that extracts action items and tasks.
Identify actionable steps, recommendations, and to-dos from the sources.
Organize them by priority or category.`,
    prompt: `Extract action items and tasks from these sources:

${buildSourceContextSimple(sources)}

Format as:
## Action Items

### High Priority
- [ ] Action item 1
- [ ] Action item 2

### Medium Priority
- [ ] Action item 3
- [ ] Action item 4

### Low Priority / Future
- [ ] Action item 5

Include any deadlines, owners, or dependencies mentioned in the sources.`,
  });

  return result.text;
}

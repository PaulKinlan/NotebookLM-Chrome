import { getModel, generateText, buildSourceContextSimple, type Source } from './shared.ts';

export async function generateProsCons(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates balanced pros and cons analyses.
Identify advantages and disadvantages of topics, decisions, or options.
Present a fair, objective analysis.`,
    prompt: `Create a pros and cons analysis based on these sources:

${buildSourceContextSimple(sources)}

Format as:
## Pros & Cons Analysis

### Topic/Option: [Main subject]

#### Pros (Advantages)
- **Pro 1**: Explanation
- **Pro 2**: Explanation
- **Pro 3**: Explanation

#### Cons (Disadvantages)
- **Con 1**: Explanation
- **Con 2**: Explanation
- **Con 3**: Explanation

### Bottom Line
Brief balanced conclusion

If multiple topics can be analyzed, create separate sections for each.`,
  });

  return result.text;
}

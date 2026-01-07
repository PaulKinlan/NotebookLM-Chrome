import { streamText, generateText, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { builtInAI } from '@built-in-ai/core';
import type { Source, Citation } from '../types/index.ts';
import { getAISettings, getApiKey } from './settings.ts';

// ============================================================================
// Provider Factory
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'chrome';

async function getModel(): Promise<LanguageModel | null> {
  const settings = await getAISettings();
  const apiKey = await getApiKey(settings.provider);

  switch (settings.provider) {
    case 'anthropic': {
      if (!apiKey) return null;
      const provider = createAnthropic({ apiKey });
      return provider(settings.model || 'claude-sonnet-4-5-20250514');
    }
    case 'openai': {
      if (!apiKey) return null;
      const provider = createOpenAI({ apiKey });
      return provider(settings.model || 'gpt-5');
    }
    case 'google': {
      if (!apiKey) return null;
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(settings.model || 'gemini-2.5-flash');
    }
    case 'chrome': {
      // Chrome Built-in AI - no API key needed
      return builtInAI();
    }
    default:
      return null;
  }
}

// ============================================================================
// Source Context Builder
// ============================================================================

function buildSourceContext(sources: Source[]): string {
  return sources
    .map((source, i) => {
      return `[Source ${i + 1}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`;
    })
    .join('\n\n---\n\n');
}

function buildSourceList(sources: Source[]): string {
  return sources
    .map((source, i) => `  ${i + 1}. "${source.title}" (ID: ${source.id})`)
    .join('\n');
}

// ============================================================================
// Chat Query
// ============================================================================

export interface ChatResult {
  content: string;
  citations: Citation[];
}

function buildChatSystemPrompt(sources: Source[]): string {
  return `You are a helpful AI assistant that answers questions based on the provided sources.

IMPORTANT INSTRUCTIONS:
1. Base your answers ONLY on the provided sources
2. When you use information from a source, cite it using the format [Source N] where N is the source number
3. Be accurate and well-structured
4. If the sources don't contain relevant information, say so

After your main response, add a CITATIONS section in this exact format:
---CITATIONS---
[Source 1]: "exact quote or paraphrase from source 1"
[Source 2]: "exact quote or paraphrase from source 2"
---END CITATIONS---

Only include sources you actually referenced. If you didn't cite any sources, omit the citations section.

Available sources:
${buildSourceList(sources)}

Source contents:

${buildSourceContext(sources)}`;
}

function parseCitations(content: string, sources: Source[]): { cleanContent: string; citations: Citation[] } {
  const citations: Citation[] = [];
  let cleanContent = content;

  // First, extract citations section and group by source number
  const citationsBySourceNum = new Map<number, string[]>();

  const citationsMatch = content.match(/---CITATIONS---\n([\s\S]*?)\n---END CITATIONS---/);
  if (citationsMatch) {
    cleanContent = content.replace(/\n?---CITATIONS---[\s\S]*?---END CITATIONS---\n?/, '').trim();
    const citationsText = citationsMatch[1];

    // Parse each citation line and group by source number
    const citationLines = citationsText.split('\n').filter(line => line.trim());
    for (const line of citationLines) {
      const match = line.match(/\[Source (\d+)\]:\s*"?([^"]+)"?/);
      if (match) {
        const sourceNum = parseInt(match[1], 10);
        const excerpt = match[2].trim();
        if (!citationsBySourceNum.has(sourceNum)) {
          citationsBySourceNum.set(sourceNum, []);
        }
        citationsBySourceNum.get(sourceNum)!.push(excerpt);
      }
    }
  }

  // Count how many times each [Source N] appears in the text
  const sourceCountInText = new Map<number, number>();
  const sourceMatches = cleanContent.matchAll(/\[Source (\d+)\]/g);
  for (const match of sourceMatches) {
    const sourceNum = parseInt(match[1], 10);
    sourceCountInText.set(sourceNum, (sourceCountInText.get(sourceNum) || 0) + 1);
  }

  // Track occurrence index as we replace
  const sourceOccurrenceIndex = new Map<number, number>();

  // Replace inline [Source N] with [Source Na], [Source Nb], etc. if source appears multiple times in text
  cleanContent = cleanContent.replace(/\[Source (\d+)\]/g, (match, numStr) => {
    const sourceNum = parseInt(numStr, 10);
    const countInText = sourceCountInText.get(sourceNum) || 1;

    // Get current occurrence index for this source
    const currentIndex = sourceOccurrenceIndex.get(sourceNum) || 0;
    sourceOccurrenceIndex.set(sourceNum, currentIndex + 1);

    // If this source appears multiple times in the text, use sub-labels
    if (countInText > 1) {
      const subLabel = String.fromCharCode(97 + currentIndex); // a, b, c, ...
      return `[Source ${sourceNum}${subLabel}]`;
    }

    // Single occurrence - keep as is
    return match;
  });

  // Build final citations list
  // For sources with multiple text occurrences, create a citation for each occurrence
  for (const [sourceNum, count] of sourceCountInText) {
    const sourceIndex = sourceNum - 1;
    if (sourceIndex >= 0 && sourceIndex < sources.length) {
      const source = sources[sourceIndex];
      const excerpts = citationsBySourceNum.get(sourceNum) || [];

      if (count > 1) {
        // Multiple occurrences - create citation for each
        for (let i = 0; i < count; i++) {
          const excerpt = excerpts[i] || `Reference ${String.fromCharCode(97 + i)} from this source`;
          citations.push({
            sourceId: source.id,
            sourceTitle: source.title,
            excerpt,
          });
        }
      } else {
        // Single occurrence
        const excerpt = excerpts[0] || 'Referenced in response';
        citations.push({
          sourceId: source.id,
          sourceTitle: source.title,
          excerpt,
        });
      }
    }
  }

  return { cleanContent, citations };
}

export async function* streamChat(
  sources: Source[],
  question: string
): AsyncGenerator<string, ChatResult, unknown> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const systemPrompt = buildChatSystemPrompt(sources);

  const result = streamText({
    model,
    system: systemPrompt,
    prompt: question,
  });

  let fullContent = '';
  for await (const chunk of result.textStream) {
    fullContent += chunk;
    // Don't yield the citations section while streaming
    yield chunk.replace(/---CITATIONS---[\s\S]*$/, '');
  }

  const { cleanContent, citations } = parseCitations(fullContent, sources);

  return {
    content: cleanContent,
    citations,
  };
}

export async function chat(sources: Source[], question: string): Promise<ChatResult> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const systemPrompt = buildChatSystemPrompt(sources);

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: question,
  });

  const { cleanContent, citations } = parseCitations(result.text, sources);

  return {
    content: cleanContent,
    citations,
  };
}

// ============================================================================
// Transformations
// ============================================================================

export async function generateSummary(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates clear, concise summaries.
Synthesize the key information from all sources into a coherent summary.
Focus on the most important points and how they relate to each other.`,
    prompt: `Please provide a comprehensive summary of the following sources:

${buildSourceContext(sources)}`,
  });

  return result.text;
}

export async function generateKeyTakeaways(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that extracts key takeaways.
Create a bulleted list of the most important points from the sources.
Each takeaway should be clear, actionable, and self-contained.`,
    prompt: `Extract the key takeaways from these sources:

${buildSourceContext(sources)}

Format as a bulleted list with clear, concise points.`,
  });

  return result.text;
}

export async function generateQuiz(sources: Source[], questionCount: number = 5): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates educational quizzes.
Generate multiple choice questions that test understanding of the key concepts.
Each question should have 4 options with one correct answer.`,
    prompt: `Create a ${questionCount}-question multiple choice quiz based on these sources:

${buildSourceContext(sources)}

Format each question as:
Q1: [Question]
A) [Option]
B) [Option]
C) [Option]
D) [Option]
Answer: [Letter]
Explanation: [Brief explanation]`,
  });

  return result.text;
}

export async function generateEmailSummary(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates professional email summaries.
Write a concise summary suitable for sharing via email.
Use a professional tone and clear structure.`,
    prompt: `Create a professional email summary of these sources:

${buildSourceContext(sources)}

Include:
- A brief introduction
- Key points (bulleted)
- A conclusion or call to action if appropriate`,
  });

  return result.text;
}

export interface PodcastSegment {
  speaker: 'host' | 'guest';
  text: string;
}

export async function generatePodcastScript(
  sources: Source[],
  lengthMinutes: number = 5
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates engaging podcast scripts.
Write a natural conversation between two hosts discussing the topics.
Make it engaging, informative, and conversational.
The hosts should be curious, ask follow-up questions, and build on each other's points.`,
    prompt: `Create a ${lengthMinutes}-minute podcast script (approximately ${lengthMinutes * 150} words) based on these sources:

${buildSourceContext(sources)}

Format as a dialogue between Host A and Host B:
Host A: [Introduction and topic setup]
Host B: [Response and first point]
...continue the natural conversation...

Make it engaging and educational, covering the key points from the sources.`,
  });

  return result.text;
}

export async function generateSlideDeck(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates slide deck outlines.
Create a professional presentation outline with slide titles and bullet points.
Each slide should have a clear title and 3-5 key points.`,
    prompt: `Create a slide deck outline based on these sources:

${buildSourceContext(sources)}

Format as:
## Slide 1: [Title]
- Key point 1
- Key point 2
- Key point 3

## Slide 2: [Title]
...and so on.

Include an introduction slide, main content slides, and a conclusion slide.`,
  });

  return result.text;
}

export async function generateReport(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates formal reports.
Write a well-structured report with clear sections and professional language.
Include an executive summary, main body sections, and conclusions.`,
    prompt: `Create a formal report based on these sources:

${buildSourceContext(sources)}

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

export async function generateDataTable(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that extracts and organizes data into tables.
Identify key data points, facts, statistics, or comparisons from the sources.
Present them in a clear tabular format using markdown tables.`,
    prompt: `Extract key data and facts from these sources and organize them into tables:

${buildSourceContext(sources)}

Create one or more markdown tables that capture the most important data points.
Use format:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

Include relevant categories, metrics, or comparisons found in the sources.`,
  });

  return result.text;
}

export async function generateMindMap(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates hierarchical mind maps.
Organize concepts in a tree structure showing relationships between ideas.
Use indentation to show hierarchy and connections.`,
    prompt: `Create a mind map structure based on these sources:

${buildSourceContext(sources)}

Format as a hierarchical text structure:
# Central Topic
## Main Branch 1
### Sub-topic 1.1
### Sub-topic 1.2
## Main Branch 2
### Sub-topic 2.1
#### Detail 2.1.1
...

Show the relationships and hierarchy of concepts from the sources.`,
  });

  return result.text;
}

export async function generateFlashcards(sources: Source[], cardCount: number = 10): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates study flashcards.
Create clear question-and-answer pairs that test understanding of key concepts.
Questions should be specific and answers should be concise but complete.`,
    prompt: `Create ${cardCount} flashcards based on these sources:

${buildSourceContext(sources)}

Format each flashcard as:
**Q1:** [Question]
**A1:** [Answer]

**Q2:** [Question]
**A2:** [Answer]

...and so on. Focus on the most important concepts and facts.`,
  });

  return result.text;
}

export async function generateTimeline(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates chronological timelines.
Extract events, dates, and milestones from the sources.
Present them in chronological order with clear descriptions.`,
    prompt: `Create a timeline based on events and dates found in these sources:

${buildSourceContext(sources)}

Format as:
## Timeline

**[Date/Period 1]** - Event description
- Key details

**[Date/Period 2]** - Event description
- Key details

...

If exact dates aren't available, use relative timing (e.g., "First", "Then", "Later").`,
  });

  return result.text;
}

export async function generateGlossary(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates glossaries.
Identify key terms, concepts, and jargon from the sources.
Provide clear, concise definitions for each term.`,
    prompt: `Create a glossary of key terms from these sources:

${buildSourceContext(sources)}

Format as an alphabetically organized list:
## Glossary

**Term 1**: Definition of the term in clear, accessible language.

**Term 2**: Definition...

Include technical terms, acronyms, and important concepts.`,
  });

  return result.text;
}

export async function generateComparison(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates comparison charts.
Identify items, concepts, or options that can be compared from the sources.
Present a balanced side-by-side comparison with relevant criteria.`,
    prompt: `Create a comparison chart based on these sources:

${buildSourceContext(sources)}

Format as a markdown table comparing key items:
| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Feature 1| Detail   | Detail   | Detail   |
| Feature 2| Detail   | Detail   | Detail   |

Include a summary of key differences and similarities after the table.`,
  });

  return result.text;
}

export async function generateFAQ(sources: Source[], questionCount: number = 10): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates FAQ documents.
Anticipate common questions readers might have about the topics.
Provide clear, helpful answers based on the source content.`,
    prompt: `Create a FAQ with ${questionCount} questions based on these sources:

${buildSourceContext(sources)}

Format as:
## Frequently Asked Questions

### Q: [Question 1]?
**A:** [Detailed answer based on the sources]

### Q: [Question 2]?
**A:** [Detailed answer based on the sources]

...

Cover the most important and likely questions about the topics.`,
  });

  return result.text;
}

export async function generateActionItems(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that extracts action items and tasks.
Identify actionable steps, recommendations, and to-dos from the sources.
Organize them by priority or category.`,
    prompt: `Extract action items and tasks from these sources:

${buildSourceContext(sources)}

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

export async function generateExecutiveBrief(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates executive briefs.
Write a concise one-page summary for busy decision-makers.
Focus on key insights, implications, and recommended actions.`,
    prompt: `Create an executive brief (one-page summary) based on these sources:

${buildSourceContext(sources)}

Format as:
## Executive Brief

### Situation
Brief context (2-3 sentences)

### Key Findings
- Finding 1
- Finding 2
- Finding 3

### Implications
What this means for the reader

### Recommendations
Suggested next steps

Keep it concise and actionable.`,
  });

  return result.text;
}

export async function generateStudyGuide(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates comprehensive study guides.
Organize material for effective learning and review.
Include summaries, key concepts, and review questions.`,
    prompt: `Create a study guide based on these sources:

${buildSourceContext(sources)}

Format as:
## Study Guide

### Overview
Brief introduction to the topics

### Key Concepts
Important ideas and definitions to understand

### Main Topics

#### Topic 1
- Key points
- Important details

#### Topic 2
- Key points
- Important details

### Review Questions
Questions to test understanding

### Summary
Concise recap of the most important points`,
  });

  return result.text;
}

export async function generateProsCons(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates balanced pros and cons analyses.
Identify advantages and disadvantages of topics, decisions, or options.
Present a fair, objective analysis.`,
    prompt: `Create a pros and cons analysis based on these sources:

${buildSourceContext(sources)}

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

export async function generateCitationList(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates formatted citation lists.
Generate properly formatted references and bibliography entries.
Include all available source information.`,
    prompt: `Create a citation list for these sources:

${buildSourceContext(sources)}

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

export async function generateOutline(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error('AI provider not configured. Please add your API key in settings.');
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates detailed outlines.
Organize content into a hierarchical document structure.
Use standard outline formatting with clear sections and subsections.`,
    prompt: `Create a detailed outline based on these sources:

${buildSourceContext(sources)}

Format as:
# Main Topic

## I. Introduction
   A. Background
   B. Purpose
   C. Scope

## II. First Major Section
   A. Subtopic 1
      1. Detail
      2. Detail
   B. Subtopic 2
      1. Detail
      2. Detail

## III. Second Major Section
   A. Subtopic 1
   B. Subtopic 2

## IV. Conclusion
   A. Summary
   B. Key takeaways

Create a comprehensive outline that captures all major themes and details.`,
  });

  return result.text;
}

// ============================================================================
// Test Connection
// ============================================================================

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const model = await getModel();
    if (!model) {
      return { success: false, error: 'No API key configured' };
    }

    await generateText({
      model,
      prompt: 'Say "Connection successful" in exactly those words.',
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

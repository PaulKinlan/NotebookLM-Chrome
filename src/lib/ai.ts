import { streamText, generateText, type LanguageModel } from 'ai';
import type { Source, Citation, Notebook, ChatMessage } from '../types/index.ts';
import { getActiveNotebookId, getNotebook } from './storage.ts';
import { resolveModelConfig } from './model-configs.ts';
import {
  getProviderConfig,
  getProviderDefaultModel,
  providerRequiresApiKey,
  type AIProvider,
} from './provider-registry.ts';
import { withRetry } from './errors.ts';

// Re-export error utilities for convenience
export { classifyError, formatErrorForUser, withRetry } from './errors.ts';

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Create a LanguageModel instance for the given provider
 * Uses the provider registry's createModel function
 */
function createProviderInstance(
  providerType: AIProvider,
  apiKey: string,
  modelId: string,
  baseURL?: string
): LanguageModel | null {
  const config = getProviderConfig(providerType);

  // If baseURL not provided, get from registry
  if (!baseURL) {
    baseURL = config.baseURL;
  }

  // Use the provider's createModel function from the registry
  return config.createModel(apiKey, modelId, baseURL);
}

async function getModel(): Promise<LanguageModel | null> {
  // Get active notebook to resolve model config with potential credential override
  const activeNotebookId = await getActiveNotebookId();

  let notebook: Notebook | undefined;
  if (activeNotebookId) {
    const notebookResult = await getNotebook(activeNotebookId);
    if (notebookResult) {
      notebook = notebookResult;
    }
  }

  // Resolve model config (handles notebook-specific config and credential override)
  const resolved = await resolveModelConfig(notebook);

  if (!resolved) {
    throw new Error('No AI model configured. Please add a model configuration in settings.');
  }

  const { modelConfig, credential, providerType, baseURL } = resolved;
  const apiKey = credential.apiKey;
  const modelId = modelConfig.model;

  // Get defaults from registry
  const defaultModel = getProviderDefaultModel(providerType);
  const requiresApiKey = providerRequiresApiKey(providerType);

  // Check API key requirement
  if (requiresApiKey && !apiKey) {
    return null;
  }

  // Create provider instance using SDK factory
  // apiKey is guaranteed to be defined here due to the requiresApiKey check above
  return createProviderInstance(
    providerType,
    apiKey,
    modelId || defaultModel,
    baseURL
  );
}

async function getCompressionMode(): Promise<'two-pass' | 'single-pass'> {
  // Get active notebook to resolve model config
  const activeNotebookId = await getActiveNotebookId();

  let notebook: Notebook | undefined;
  if (activeNotebookId) {
    const notebookResult = await getNotebook(activeNotebookId);
    if (notebookResult) {
      notebook = notebookResult;
    }
  }

  // Resolve model config (handles notebook-specific config)
  const resolved = await resolveModelConfig(notebook);

  // Default to two-pass if no config is set
  if (!resolved) {
    return 'two-pass';
  }

  // Return the compression mode from the config, defaulting to two-pass
  return resolved.modelConfig.compressionMode || 'two-pass';
}

// ============================================================================
// Source Context Builder with LLM-Based Compression
// ============================================================================

interface SourceWithRelevance extends Source {
  relevanceScore?: number;
  relevanceReason?: string;
}

/**
 * Build lightweight metadata for relevance scoring
 */
function buildSourceMetadata(sources: Source[]): string {
  return sources
    .map((source, i) => {
      const preview = source.content.slice(0, 150).replace(/\n/g, ' ');
      return `[${i + 1}] "${source.title}"
URL: ${source.url}
Preview: ${preview}${source.content.length > 150 ? '...' : ''}`;
    })
    .join("\n\n");
}

/**
 * Pass 1: Use LLM to rank sources by relevance to the query
 */
async function rankSourceRelevance(
  sources: Source[],
  query: string
): Promise<SourceWithRelevance[]> {
  const model = await getModel();
  if (!model) {
    // Fallback: return all sources without ranking if no model
    return sources.map(s => ({ ...s, relevanceScore: 1.0 }));
  }

  const metadata = buildSourceMetadata(sources);

  let rankingsResult;
  try {
    rankingsResult = await generateText({
      model,
      system: `You are a relevance ranking assistant. Given a user query and a list of sources with previews, rank them by relevance.

Return ONLY a JSON array of objects with this exact structure:
[
  {"index": 1, "score": 0.9, "reason": "Directly addresses the core question"},
  {"index": 2, "score": 0.3, "reason": "Marginally related context"}
]

Where:
- index: The source number (1-based)
- score: Relevance score from 0.0 (not relevant) to 1.0 (highly relevant)
- reason: Brief explanation of the score

Score guidelines:
- 0.9-1.0: Directly answers the question or provides essential information
- 0.7-0.9: Strongly relevant background or supporting information
- 0.5-0.7: Somewhat related context
- 0.3-0.5: Tangentially related
- 0.0-0.3: Not relevant

Be discerning - not all sources deserve high scores.`,
      prompt: `Rank these sources by relevance to the query: "${query}"

Sources:
${metadata}

Return the JSON ranking.`,
    });
  } catch (error) {
    console.error('Failed to generate relevance ranking:', error);
    // Fallback: return all sources with neutral score when ranking generation fails
    return sources.map(s => ({ ...s, relevanceScore: 0.5 }));
  }

  try {
    // Handle potential markdown code fences around JSON
    const jsonText = rankingsResult.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const rankings = JSON.parse(jsonText) as Array<{
      index: number;
      score: number;
      reason: string;
    }>;

    // Map rankings back to sources
    const sourceMap = sources.map((s, i) => ({ ...s, originalIndex: i }));
    const ranked = sourceMap.map((source): SourceWithRelevance => {
      const ranking = rankings.find(r => r.index === source.originalIndex + 1);
      if (!ranking) {
        console.warn(`Source ${source.originalIndex + 1} ("${source.title}") missing from ranking response, assigning default score`);
      }
      return {
        ...source,
        relevanceScore: ranking?.score ?? 0.5,
        relevanceReason: ranking?.reason,
      };
    });

    // Sort by relevance score descending
    return ranked.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  } catch (error) {
    console.error('Failed to parse relevance ranking:', error);
    // Fallback: return all sources with neutral score
    return sources.map(s => ({ ...s, relevanceScore: 0.5 }));
  }
}

/**
 * Pass 2: Summarize moderately relevant sources to save tokens
 */
async function summarizeSources(
  sources: SourceWithRelevance[],
  maxSummaries: number = 10
): Promise<Map<string, string>> {
  if (sources.length === 0) return new Map();

  const model = await getModel();
  if (!model) return new Map();

  const summaries = new Map<string, string>();

  // Batch summarize sources to reduce API calls
  const batch = sources.slice(0, maxSummaries);
  const sourcesText = batch
    .map((s, i) => `[Source ${i + 1}] "${s.title}"\n${s.content.slice(0, 500)}...`)
    .join('\n\n---\n\n');

  let summaryResult;
  try {
    summaryResult = await generateText({
      model,
      system: `You are a precise summarizer. Create 2-3 sentence summaries that capture the main points and key information.

Return ONLY a JSON array of objects:
[
  {"index": 1, "summary": "Two to three sentences capturing the main points..."},
  {"index": 2, "summary": "Two to three sentences..."}
]

Be accurate and concise. Focus on substantive content.`,
      prompt: `Summarize these sources:\n\n${sourcesText}\n\nReturn the JSON summaries.`,
    });
  } catch (error) {
    console.error('Failed to generate summaries:', error);
    // Return empty map on API error - sources will show full content instead
    return summaries;
  }

  try {
    // Handle potential markdown code fences around JSON
    const jsonText = summaryResult.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(jsonText) as Array<{
      index: number;
      summary: string;
    }>;

    for (const item of parsed) {
      const source = batch[item.index - 1];
      if (source) {
        summaries.set(source.id, item.summary);
      }
    }
  } catch (error) {
    console.error('Failed to parse summaries:', error);
  }

  return summaries;
}

/**
 * Single-pass compression: Fixed strategy without LLM ranking
 * Faster but less intelligent than two-pass
 */
function buildSourceContextSinglePass(
  sources: Source[],
  _query: string // Unused in single-pass mode, but kept for signature consistency
): string {
  if (sources.length === 0) return '';

  // Simple strategy: First 5 get full content, next 10 get summaries, rest get titles
  const parts: string[] = [];
  let sourceIndex = 1; // Use sequential numeric indices for citations

  // Full content for first 5 sources
  for (const source of sources.slice(0, 5)) {
    parts.push(
      `[Source ${sourceIndex}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`
    );
    sourceIndex++;
  }

  // Summaries for next 10 sources (basic extractive summary)
  for (const source of sources.slice(5, 15)) {
    const content = source.content || '';
    // Match sentence boundaries more robustly
    const sentenceMatches = content.match(/[^.!?]+[.!?]*/g);
    const rawSummary =
      (sentenceMatches && sentenceMatches.slice(0, 3).join(' ')) || content;
    const summary = rawSummary.trim();
    const finalSummary =
      summary === ''
        ? '(no content available)'
        : /[.!?]$/.test(summary)
        ? summary
        : summary + '.';

    parts.push(
      `[Source ${sourceIndex}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\nSummary: ${finalSummary}`
    );
    sourceIndex++;
  }

  // Titles only for remaining sources
  for (const source of sources.slice(15)) {
    parts.push(
      `[Source ${sourceIndex}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n(See source for details)`
    );
    sourceIndex++;
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Build compressed context using two-pass LLM approach
 * - Pass 1: Rank all sources by relevance
 * - Pass 2: Full content for top sources, summaries for mid-tier, titles for rest
 */
async function buildSourceContext(
  sources: Source[],
  query: string,
  compressionMode: 'two-pass' | 'single-pass' = 'two-pass'
): Promise<string> {
  if (sources.length === 0) return '';

  // If only a few sources, skip compression regardless of mode
  if (sources.length <= 5) {
    return sources
      .map((source, i) => {
        return `[Source ${i + 1}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`;
      })
      .join('\n\n---\n\n');
  }

  // Single-pass mode: Use fixed strategy without LLM calls
  if (compressionMode === 'single-pass') {
    return buildSourceContextSinglePass(sources, query);
  }

  // Two-pass mode: Use LLM-based ranking and summarization
  // Pass 1: Rank by relevance
  const ranked = await rankSourceRelevance(sources, query);

  // Categorize by relevance
  const highlyRelevant = ranked.filter(s => (s.relevanceScore ?? 0) >= 0.7);
  const moderatelyRelevant = ranked.filter(
    s => (s.relevanceScore ?? 0) >= 0.4 && (s.relevanceScore ?? 0) < 0.7
  );
  const lessRelevant = ranked.filter(s => (s.relevanceScore ?? 0) < 0.4);

  // Pass 2: Summarize moderately relevant sources
  const summaries = await summarizeSources(moderatelyRelevant);

  // Build context with appropriate detail level
  const parts: string[] = [];
  let sourceIndex = 1; // Use sequential numeric indices for citations

  // Full content for all highly relevant sources
  // If the LLM ranked sources as highly relevant (≥0.7), include all of them
  // rather than arbitrarily limiting to a fixed number. The ranking should be trusted.
  for (const source of highlyRelevant) {
    parts.push(
      `[Source ${sourceIndex}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`
    );
    sourceIndex++;
  }

  // Summaries for moderately relevant
  for (const source of moderatelyRelevant) {
    const summary = summaries.get(source.id) ?? 'Summary not available.';
    parts.push(
      `[Source ${sourceIndex}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\nSummary: ${summary}`
    );
    sourceIndex++;
  }

  // Titles only for less relevant
  for (const source of lessRelevant) {
    parts.push(
      `[Source ${sourceIndex}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n(Referenced but not highly relevant to this query)`
    );
    sourceIndex++;
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Simple context builder for transformations (no compression)
 * Used when there's no specific query to rank against
 */
function buildSourceContextSimple(sources: Source[]): string {
  return sources
    .map((source, i) => {
      return `[Source ${i + 1}] ID: ${source.id}\nTitle: ${source.title}\nURL: ${source.url}\n\n${source.content}`;
    })
    .join('\n\n---\n\n');
}

function buildSourceList(sources: Source[]): string {
  return sources
    .map((source, i) => `  ${i + 1}. "${source.title}" (ID: ${source.id})`)
    .join("\n");
}

// ============================================================================
// Chat Query
// ============================================================================

export interface ChatResult {
  content: string;
  citations: Citation[];
}

async function buildChatSystemPrompt(
  sources: Source[],
  query: string,
  compressionMode: 'two-pass' | 'single-pass' = 'two-pass'
): Promise<string> {
  const sourceContext = await buildSourceContext(sources, query, compressionMode);

  return `You are a helpful AI assistant that answers questions based on the provided sources.

IMPORTANT INSTRUCTIONS:
1. Base your answers ONLY on the provided sources
2. When you use information from a source, cite it using the format [Source N] where N is the numeric index (e.g., [Source 1], [Source 2])
3. Be accurate and well-structured
4. If the sources don't contain relevant information, say so

After your main response, add a CITATIONS section in this exact format:
---CITATIONS---
[Source 1]: "exact quote or paraphrase from source"
---END CITATIONS---

Only include sources you actually referenced. If you didn't cite any sources, omit the citations section.

Available sources:
${buildSourceList(sources)}

Source contents:

${sourceContext}`;
}

function buildChatHistory(
  history?: ChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!history) return [];
  return history.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function parseCitations(
  content: string,
  sources: Source[]
): { cleanContent: string; citations: Citation[] } {
  const citations: Citation[] = [];
  let cleanContent = content;

  // First, extract citations section and group by source number
  const citationsBySourceNum = new Map<number, string[]>();

  const citationsMatch = content.match(
    /---CITATIONS---\n([\s\S]*?)\n---END CITATIONS---/
  );
  if (citationsMatch) {
    cleanContent = content
      .replace(/\n?---CITATIONS---[\s\S]*?---END CITATIONS---\n?/, "")
      .trim();
    const citationsText = citationsMatch[1];

    // Parse each citation line and group by source number
    const citationLines = citationsText
      .split("\n")
      .filter((line) => line.trim());
    for (const line of citationLines) {
      const match = line.match(/\[Source (\d+)\]:\s*"?([^"]+)"?/);
      if (match) {
        const sourceNum = parseInt(match[1], 10);
        const excerpt = match[2].trim();
        if (!citationsBySourceNum.has(sourceNum)) {
          citationsBySourceNum.set(sourceNum, []);
        }
        const excerpts = citationsBySourceNum.get(sourceNum);
        if (excerpts) {
          excerpts.push(excerpt);
        }
      }
    }
  }

  // Count how many times each [Source N] appears in the text
  const sourceCountInText = new Map<number, number>();
  const sourceMatches = cleanContent.matchAll(/\[Source (\d+)\]/g);
  for (const match of sourceMatches) {
    const sourceNum = parseInt(match[1], 10);
    sourceCountInText.set(
      sourceNum,
      (sourceCountInText.get(sourceNum) || 0) + 1
    );
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
          const excerpt =
            excerpts[i] ||
            `Reference ${String.fromCharCode(97 + i)} from this source`;
          citations.push({
            sourceId: source.id,
            sourceTitle: source.title,
            excerpt,
          });
        }
      } else {
        // Single occurrence
        const excerpt = excerpts[0] || "Referenced in response";
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
  question: string,
  history?: ChatMessage[]
): AsyncGenerator<string, ChatResult, unknown> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const compressionMode = await getCompressionMode();
  const systemPrompt = await buildChatSystemPrompt(sources, question, compressionMode);

  const messages = buildChatHistory(history);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: [
      ...messages,
      { role: 'user', content: question },
    ],
  });

  let fullContent = "";
  for await (const chunk of result.textStream) {
    fullContent += chunk;
    // Don't yield the citations section while streaming
    yield chunk.replace(/---CITATIONS---[\s\S]*$/, "");
  }

  const { cleanContent, citations } = parseCitations(fullContent, sources);

  return {
    content: cleanContent,
    citations,
  };
}

export async function chat(
  sources: Source[],
  question: string,
  history?: ChatMessage[]
): Promise<ChatResult> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const compressionMode = await getCompressionMode();
  const systemPrompt = await buildChatSystemPrompt(sources, question, compressionMode);

  const messages = buildChatHistory(history);

  // Use retry logic for recoverable errors (network, rate limits)
  const result = await withRetry(
    async () => generateText({
      model,
      system: systemPrompt,
      messages: [
        ...messages,
        { role: 'user', content: question },
      ],
    }),
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
    }
  );

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

export async function generateQuiz(
  sources: Source[],
  questionCount: number = 5
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive educational quizzes as self-contained HTML/CSS/JS.
Generate an interactive quiz with multiple choice questions that test understanding of the key concepts.
Each question should have 4 options with one correct answer.
The quiz must be fully functional with immediate feedback when answers are selected.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create a ${questionCount}-question interactive multiple choice quiz based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML quiz with:
1. Each question displayed one at a time with a question counter
2. 4 clickable answer options per question styled as buttons
3. Immediate visual feedback (green for correct, red for incorrect)
4. Show the correct answer and brief explanation after selection
5. Navigation to next question after answering
6. Final score display at the end with option to restart
7. Clean, modern styling with good spacing and hover effects

Structure your response as:
<div class="quiz-container">
  <!-- Quiz HTML here - generate this FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the HTML structure above */
</style>
<script>
  // Interactive JavaScript referencing elements from the HTML above
</script>`,
  });

  return result.text;
}

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

export interface PodcastSegment {
  speaker: "host" | "guest";
  text: string;
}

export async function generatePodcastScript(
  sources: Source[],
  lengthMinutes: number = 5
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates engaging podcast scripts.
Write a natural conversation between two hosts discussing the topics.
Make it engaging, informative, and conversational.
The hosts should be curious, ask follow-up questions, and build on each other's points.`,
    prompt: `Create a ${lengthMinutes}-minute podcast script (approximately ${
      lengthMinutes * 150
    } words) based on these sources:

${buildSourceContextSimple(sources)}

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
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive slide deck presentations as self-contained HTML/CSS/JS.
Create a professional presentation with navigable slides that look like a real slideshow.
Each slide should have a clear title and 3-5 key points with visual hierarchy.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive slide deck presentation based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML slide deck with:
1. Full-width slides that display one at a time
2. Keyboard navigation (arrow keys) and clickable prev/next buttons
3. Slide counter showing current slide / total slides
4. Progress bar at the top
5. Clean, presentation-style design with large readable text
6. Title slide with main topic
7. Content slides with bullet points that have good visual hierarchy
8. Conclusion slide with key takeaways
9. Smooth slide transition animations
10. Subtle background color or gradient

Structure your response as:
<div class="slides-container">
  <!-- Slides HTML here - generate ALL slides FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the slide structure above */
</style>
<script>
  // Interactive JavaScript for navigation - reference elements from HTML above
</script>`,
  });

  return result.text;
}

export async function generateReport(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates formal reports.
Write a well-structured report with clear sections and professional language.
Include an executive summary, main body sections, and conclusions.`,
    prompt: `Create a formal report based on these sources:

${buildSourceContextSimple(sources)}

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

export async function generateMindMap(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive visual mind maps as self-contained HTML/CSS/JS.
Organize concepts in a visual tree structure showing relationships between ideas.
Create an expandable/collapsible tree visualization.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive visual mind map based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML mind map with:
1. A central topic node prominently displayed
2. Main branches radiating from the center (or top-down tree)
3. Sub-branches for detailed topics
4. Clickable nodes that expand/collapse their children
5. Visual connections (lines) between related nodes
6. Color-coded branches for different main topics
7. Hover effects on nodes
8. Smooth expand/collapse animations
9. Clean, modern design with rounded nodes

Structure your response as:
<div class="mindmap-container">
  <!-- Mind map HTML structure - generate FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the mind map structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse - reference elements from HTML above
</script>`,
  });

  return result.text;
}

export async function generateFlashcards(
  sources: Source[],
  cardCount: number = 10
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive study flashcards as self-contained HTML/CSS/JS.
Create clickable flashcards that flip to reveal answers when clicked.
Questions should be specific and answers should be concise but complete.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create ${cardCount} interactive flashcards based on these sources:

${buildSourceContextSimple(sources)}

Generate self-contained HTML flashcards with:
1. A card counter showing current card / total cards
2. Clickable cards that flip with a smooth 3D animation to reveal the answer
3. Previous/Next navigation buttons
4. Shuffle button to randomize card order
5. Progress indicator
6. Clean, modern card design with good contrast
7. Visual cue that cards are clickable (e.g., "Click to reveal" text)

Structure your response as:
<div class="flashcards-container">
  <!-- Flashcards HTML here - generate ALL cards FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles with 3D flip animation targeting the flashcard structure above */
</style>
<script>
  // Interactive JavaScript for flipping and navigation - reference elements from HTML above
</script>`,
  });

  return result.text;
}

export async function generateTimeline(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive visual timelines as self-contained HTML/CSS/JS.
Extract events, dates, and milestones from the sources.
Present them in a visually appealing, interactive timeline format.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive visual timeline based on events and dates found in these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML timeline with:
1. A vertical or horizontal timeline with a connecting line
2. Event nodes/dots along the timeline that are visually distinct
3. Clickable events that expand to show detailed descriptions
4. Dates/periods clearly displayed for each event
5. Alternating left/right positioning for visual interest (if vertical)
6. Smooth animations when expanding/collapsing event details
7. Color coding by category if events fall into different types
8. Clean, modern design with good use of spacing

If exact dates aren't available, use relative timing (e.g., "Phase 1", "Early Stage", "Later").

Structure your response as:
<div class="timeline-container">
  <!-- Timeline HTML here - generate ALL events FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles for timeline visualization targeting the structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse - reference elements from HTML above
</script>`,
  });

  return result.text;
}

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

export async function generateFAQ(
  sources: Source[],
  questionCount: number = 10
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates FAQ documents.
Anticipate common questions readers might have about the topics.
Provide clear, helpful answers based on the source content.`,
    prompt: `Create a FAQ with ${questionCount} questions based on these sources:

${buildSourceContextSimple(sources)}

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

export async function generateExecutiveBrief(
  sources: Source[]
): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates executive briefs.
Write a concise one-page summary for busy decision-makers.
Focus on key insights, implications, and recommended actions.`,
    prompt: `Create an executive brief (one-page summary) based on these sources:

${buildSourceContextSimple(sources)}

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
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates interactive study guides as self-contained HTML/CSS/JS.
Organize material for effective learning and review with expandable sections.
Include summaries, key concepts, and interactive review questions.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.`,
    prompt: `Create an interactive study guide based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML study guide with:
1. Collapsible/expandable sections for each topic
2. A table of contents with clickable links to sections
3. Highlighted key terms that can be clicked to show definitions
4. Interactive review questions at the end (click to reveal answers)
5. Progress tracking (checkboxes for completed sections)
6. Visual hierarchy with clear headings and indentation
7. Summary callout boxes for key takeaways
8. Clean, readable typography with good spacing

Structure should include:
- Overview section
- Key Concepts section with term definitions
- Main Topics (expandable sections)
- Review Questions (click to reveal answer)
- Summary section

Structure your response as:
<div class="study-guide-container">
  <!-- Study guide HTML here - generate ALL sections FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles for study guide targeting the structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse and reveal - reference elements from HTML above
</script>`,
  });

  return result.text;
}

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

export async function generateOutline(sources: Source[]): Promise<string> {
  const model = await getModel();
  if (!model) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const result = await generateText({
    model,
    system: `You are a helpful AI assistant that creates detailed outlines.
Organize content into a hierarchical document structure.
Use standard outline formatting with clear sections and subsections.`,
    prompt: `Create a detailed outline based on these sources:

${buildSourceContextSimple(sources)}

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

export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const model = await getModel();
    if (!model) {
      return { success: false, error: "No API key configured" };
    }

    await generateText({
      model,
      prompt: 'Say "Connection successful" in exactly those words.',
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test connection with specific provider, API key, and model
 * Useful for testing a configuration before saving it
 */
export async function testConnectionWithConfig(
  providerType: string,
  apiKey: string,
  modelId: string,
  timeoutMs: number = 15000
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const providerConfig = getProviderConfig(providerType);
    if (!providerConfig) {
      return { success: false, error: `Unknown provider: ${providerType}` };
    }

    const baseURL = providerConfig.baseURL;
    const model = providerConfig.createModel(apiKey, modelId, baseURL);

    if (!model) {
      return { success: false, error: "Failed to create model instance" };
    }

    // Add timeout to prevent indefinite waiting
    await Promise.race([
      generateText({
        model,
        prompt: 'Say "Connection successful" in exactly those words.',
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection test timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

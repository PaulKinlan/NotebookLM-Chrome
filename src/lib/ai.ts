import { streamText, generateText, type LanguageModel, type ToolSet, type ModelMessage } from 'ai';
import type { Source, Citation, Notebook, ChatEvent, ContextMode, StreamEvent } from '../types/index.ts';
import { getActiveNotebookId, getNotebook } from './storage.ts';
import { resolveModelConfig, type ResolvedModelConfig } from './model-configs.ts';
import {
  getProviderConfig,
  getProviderDefaultModel,
  providerRequiresApiKey,
  type AIProvider,
} from './provider-registry.ts';
import { withRetry } from './errors.ts';
import { trackUsage } from './usage.ts';

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

/**
 * Model instance with associated config for usage tracking
 */
interface ModelWithConfig {
  model: LanguageModel;
  config: ResolvedModelConfig;
}

async function getModel(): Promise<LanguageModel | null> {
  const result = await getModelWithConfig();
  return result?.model ?? null;
}

/**
 * Get model instance along with its configuration (for usage tracking)
 */
async function getModelWithConfig(): Promise<ModelWithConfig | null> {
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
  const model = createProviderInstance(
    providerType,
    apiKey,
    modelId || defaultModel,
    baseURL
  );

  if (!model) {
    return null;
  }

  return { model, config: resolved };
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

export interface SourceWithRelevance extends Source {
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
export async function rankSourceRelevance(
  sources: Source[],
  query: string
): Promise<SourceWithRelevance[]> {
  const modelWithConfig = await getModelWithConfig();
  if (!modelWithConfig) {
    // Fallback: return all sources without ranking if no model
    return sources.map(s => ({ ...s, relevanceScore: 1.0 }));
  }

  const { model, config } = modelWithConfig;
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

    // Track usage
    if (rankingsResult.usage) {
      trackUsage({
        modelConfigId: config.modelConfig.id,
        providerId: config.providerId,
        model: config.modelConfig.model,
        inputTokens: rankingsResult.usage.inputTokens ?? 0,
        outputTokens: rankingsResult.usage.outputTokens ?? 0,
        operation: 'ranking',
      }).catch((err) => console.warn('[AI] Failed to track ranking usage:', err));
    }
  } catch (error) {
    console.error('Failed to generate relevance ranking:', error);
    // Fallback: return all sources with neutral score when ranking generation fails
    return sources.map(s => ({ ...s, relevanceScore: 0.5 }));
  }

  try {
    // Handle potential markdown code fences around JSON
    const jsonText = rankingsResult.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const parsedRankings = JSON.parse(jsonText);

    // Type guard to ensure the parsed data has the correct structure
    if (!Array.isArray(parsedRankings)) {
      throw new Error('Rankings result is not an array');
    }

    const rankings: Array<{
      index: number;
      score: number;
      reason: string;
    }> = parsedRankings.map((r) => {
      if (typeof r.index !== 'number' || typeof r.score !== 'number' || typeof r.reason !== 'string') {
        throw new Error('Invalid ranking item structure');
      }
      return r;
    });

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

  const modelWithConfig = await getModelWithConfig();
  if (!modelWithConfig) return new Map();

  const { model, config } = modelWithConfig;
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

    // Track usage
    if (summaryResult.usage) {
      trackUsage({
        modelConfigId: config.modelConfig.id,
        providerId: config.providerId,
        model: config.modelConfig.model,
        inputTokens: summaryResult.usage.inputTokens ?? 0,
        outputTokens: summaryResult.usage.outputTokens ?? 0,
        operation: 'summarization',
      }).catch((err) => console.warn('[AI] Failed to track summarization usage:', err));
    }
  } catch (error) {
    console.error('Failed to generate summaries:', error);
    // Fallback: generate extractive summaries for all sources
    for (const source of sources) {
      const content = source.content || '';
      const sentenceMatches = content.match(/[^.!?]+[.!?]*/g) || [];
      const sentences = sentenceMatches
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const rawSummary =
        (sentences.length > 0 ? sentences.slice(0, 3).join(' ') : '') || content;
      const summary = rawSummary.trim();
      const finalSummary =
        summary === ''
          ? '(no content available)'
          : /[.!?]$/.test(summary)
          ? summary
          : summary + '.';
      summaries.set(source.id, finalSummary);
    }
    return summaries;
  }

  try {
    // Handle potential markdown code fences around JSON
    const jsonText = summaryResult.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const parsedSummaries = JSON.parse(jsonText);

    // Type guard to ensure the parsed data has the correct structure
    if (!Array.isArray(parsedSummaries)) {
      throw new Error('Summaries result is not an array');
    }

    const parsed: Array<{
      index: number;
      summary: string;
    }> = parsedSummaries.map((s) => {
      if (typeof s.index !== 'number' || typeof s.summary !== 'string') {
        throw new Error('Invalid summary item structure');
      }
      return s;
    });

    for (const item of parsed) {
      const source = batch[item.index - 1];
      if (source) {
        summaries.set(source.id, item.summary);
      }
    }
  } catch (error) {
    console.error('Failed to parse summaries:', error);
  }

  // Fallback: add extractive summaries for sources that weren't processed
  // (either beyond batch limit or missing from LLM response)
  for (const source of sources) {
    if (!summaries.has(source.id)) {
      const content = source.content || '';
      const sentenceMatches = content.match(/[^.!?]+[.!?]*/g) || [];
      const sentences = sentenceMatches
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const rawSummary =
        (sentences.length > 0 ? sentences.slice(0, 3).join(' ') : '') || content;
      const summary = rawSummary.trim();
      const finalSummary =
        summary === ''
          ? '(no content available)'
          : /[.!?]$/.test(summary)
          ? summary
          : summary + '.';
      summaries.set(source.id, finalSummary);
    }
  }

  return summaries;
}

/**
 * Single-pass compression: Fixed strategy without LLM ranking
 * Faster but less intelligent than two-pass
 */
function buildSourceContextSinglePass(
  sources: Source[]
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
    // Match sentence boundaries more robustly and filter empty matches
    const sentenceMatches = content.match(/[^.!?]+[.!?]*/g) || [];
    const sentences = sentenceMatches
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const rawSummary =
      (sentences.length > 0 ? sentences.slice(0, 3).join(' ') : '') || content;
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
    return buildSourceContextSinglePass(sources);
  }

  // Two-pass mode: Use LLM-based ranking and summarization
  // Pass 1: Rank by relevance
  const ranked = await rankSourceRelevance(sources, query);

  // Cap the number of full-content sources to prevent token overflow
  const MAX_FULL_CONTENT_SOURCES = 15;

  // Categorize by relevance
  const highlyRelevant = ranked.filter(s => (s.relevanceScore ?? 0) >= 0.7);
  const fullContentHighlyRelevant = highlyRelevant.slice(0, MAX_FULL_CONTENT_SOURCES);
  const summarizedHighlyRelevant = highlyRelevant.slice(MAX_FULL_CONTENT_SOURCES);
  const moderatelyRelevant = ranked
    .filter(s => (s.relevanceScore ?? 0) >= 0.4 && (s.relevanceScore ?? 0) < 0.7)
    .concat(summarizedHighlyRelevant);
  const lessRelevant = ranked.filter(s => (s.relevanceScore ?? 0) < 0.4);

  // Pass 2: Summarize moderately relevant sources (including overflow highly relevant)
  const summaries = await summarizeSources(moderatelyRelevant);

  // Build context with appropriate detail level
  const parts: string[] = [];
  let sourceIndex = 1; // Use sequential numeric indices for citations

  // Full content for top-N highly relevant sources
  // Cap at MAX_FULL_CONTENT_SOURCES to prevent token overflow
  for (const source of fullContentHighlyRelevant) {
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

/**
 * Build system prompt for agentic mode
 * In agentic mode, the LLM uses tools to explore sources on-demand
 */
function buildAgenticSystemPrompt(
  notebookName: string,
  sourceCount: number
): string {
  // When there are no sources, provide a general chat prompt
  if (sourceCount === 0) {
    return `You are a helpful AI assistant.

The user has not added any sources to this notebook yet.

Answer their questions helpfully and accurately using your general knowledge. You can:
- Answer general knowledge questions
- Help with writing, brainstorming, and problem-solving
- Explain concepts and provide information
- Suggest what kinds of sources would be helpful for their topic

Keep your responses conversational and helpful.`;
  }

  return `You are a helpful AI assistant analyzing sources from the notebook "${notebookName}".

AVAILABLE TOOLS:
- listSources: Get metadata for all ${sourceCount} sources (id, title, url, type, word count)
- findRelevantSources: Use LLM to rank sources by relevance to your query (returns scores 0.0-1.0 with explanations)
- readSource: Read full content of a specific source by ID

STRATEGY:
1. Start by listing sources to understand what's available
2. Use findRelevantSources when you need to narrow down sources for a specific query
3. Read full content of the most relevant sources
4. Always cite sources using [Source ID] format where ID is the source identifier
5. Be efficient - don't read sources unless needed

CRITICAL: After executing any tool, you MUST provide a text response to the user. Never end a conversation after a tool call without explaining the results or answering their question.

TIPS FOR USING findRelevantSources:
- Call this tool when you have a specific query or topic
- It returns sources ranked by relevance with explanations
- Use a minScore of 0.7 to get only highly relevant sources
- Use a minScore of 0.4 to get broadly relevant sources
- Then call readSource on the top results

CITATION FORMAT:
When referencing information from a source, use:
---CITATIONS---
[Source ID]: "exact quote or paraphrase"
---END CITATIONS---`;
}

async function buildChatSystemPrompt(
  sources: Source[],
  query: string,
  compressionMode: 'two-pass' | 'single-pass' = 'two-pass'
): Promise<string> {
  const sourceContext = await buildSourceContext(sources, query, compressionMode);

  // When there are no sources, provide a general chat prompt
  if (sources.length === 0) {
    return `You are a helpful AI assistant.

The user has not added any sources yet. Answer their questions helpfully and accurately using your general knowledge.

You can:
- Answer general knowledge questions
- Help with writing, brainstorming, and problem-solving
- Explain concepts and provide information
- Suggest what kinds of sources would be helpful for their topic

Keep your responses conversational and helpful.`;
  }

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

/**
 * Type guard to check if a value is JSON-serializable
 */
function isJSONValue(value: unknown): boolean {
  // Primitives and null
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  // Arrays
  if (Array.isArray(value)) {
    return true;
  }
  // Objects
  if (typeof value === 'object' && !Array.isArray(value)) {
    return true;
  }
  return false;
}

/**
 * Build chat history for AI API from ChatEvents.
 * Includes user messages, assistant messages with tool calls, and tool results.
 */
function buildChatHistory(history?: ChatEvent[]): ModelMessage[] {
  if (!history) return [];

  // Use all history events - context compression handles token limits efficiently

  const messages: ModelMessage[] = [];

  for (const event of history) {
    if (event.type === 'user') {
      messages.push({
        role: 'user',
        content: event.content,
      });
    } else if (event.type === 'assistant') {
      // If assistant has tool calls, format as content array
      if (event.toolCalls && event.toolCalls.length > 0) {
        type AssistantContent = Array<{ type: 'text'; text: string } | { type: 'tool-call'; toolName: string; toolCallId: string; input: Record<string, unknown> }>;

        const content: AssistantContent = [];

        // Add text content first (if any)
        if (event.content) {
          content.push({
            type: 'text',
            text: event.content,
          });
        }

        // Add tool calls using Vercel AI SDK format (input instead of args)
        for (const toolCall of event.toolCalls) {
          content.push({
            type: 'tool-call',
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            input: toolCall.args,
          });
        }

        messages.push({
          role: 'assistant',
          content,
        });
      } else {
        // No tool calls, just regular text message
        messages.push({
          role: 'assistant',
          content: event.content,
        });
      }
    } else if (event.type === 'tool-result') {
      // Add tool result for the model to see
      // ToolResultOutput format: { type: 'text' | 'json' | 'error-text' | 'error-json', value: string | JSONValue }

      if (event.error) {
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: { type: 'error-text', value: event.error },
            },
          ],
        });
      } else if (typeof event.result === 'string') {
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: { type: 'text', value: event.result },
            },
          ],
        });
      } else if (isJSONValue(event.result)) {
        // Runtime validation passed - use json type
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: { type: 'json', value: event.result },
            },
          ],
        });
      } else {
        // Fallback for non-JSON-serializable results
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              output: { type: 'error-text', value: 'Tool returned non-JSON-serializable result' },
            },
          ],
        });
      }
    }
  }

  return messages;
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
  history?: ChatEvent[],
  options?: {
    tools?: ToolSet;
    contextMode?: ContextMode;
    onStatus?: (status: string) => void;
  }
): AsyncGenerator<StreamEvent, ChatResult, unknown> {
  const modelWithConfig = await getModelWithConfig();
  if (!modelWithConfig) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const { model, config } = modelWithConfig;
  const { tools, contextMode, onStatus } = options || {};

  // Agentic mode: Pass tools to LLM, minimal initial context
  if (tools && contextMode === 'agentic') {
    const notebookName = sources[0]?.notebookId || 'this notebook';
    const systemPrompt = buildAgenticSystemPrompt(notebookName, sources.length);

    const messages = buildChatHistory(history);

    console.log('[Agentic Mode] Starting stream with tools:', Object.keys(tools));

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        ...messages,
        { role: 'user', content: question },
      ],
      tools,
    });

    // Use fullStream to capture tool calls and results
    let fullContent = "";
    let chunkCount = 0;

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          fullContent += chunk.text;
          chunkCount++;
          if (chunkCount === 1) {
            console.log('[Agentic Mode] First chunk received:', chunk.text);
          }
          yield { type: 'text', content: chunk.text };
          break;
        case 'tool-call': {
          console.log('[Agentic Mode] Tool called:', chunk.toolName, chunk.input);
          const args = chunk.input !== null ? (chunk.input as Record<string, unknown>) : {};
          yield {
            type: 'tool-call',
            toolName: chunk.toolName,
            args,
            toolCallId: chunk.toolCallId,
          };
          break;
        }
        case 'tool-result':
          console.log('[Agentic Mode] Tool result:', chunk.toolName, chunk.output);
          yield {
            type: 'tool-result',
            toolName: chunk.toolName,
            result: chunk.output,
            toolCallId: chunk.toolCallId,
          };
          break;
      }
    }

    console.log('[Agentic Mode] Stream complete. Total chunks:', chunkCount, 'Content length:', fullContent.length);

    // Track usage after stream completes
    const usage = await result.usage;
    if (usage) {
      trackUsage({
        modelConfigId: config.modelConfig.id,
        providerId: config.providerId,
        model: config.modelConfig.model,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        operation: 'chat',
      }).catch((err) => console.warn('[AI] Failed to track usage:', err));
    }

    // In agentic mode, we still parse citations from the response
    // The LLM should cite sources using [Source ID] format based on tool results
    const { cleanContent, citations } = parseCitations(fullContent, sources);

    return {
      content: cleanContent,
      citations,
    };
  }

  // Classic mode: Pre-load sources with compression
  const compressionMode = await getCompressionMode();
  onStatus?.("Analyzing sources...");
  const systemPrompt = await buildChatSystemPrompt(sources, question, compressionMode);
  onStatus?.("Generating response...");

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
    const cleanChunk = chunk.replace(/---CITATIONS---[\s\S]*$/, "");
    yield { type: 'text', content: cleanChunk };
  }

  // Track usage after stream completes
  const usage = await result.usage;
  if (usage) {
    trackUsage({
      modelConfigId: config.modelConfig.id,
      providerId: config.providerId,
      model: config.modelConfig.model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      operation: 'chat',
    }).catch((err) => console.warn('[AI] Failed to track usage:', err));
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
  history?: ChatEvent[],
  onStatus?: (status: string) => void
): Promise<ChatResult> {
  const modelWithConfig = await getModelWithConfig();
  if (!modelWithConfig) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const { model, config } = modelWithConfig;

  const compressionMode = await getCompressionMode();
  onStatus?.("Analyzing sources...");
  const systemPrompt = await buildChatSystemPrompt(sources, question, compressionMode);
  onStatus?.("Generating response...");

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

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: config.modelConfig.id,
      providerId: config.providerId,
      model: config.modelConfig.model,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'chat',
    }).catch((err) => console.warn('[AI] Failed to track usage:', err));
  }

  const { cleanContent, citations } = parseCitations(result.text, sources);

  return {
    content: cleanContent,
    citations,
  };
}

// ============================================================================
// Transformations (re-exported from transforms/)
// ============================================================================

export {
  generateSummary,
  generateKeyTakeaways,
  generateQuiz,
  generateEmailSummary,
  generatePodcastScript,
  generateSlideDeck,
  generateReport,
  generateDataTable,
  generateMindMap,
  generateFlashcards,
  generateTimeline,
  generateGlossary,
  generateComparison,
  generateFAQ,
  generateActionItems,
  generateExecutiveBrief,
  generateStudyGuide,
  generateProsCons,
  generateCitationList,
  generateOutline,
  type PodcastSegment,
} from './transforms/index.ts';

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

/**
 * Agent Tools for Agentic Source Exploration
 *
 * Defines tools that the LLM can call to explore and interact with notebook sources.
 * Uses AI SDK's tool() function for type-safe tool definitions with automatic validation.
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { getSourcesByNotebook, getSource } from './storage.ts';
import { dbGet, dbPut, dbDelete, dbGetAll } from './db.ts';
import {
  createApprovalRequest,
  approvalEvents,
} from './tool-approvals.ts';

// ============================================================================
// Tool Result Caching
// ============================================================================

const TOOL_RESULTS_STORE = 'toolResults';
const TOOL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedToolResult {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  createdAt: number;
  expiresAt: number;
}

/**
 * Generate a cache key for a tool call
 */
function generateCacheKey(toolName: string, input: unknown): string {
  const inputStr = JSON.stringify(input);
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    const char = inputStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${toolName}:${Math.abs(hash)}`;
}

/**
 * Type guard to check if value is of expected type
 */
function isType<T>(_value: unknown): _value is T {
  // This is a runtime type guard placeholder
  // In a production system, you would use Zod or similar for validation
  // For now, we trust that the cached data is correctly typed
  return true;
}

/**
 * Get cached tool result if available and not expired
 */
export async function getCachedToolResult<TINPUT, TOUTPUT>(
  toolName: string,
  input: TINPUT
): Promise<TOUTPUT | null> {
  const key = generateCacheKey(toolName, input);

  try {
    const result = await dbGet<{ key: string; value: CachedToolResult }>(
      TOOL_RESULTS_STORE,
      key
    );

    if (!result) {
      return null;
    }

    const cached = result.value;
    if (Date.now() > cached.expiresAt) {
      // Expired, remove from cache
      await dbDelete(TOOL_RESULTS_STORE, key);
      return null;
    }

    // Use type guard to narrow the type
    const output = cached.output;
    if (isType<TOUTPUT>(output)) {
      return output;
    }

    return null;
  } catch {
    // If tool results store doesn't exist yet, just return null
    return null;
  }
}

/**
 * Cache tool result with TTL
 */
export async function setCachedToolResult<TINPUT, TOUTPUT>(
  toolName: string,
  input: TINPUT,
  output: TOUTPUT
): Promise<void> {
  const key = generateCacheKey(toolName, input);
  const now = Date.now();

  const cached: CachedToolResult = {
    id: key,
    toolName,
    input,
    output,
    createdAt: now,
    expiresAt: now + TOOL_CACHE_TTL_MS,
  };

  try {
    await dbPut(TOOL_RESULTS_STORE, { key, value: cached });
  } catch {
    // If tool results store doesn't exist yet, skip caching
    // This will be created when DB is upgraded to version 4
  }
}

/**
 * Clean up expired tool results
 * Called on app startup to keep cache size manageable
 */
export async function cleanupExpiredToolResults(): Promise<void> {
  try {
    const results = await dbGetAll<{ key: string; value: CachedToolResult }>(
      TOOL_RESULTS_STORE
    );
    const now = Date.now();

    for (const result of results) {
      if (now > result.value.expiresAt) {
        await dbDelete(TOOL_RESULTS_STORE, result.key);
      }
    }
  } catch {
    // Store doesn't exist yet, nothing to clean
  }
}

// ============================================================================
// Source Tools
// ============================================================================

/**
 * listSources - Get metadata for all sources in a notebook
 *
 * Returns lightweight metadata (id, title, url, type, wordCount) for all sources.
 * Useful for understanding what sources are available before reading specific ones.
 *
 * Note: Caching is disabled by default. To enable caching, wrap with withCache():
 *   execute: withCache('listSources', async ({ notebookId }) => { ... })
 */
export const listSources = tool({
  description: 'Get metadata for all sources in a notebook, including id, title, url, type, and word count',
  inputSchema: z.object({
    notebookId: z.string().describe('The ID of the notebook to list sources from'),
  }),
  execute: async ({ notebookId }: { notebookId: string }) => {
    const sources = await getSourcesByNotebook(notebookId);

    // Transform to lightweight metadata format
    const sourceMetadata: SourceMetadata[] = sources.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      type: s.type,
      wordCount: s.metadata?.wordCount || 0,
    }));

    return {
      sources: sourceMetadata,
      totalCount: sources.length,
    };
  },
});

/**
 * readSource - Get full content of a specific source
 *
 * Returns complete source content including text and metadata.
 * Use this after listing sources to get detailed information about specific sources of interest.
 *
 * Note: Caching is disabled by default. To enable caching, wrap with withCache():
 *   execute: withCache('readSource', async ({ sourceId }) => { ... })
 */
export const readSource = tool({
  description: 'Get the full content of a specific source by its ID',
  inputSchema: z.object({
    sourceId: z.string().describe('The ID of the source to read'),
  }),
  execute: async ({ sourceId }: { sourceId: string }) => {
    const source = await getSource(sourceId);

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    return {
      id: source.id,
      title: source.title,
      url: source.url,
      type: source.type,
      content: source.content,
      metadata: source.metadata,
    };
  },
});

/**
 * findRelevantSources - Use LLM to rank sources by relevance to a query
 *
 * Returns sources ranked by relevance score (0.0-1.0) with explanations.
 * Use this when you need to find which sources are most relevant to a specific query
 * before reading them in detail.
 */
export const findRelevantSources = tool({
  description: `Find sources relevant to a specific query using LLM-based relevance ranking.

Returns ranked sources with:
- relevanceScore: 0.0-1.0 (higher = more relevant)
- relevanceReason: explanation of why it's relevant

Score guidelines:
- 0.9-1.0: Directly answers the question
- 0.7-0.9: Strongly relevant background
- 0.5-0.7: Somewhat related
- 0.3-0.5: Tangentially related
- 0.0-0.3: Not relevant

Use this tool to narrow down which sources to read in detail.`,
  inputSchema: z.object({
    notebookId: z.string().describe('The ID of the notebook to search'),
    query: z.string().describe('The query to find relevant sources for'),
    maxSources: z.number().min(1).max(50).default(10)
      .describe('Maximum number of sources to return'),
    minScore: z.number().min(0).max(1).default(0.4)
      .describe('Minimum relevance score (0.0-1.0) to include'),
  }),
  execute: async ({ notebookId, query, maxSources, minScore }) => {
    // Check cache first
    const cacheKey = `${notebookId}:${query}:${maxSources}:${minScore}`;
    const cached = await getCachedToolResult('findRelevantSources', { cacheKey });
    if (cached) return cached;

    // Import the router function
    const { rankSourceRelevance } = await import('./ai.ts');
    const sources = await getSourcesByNotebook(notebookId);

    // Use the router to rank sources
    const ranked = await rankSourceRelevance(sources, query);

    // Filter by min score and limit
    const filtered = ranked
      .filter(s => (s.relevanceScore ?? 0) >= minScore)
      .slice(0, maxSources);

    const result = {
      query,
      totalMatches: filtered.length,
      sources: filtered.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        type: s.type,
        relevanceScore: s.relevanceScore,
        relevanceReason: s.relevanceReason,
      }))
    };

    // Cache the result
    await setCachedToolResult('findRelevantSources', { cacheKey }, result);

    return result;
  },
});

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Lightweight metadata for a source (returned by listSources)
 */
export interface SourceMetadata {
  id: string;
  title: string;
  url: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text';
  wordCount: number;
}

/**
 * Full content of a source (returned by readSource)
 */
export interface SourceContent {
  id: string;
  title: string;
  url: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text';
  content: string;
  metadata?: {
    favicon?: string;
    description?: string;
    wordCount?: number;
  };
}

// ============================================================================
// Tool Registry Configuration
// ============================================================================

/**
 * Configuration for a tool in the registry
 * Allows enabling caching per-tool at registration time
 */
interface ToolConfig {
  /** The AI SDK tool definition */
  tool: Tool;
  /** Enable caching for this tool (default: false) */
  cache?: boolean;
}

/**
 * Wraps a tool execute function with caching if enabled in config
 */
function wrapToolWithCache(
  toolName: string,
  coreTool: Tool,
  enabled: boolean
): Tool {
  if (!enabled || !coreTool.execute) return coreTool;

  const originalExecute = coreTool.execute;

  return {
    ...coreTool,
    execute: async (input, options) => {
      // Check cache first
      const cached = await getCachedToolResult<unknown, unknown>(toolName, input);
      if (cached !== null) return cached;

      // Execute the original function
      const result = await originalExecute(input, options);

      // Cache the result
      await setCachedToolResult(toolName, input, result);

      return result;
    },
  };
}

/**
 * Tool registry with per-tool caching configuration
 * Set `cache: true` to enable caching for a specific tool
 */
const sourceToolsRegistry: Record<string, ToolConfig> = {
  listSources: { tool: listSources, cache: false },
  readSource: { tool: readSource, cache: false },
};

/**
 * Get tools with caching applied based on registry configuration
 * Call this to get the tools object to pass to streamText()
 */
export function getSourceTools() {
  const result: Record<string, Tool> = {};

  for (const [name, config] of Object.entries(sourceToolsRegistry)) {
    result[name] = wrapToolWithCache(name, config.tool, config.cache ?? false);
  }

  return result;
}

/**
 * Direct access to tools (no caching applied by default)
 * Enable caching by setting `cache: true` in sourceToolsRegistry above
 */
export const sourceTools = getSourceTools();

// ============================================================================
// Tool Approval Wrapper
// ============================================================================

/**
 * Wraps a tool execute function to require user approval before execution.
 *
 * Usage:
 *   export const deleteSource = tool({
 *     description: 'Delete a source',
 *     inputSchema: z.object({ sourceId: z.string() }),
 *     execute: withApproval(
 *       'deleteSource',
 *       'This will permanently delete the source',
 *       async ({ sourceId }) => {
 *         await deleteSourceFromDB(sourceId);
 *         return { success: true };
 *       }
 *     ),
 *   });
 */
export function withApproval<TArgs extends Record<string, unknown>, TResult>(
  toolName: string,
  reason: string,
  executeFn: (args: TArgs) => Promise<TResult>
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs): Promise<TResult> => {
    const toolCallId = crypto.randomUUID();

    // Create approval request (persisted to IndexedDB)
    const request = await createApprovalRequest(
      toolCallId,
      toolName,
      args,
      reason
    );

    // Wait indefinitely for user decision via event
    const approved = await new Promise<boolean>((resolve) => {
      approvalEvents.on(request.id, (_requestId, approved) => {
        resolve(approved);
      });
    });

    // Execute the tool if approved, otherwise throw
    if (!approved) {
      throw new Error(`Tool execution rejected by user: ${reason}`);
    }

    return await executeFn(args);
  };
}

// ============================================================================
// Tool Approval Documentation
// ============================================================================

/**
 * Tools can require user approval before execution by setting `needsApproval: true`.
 *
 * Approval workflow: pauses execution → shows dialog → waits for approve/reject → executes if approved
 * Requests expire after 5 minutes.
 *
 * Example:
 *   export const deleteSource = tool({
 *     description: 'Delete a source',
 *     inputSchema: z.object({ sourceId: z.string() }),
 *     execute: async ({ sourceId }) => {
 *       // tool implementation
 *     },
 *     needsApproval: true,
 *   });
 */

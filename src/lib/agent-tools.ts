/**
 * Agent Tools for Agentic Source Exploration
 *
 * Defines tools that the LLM can call to explore and interact with notebook sources.
 * Uses AI SDK's tool() function for type-safe tool definitions with automatic validation.
 */

import { tool } from 'ai';
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
  input: Record<string, unknown>;
  output: unknown;
  createdAt: number;
  expiresAt: number;
}

/**
 * Generate a cache key for a tool call
 */
function generateCacheKey(toolName: string, input: Record<string, unknown>): string {
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
 * Get cached tool result if available and not expired
 */
async function getCachedToolResult(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown | null> {
  const key = generateCacheKey(toolName, input);

  try {
    const result = await dbGet<{ key: string; value: CachedToolResult }>(
      TOOL_RESULTS_STORE,
      key
    );

    if (!result) return null;

    const cached = result.value;
    if (Date.now() > cached.expiresAt) {
      // Expired, remove from cache
      await dbDelete(TOOL_RESULTS_STORE, key);
      return null;
    }

    return cached.output;
  } catch {
    // If tool results store doesn't exist yet, just return null
    return null;
  }
}

/**
 * Cache tool result with TTL
 */
async function setCachedToolResult(
  toolName: string,
  input: Record<string, unknown>,
  output: unknown
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
 */
export const listSources = tool({
  description: 'Get metadata for all sources in a notebook, including id, title, url, type, and word count',
  inputSchema: z.object({
    notebookId: z.string().describe('The ID of the notebook to list sources from'),
  }),
  execute: async ({ notebookId }: { notebookId: string }) => {
    // Check cache first
    const cached = await getCachedToolResult('listSources', { notebookId });
    if (cached) return cached as { sources: SourceMetadata[]; totalCount: number };

    const sources = await getSourcesByNotebook(notebookId);

    // Transform to lightweight metadata format
    const sourceMetadata: SourceMetadata[] = sources.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      type: s.type,
      wordCount: s.metadata?.wordCount || 0,
    }));

    const result = {
      sources: sourceMetadata,
      totalCount: sources.length,
    };

    // Cache the result
    await setCachedToolResult('listSources', { notebookId }, result);

    return result;
  },
});

/**
 * readSource - Get full content of a specific source
 *
 * Returns complete source content including text and metadata.
 * Use this after listing sources to get detailed information about specific sources of interest.
 */
export const readSource = tool({
  description: 'Get the full content of a specific source by its ID',
  inputSchema: z.object({
    sourceId: z.string().describe('The ID of the source to read'),
  }),
  execute: async ({ sourceId }: { sourceId: string }) => {
    // Check cache first
    const cached = await getCachedToolResult('readSource', { sourceId });
    if (cached) return cached as SourceContent;

    const source = await getSource(sourceId);

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    const result: SourceContent = {
      id: source.id,
      title: source.title,
      url: source.url,
      type: source.type,
      content: source.content,
      metadata: source.metadata,
    };

    // Cache the result
    await setCachedToolResult('readSource', { sourceId }, result);

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
// Tool Registry
// ============================================================================

/**
 * All source-related tools
 * Pass these to streamText() when using agentic mode
 */
export const sourceTools = {
  listSources,
  readSource,
};

/**
 * Type for the source tools object
 */
export type SourceTools = typeof sourceTools;

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

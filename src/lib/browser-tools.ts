/**
 * Browser Tools for Chrome Extension
 *
 * Defines tools that the LLM can call to interact with Chrome browser APIs.
 * These tools enable listing windows, tabs, tab groups, and reading page content.
 *
 * IMPORTANT: These tools require the 'tabs' and 'tabGroups' optional permissions.
 * The tools will check permissions before executing and return helpful errors if
 * permissions are not granted.
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { checkPermissions } from './permissions.ts';

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata about a Chrome window
 */
export interface WindowInfo {
  id: number;
  focused: boolean;
  type: 'normal' | 'popup' | 'panel' | 'app' | 'devtools';
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
}

/**
 * Metadata about a Chrome tab
 */
export interface TabInfo {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  active: boolean;
  pinned: boolean;
  groupId: number;
}

/**
 * Metadata about a Chrome tab group
 */
export interface TabGroupInfo {
  id: number;
  windowId: number;
  title: string;
  color:
    | 'grey'
    | 'blue'
    | 'red'
    | 'yellow'
    | 'green'
    | 'pink'
    | 'purple'
    | 'cyan';
  collapsed: boolean;
}

/**
 * Content extracted from a page
 */
export interface PageContent {
  tabId: number;
  title: string;
  url: string;
  content: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Send a message to the background script and wait for a response
 */
async function sendMessageToBackground<T = unknown>(
  type: string,
  payload?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

// ============================================================================
// Browser Tools
// ============================================================================

/**
 * listWindows - List all open Chrome windows
 *
 * Returns information about all open windows including their ID,
 * focus state, type, and window state.
 */
export const listWindows = tool({
  description: 'List all open Chrome windows with their IDs, focus state, type, and window state',
  inputSchema: z.object({}),
  execute: async () => {
    // Check if tabs permission is granted
    const permissions = await checkPermissions();
    if (!permissions.tabs) {
      throw new Error(
        'The "tabs" permission is required to list windows. Please grant this permission in the extension settings.'
      );
    }

    return sendMessageToBackground<{ windows: WindowInfo[] }>(
      'LIST_WINDOWS'
    );
  },
});

/**
 * listTabs - List tabs with titles and URLs
 *
 * Returns information about tabs. Can filter by window ID to get
 * tabs from a specific window, or return all tabs across all windows.
 */
export const listTabs = tool({
  description: 'List tabs with their titles and URLs. Optionally filter by window ID to get tabs from a specific window.',
  inputSchema: z
    .object({
      windowId: z
        .number()
        .optional()
        .describe('Optional window ID to filter tabs. If omitted, returns all tabs across all windows.'),
    })
    .optional(),
  execute: async ({ windowId } = {}) => {
    // Check if tabs permission is granted
    const permissions = await checkPermissions();
    if (!permissions.tabs) {
      throw new Error(
        'The "tabs" permission is required to list tabs. Please grant this permission in the extension settings.'
      );
    }

    return sendMessageToBackground<{ tabs: TabInfo[] }>('LIST_TABS', { windowId });
  },
});

/**
 * listTabGroups - List all tab groups
 *
 * Returns information about all tab groups including their ID,
 * title, color, and which window they belong to.
 */
export const listTabGroups = tool({
  description: 'List all tab groups with their IDs, titles, colors, and window associations',
  inputSchema: z.object({}),
  execute: async () => {
    // Check if tabs and tabGroups permissions are granted
    const permissions = await checkPermissions();
    if (!permissions.tabs || !permissions.tabGroups) {
      throw new Error(
        'The "tabs" and "tabGroups" permissions are required to list tab groups. Please grant these permissions in the extension settings.'
      );
    }

    return sendMessageToBackground<{ tabGroups: TabGroupInfo[] }>(
      'LIST_TAB_GROUPS'
    );
  },
});

/**
 * readPageContent - Read the content of a specific tab
 *
 * Extracts the text content from a specific tab by its ID.
 * Returns the page title, URL, and extracted text content.
 */
export const readPageContent = tool({
  description: 'Read and extract the text content from a specific tab by its ID. Returns the page title, URL, and extracted content.',
  inputSchema: z.object({
    tabId: z.number().describe('The ID of the tab to read content from'),
  }),
  execute: async ({ tabId }) => {
    // Check if tabs permission is granted
    const permissions = await checkPermissions();
    if (!permissions.tabs) {
      throw new Error(
        'The "tabs" permission is required to read page content. Please grant this permission in the extension settings.'
      );
    }

    return sendMessageToBackground<PageContent>('READ_PAGE_CONTENT', { tabId });
  },
});

// ============================================================================
// Tool Registry Configuration
// ============================================================================

/**
 * Configuration for a browser tool in the registry
 * Allows enabling caching per-tool at registration time
 */
interface BrowserToolConfig {
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
) {
  if (!enabled || !coreTool.execute) return coreTool;

  const originalExecute = coreTool.execute;

  return {
    ...coreTool,
    execute: async (input: unknown, options?: unknown) => {
      // Import here to avoid circular dependency
      const { getCachedToolResult, setCachedToolResult } = await import(
        './agent-tools.ts'
      );

      // Check cache first
      const cached = await getCachedToolResult<unknown, unknown>(
        toolName,
        input
      );
      if (cached) return cached;

      // Execute the original function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await originalExecute(input, options as any);

      // Cache the result
      await setCachedToolResult(toolName, input, result);

      return result;
    },
  };
}

/**
 * Browser tool registry with per-tool caching configuration
 * Set `cache: true` to enable caching for a specific tool
 *
 * Note: Browser data changes frequently (tabs open/close, content changes),
 * so caching is disabled by default. Only enable caching for tools where
 * the data is relatively stable or you accept stale data.
 */
const browserToolsRegistry: Record<string, BrowserToolConfig> = {
  listWindows: { tool: listWindows, cache: false },
  listTabs: { tool: listTabs, cache: false },
  listTabGroups: { tool: listTabGroups, cache: false },
  readPageContent: { tool: readPageContent, cache: false },
};

/**
 * Get browser tools with caching applied based on registry configuration
 * Call this to get the tools object to pass to streamText()
 */
export function getBrowserTools() {
  const result: Record<string, Tool> = {};

  for (const [name, config] of Object.entries(browserToolsRegistry)) {
    result[name] = wrapToolWithCache(name, config.tool, config.cache ?? false);
  }

  return result;
}

/**
 * Direct access to browser tools (no caching applied by default)
 * Enable caching by setting `cache: true` in browserToolsRegistry above
 */
export const browserTools = getBrowserTools();

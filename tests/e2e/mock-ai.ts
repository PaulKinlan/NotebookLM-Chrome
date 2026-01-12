/**
 * Mock AI Provider for E2E Testing
 *
 * Simulates the AI SDK's streamText function to test tool approval flows
 * without requiring real AI API keys or Chrome's built-in AI.
 */

import type { LanguageModel } from 'ai';

// ============================================================================
// Types
// ============================================================================

/**
 * Mock tool call event that the mock AI should trigger
 */
export interface MockToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

/**
 * Configuration for the mock AI response
 */
export interface MockAIConfig {
  /** Tool calls to simulate in order */
  toolCalls: MockToolCall[];
  /** Final text response after tools execute */
  finalResponse?: string;
  /** Delay before each tool call (ms) */
  delay?: number;
}

// ============================================================================
// Mock LanguageModel
// ============================================================================

/**
 * Create a mock LanguageModel that generates tool calls
 */
export function createMockModel(config: MockAIConfig): LanguageModel {
  const mockModel: LanguageModel = {
    // Required properties for LanguageModel interface
    provider: string,
    specification: string,
    supportsImageInput: boolean,
    defaultObjectGenerationType: string,

    // The model ID
    get modelId() {
      return 'mock-test-model';
    },

    // Temperature setting
    get temperature() {
      return 0.7;
    },

    set temperature(_value) {
      // Ignore for mock
    },

    // Top P setting
    get topP() {
      return 1;
    },

    set topP(_value) {
      // Ignore for mock
    },

    // Max tokens setting
    get maxTokens() {
      return 4096;
    },

    set maxTokens(_value) {
      // Ignore for mock
    },

    // Seed setting
    get seed() {
      return undefined;
    },

    set seed(_value) {
      // Ignore for mock
    },

    // Frequency penalty
    get frequencyPenalty() {
      return 0;
    },

    set frequencyPenalty(_value) {
      // Ignore for mock
    },

    // Presence penalty
    get presencePenalty() {
      return 0;
    },

    set presencePenalty(_value) {
      // Ignore for mock
    },

    // Stop sequences
    get stopSequences() {
      return undefined;
    },

    set stopSequences(_value) {
      // Ignore for mock
    },

    // DoGenerate method (not used for streaming, but required)
    async doGenerate(_options) {
      return {
        text: config.finalResponse || 'Mock response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
        },
        finishReason: 'stop',
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: undefined,
        response: {
          headers: {},
        },
        metadata: {},
        messages: [],
      };
    },

    // DoStream method - main entry point for streaming
    async doStream(options) {
      const toolCallsToMake = [...config.toolCalls];
      const delay = config.delay || 100;

      // Create an async generator that yields mock chunks
      async function* generateChunks() {
        // For each tool call, emit:
        // 1. tool-call event
        // 2. Wait (simulating tool execution)
        // 3. tool-result event

        for (const toolCall of toolCallsToMake) {
          // Emit tool-call event
          const toolCallId = `mock-tool-call-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          yield {
            type: 'tool-call',
            toolName: toolCall.toolName,
            toolCallId,
            input: toolCall.args,
          };

          // Simulate delay for tool execution
          await new Promise(resolve => setTimeout(resolve, delay));

          // Execute the tool and emit result
          let toolResult = toolCall.result;

          // If tool is listSources and we have a notebookId, fetch actual sources
          if (toolCall.toolName === 'listSources' && toolCall.args.notebookId) {
            try {
              const sources = await mockListSources(toolCall.args.notebookId as string);
              toolResult = sources;
            } catch {
              toolResult = { sources: [], totalCount: 0 };
            }
          }

          yield {
            type: 'tool-result',
            toolName: toolCall.toolName,
            toolCallId,
            result: toolResult,
            isError: false,
          };

          // Wait before next tool call
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Emit final text response
        if (config.finalResponse) {
          yield {
            type: 'text-delta',
            text: config.finalResponse,
          };
        }
      }

      return {
        stream: generateChunks(),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: undefined,
        request: {},
        response: {
          headers: {},
        },
        metadata: {},
      };
    },
  };

  // Set required properties
  (mockModel as any).provider = 'mock-test-provider';
  (mockModel as any).specification = 'mock-test';
  (mockModel as any).supportsImageInput = false;
  (mockModel as any).defaultObjectGenerationType = 'text';

  return mockModel;
}

// ============================================================================
// Mock Tool Implementations
// ============================================================================

/**
 * Mock implementation of listSources that reads from IndexedDB
 */
async function mockListSources(notebookId: string): Promise<{ sources: Array<{ id: string; title: string; url: string; type: string; wordCount: number }>; totalCount: number }> {
  // This runs in Node.js context, not browser, so we need to handle it differently
  // For now, return a mock result
  return {
    sources: [
      {
        id: 'mock-source-1',
        title: 'Test Source for Tool Approval',
        url: 'https://example.com/test',
        type: 'manual',
        wordCount: 42,
      },
    ],
    totalCount: 1,
  };
}

// ============================================================================
// Test Helper: Setup Mock AI in Browser
// ============================================================================

/**
 * Initialize mock AI in the browser context
 * This should be called from E2E tests to set up the mock
 */
export async function setupMockAIInBrowser(
  page: Awaited<ReturnType<ReturnType<typeof import('@playwright/test').page>>,
  config: MockAIConfig
): Promise<void> {
  await page.evaluate((mockConfig) => {
    // Store mock config in window for test harness to pick up
    (window as any).__mockAIConfig = mockConfig;

    // Override the streamText function globally
    const originalStreamText = (window as any).ai?.streamText;

    if (originalStreamText) {
      (window as any).ai.streamText = function(options: any) {
        const config = (window as any).__mockAIConfig as MockAIConfig;
        if (!config) {
          return originalStreamText(options);
        }

        // Create mock response
        const toolCallsToMake = [...config.toolCalls];
        const delay = config.delay || 100;

        let fullContent = '';
        let chunkCount = 0;

        // Create mock fullStream
        async function* mockFullStream() {
          for (const toolCall of toolCallsToMake) {
            const toolCallId = `mock-tool-call-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Emit tool-call event
            yield {
              type: 'tool-call',
              toolName: toolCall.toolName,
              toolCallId,
              input: toolCall.args,
            };

            // Simulate delay for tool execution
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Emit tool-result event
            yield {
              type: 'tool-result',
              toolName: toolCall.toolName,
              toolCallId,
              result: toolCall.result,
              isError: false,
            };

            // Wait before next tool call
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          // Emit final text response
          if (config.finalResponse) {
            yield {
              type: 'text-delta',
              text: config.finalResponse,
            };
            fullContent = config.finalResponse;
            chunkCount = 1;
          }
        }

        // Create mock textStream
        async function* mockTextStream() {
          if (config.finalResponse) {
            yield config.finalResponse;
          }
        }

        // Return mock result object
        return {
          fullStream: mockFullStream(),
          textStream: mockTextStream(),
          usage: Promise.resolve({
            promptTokens: 10,
            completionTokens: config.finalResponse?.length || 20,
          }),
          text: Promise.resolve(config.finalResponse || 'Mock response'),
          finishReason: 'stop',
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: undefined,
          request: {},
          response: { headers: {} },
          metadata: {},
          experimental: {},
        };
      };
    }
  }, config as any);
}

// ============================================================================
// Test Helper: Create Mock Config for Common Scenarios
// ============================================================================

/**
 * Create mock config for testing listSources tool
 */
export function createListSourcesMockConfig(notebookId: string): MockAIConfig {
  return {
    toolCalls: [
      {
        toolName: 'listSources',
        args: { notebookId },
        result: {
          sources: [
            {
              id: 'mock-source-1',
              title: 'Test Source for Tool Approval',
              url: 'https://example.com/test',
              type: 'manual',
              wordCount: 42,
            },
          ],
          totalCount: 1,
        },
      },
    ],
    finalResponse: 'I found 1 source in your notebook: "Test Source for Tool Approval".',
    delay: 500,
  };
}

/**
 * Create mock config for testing readSource tool
 */
export function createReadSourceMockConfig(sourceId: string): MockAIConfig {
  return {
    toolCalls: [
      {
        toolName: 'readSource',
        args: { sourceId },
        result: {
          id: sourceId,
          title: 'Test Source',
          url: 'https://example.com/test',
          type: 'manual',
          content: '# Test Source\n\nThis is test content.',
        },
      },
    ],
    finalResponse: 'I read the source. It contains test content.',
    delay: 500,
  };
}

/**
 * Create mock config for testing findRelevantSources tool
 */
export function createFindRelevantSourcesMockConfig(notebookId: string, query: string): MockAIConfig {
  return {
    toolCalls: [
      {
        toolName: 'findRelevantSources',
        args: { notebookId, query, maxSources: 10, minScore: 0.4 },
        result: {
          query,
          totalMatches: 1,
          sources: [
            {
              id: 'mock-source-1',
              title: 'Test Source for Tool Approval',
              url: 'https://example.com/test',
              type: 'manual',
              relevanceScore: 0.9,
              relevanceReason: 'Directly matches the query',
            },
          ],
        },
      },
    ],
    finalResponse: 'I found 1 relevant source for your query.',
    delay: 500,
  };
}

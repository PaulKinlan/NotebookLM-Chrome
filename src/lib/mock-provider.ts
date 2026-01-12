/**
 * Mock AI Provider for Testing
 *
 * Simulates an LLM that calls tools, but uses the real tool implementations.
 * This enables E2E testing of tool approval flows without real AI API calls.
 */

import type {
  LanguageModelV3,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3GenerateResult,
  LanguageModelV3Text,
  LanguageModelV3FinishReason,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';

/**
 * Mock behavior configuration
 * Set via chrome.storage.local before using the provider
 */
interface MockBehavior {
  /** Tools to call (in order) */
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>;
  /** Final response after tools execute */
  finalResponse: string;
  /** Delay before each response chunk (ms) */
  delay?: number;
}

const MOCK_BEHAVIOR_KEY = '__mock_ai_behavior__';

/**
 * Get the mock behavior configuration from storage
 */
async function getMockBehavior(): Promise<MockBehavior | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([MOCK_BEHAVIOR_KEY], (result) => {
      resolve((result[MOCK_BEHAVIOR_KEY] as MockBehavior | undefined) || null);
    });
  });
}

/**
 * Mock Language Model implementation
 */
class MockLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'mock-test' as const;

  // Generate unique IDs for stream parts
  private chunkId = 0;
  private getId = () => `chunk-${this.chunkId++}`;

  constructor(
    public readonly modelId: string,
    private readonly supported: Record<string, RegExp[]> = {}
  ) {}

  get supportedUrls(): Record<string, RegExp[]> {
    return this.supported;
  }

  async doGenerate(): Promise<LanguageModelV3GenerateResult> {
    const behavior = await getMockBehavior();

    const content: LanguageModelV3Text[] = [
      { type: 'text', text: behavior?.finalResponse || 'Mock response' },
    ];

    const finishReason: LanguageModelV3FinishReason = {
      unified: 'stop',
      raw: 'stop',
    };

    const usage: LanguageModelV3Usage = {
      inputTokens: {
        total: 10,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: behavior?.finalResponse?.length || 20,
        text: undefined,
        reasoning: undefined,
      },
    };

    return {
      content,
      finishReason,
      usage,
      warnings: [],
      request: {},
    };
  }

  async doStream(): Promise<LanguageModelV3StreamResult> {
    const behavior = await getMockBehavior();

    if (!behavior) {
      throw new Error(
        'Mock AI behavior not set. Set chrome.storage.local.__mock_ai_behavior__ first.'
      );
    }

    const delay = behavior.delay || 100;

    // Create a ReadableStream with mock chunks
    const chunks: LanguageModelV3StreamPart[] = [];

    // Add tool-call events
    for (const toolCall of behavior.toolCalls) {
      const toolCallId = `mock-${toolCall.toolName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Tool call input must be a JSON string
      const input = JSON.stringify(toolCall.args);

      chunks.push({
        type: 'tool-call',
        toolCallId,
        toolName: toolCall.toolName,
        input,
      });
    }

    // Add final text
    chunks.push({
      type: 'text-delta',
      delta: behavior.finalResponse,
      id: this.getId(),
    });

    // Convert chunks to ReadableStream with delays
    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
          // Add delay between chunks
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        controller.close();
      },
    });

    return {
      stream,
      request: {},
    };
  }
}

/**
 * Create a mock LanguageModel for testing
 *
 * Usage in E2E test:
 * ```javascript
 * await chrome.storage.local.set({
 *   '__mock_ai_behavior__': {
 *     toolCalls: [
 *       { toolName: 'listSources', args: { notebookId: 'abc123' } }
 *     ],
 *     finalResponse: 'I found 1 source.',
 *     delay: 100
 *   }
 * });
 * ```
 */
export function createMockModel(): LanguageModelV3 {
  return new MockLanguageModel('mock-test-model');
}

/**
 * Helper to set mock behavior from E2E tests
 */
export async function setMockBehavior(behavior: MockBehavior): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MOCK_BEHAVIOR_KEY]: behavior }, () => resolve());
  });
}

/**
 * Helper to clear mock behavior
 */
export async function clearMockBehavior(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([MOCK_BEHAVIOR_KEY], () => resolve());
  });
}

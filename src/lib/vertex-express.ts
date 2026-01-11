/**
 * Custom Vertex Express Provider
 *
 * Uses Vertex AI Express mode with API key authentication.
 * Transforms between AI SDK V3 messages and Vertex native format.
 *
 * API: https://aiplatform.googleapis.com/v1/{model}:generateContent
 * Docs: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3TextPart,
  LanguageModelV3Message,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';

interface VertexExpressSettings {
  apiKey: string;
}

// Vertex Express request/response types
interface VertexContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface VertexGenerateContentRequest {
  contents: VertexContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
  };
}

interface VertexGenerateContentResponse {
  candidates: Array<{
    content: VertexContent;
    finishReason: string;
    index: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// Type guards for AI SDK V3 content parts
function isTextPart(part: unknown): part is LanguageModelV3TextPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'text'
  );
}

function isStringContent(content: unknown): content is string {
  return typeof content === 'string';
}

function isArrayContent(content: unknown): content is unknown[] {
  return Array.isArray(content);
}

// Extract text from message content
function extractTextFromMessage(msg: LanguageModelV3Message): string {
  const content = msg.content;

  if (isStringContent(content)) {
    return content;
  }

  if (isArrayContent(content)) {
    return content
      .filter(isTextPart)
      .map((part) => part.text)
      .join('\n');
  }

  return '';
}

// Convert AI SDK V3 prompt to Vertex format
function convertPromptToVertexFormat(
  prompt: LanguageModelV3CallOptions['prompt']
): VertexContent[] {
  return prompt
    .map((msg) => {
      let role: string;

      // Map role
      if (msg.role === 'system') {
        // System messages aren't natively supported by Vertex, prepend to first user message
        return null;
      } else if (msg.role === 'assistant') {
        role = 'model';
      } else if (msg.role === 'tool') {
        // Tool messages - skip for now as we're not supporting tools yet
        return null;
      } else {
        role = 'user';
      }

      const text = extractTextFromMessage(msg);
      if (!text) return null;

      return { role, parts: [{ text }] };
    })
    .filter((msg): msg is VertexContent => msg !== null);
}

// Extract text from Vertex response
function extractTextFromResponse(
  candidate: VertexGenerateContentResponse['candidates'][0]
): string {
  return candidate.content.parts[0]?.text || '';
}

// Map Vertex finish reason to AI SDK format
function mapFinishReason(
  vertexFinishReason: string | undefined
): LanguageModelV3GenerateResult['finishReason'] {
  if (!vertexFinishReason) {
    return { unified: 'other', raw: undefined };
  }

  switch (vertexFinishReason) {
    case 'STOP':
      return { unified: 'stop', raw: vertexFinishReason };
    case 'MAX_TOKENS':
      return { unified: 'length', raw: vertexFinishReason };
    case 'SAFETY':
      return { unified: 'content-filter', raw: vertexFinishReason };
    case 'RECITATION':
    case 'OTHER':
      return { unified: 'other', raw: vertexFinishReason };
    default:
      return { unified: 'other', raw: vertexFinishReason };
  }
}

// Map Vertex usage to AI SDK format
function mapUsage(
  usage: VertexGenerateContentResponse['usageMetadata'] | undefined
): LanguageModelV3GenerateResult['usage'] {
  return {
    inputTokens: {
      total: usage?.promptTokenCount,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage?.candidatesTokenCount,
      text: undefined,
      reasoning: undefined,
    },
  };
}

/**
 * Vertex Express Language Model implementation
 */
export class VertexExpressLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'vertex-express' as const;

  // For URL support - Vertex doesn't support direct URL fetching
  readonly supportedUrls: Record<string, RegExp[]> = Object.freeze({});

  constructor(
    public readonly modelId: string,
    private readonly settings: VertexExpressSettings
  ) {}

  async doGenerate(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> {
    const { prompt, temperature, maxOutputTokens, headers } = options;

    // Vertex Express model IDs need publishers/ prefix for public models
    const vertexModelId = this.modelId.startsWith('publishers/')
      ? this.modelId
      : `publishers/google/models/${this.modelId}`;

    let vertexContents = convertPromptToVertexFormat(prompt);

    // Handle system message by prepending to first user message
    const systemMessage = prompt.find((msg) => msg.role === 'system');
    if (systemMessage && vertexContents.length > 0) {
      const systemText = extractTextFromMessage(systemMessage);
      if (systemText && vertexContents[0]?.role === 'user') {
        vertexContents = [
          {
            role: 'user',
            parts: [{ text: `${systemText}\n\n${vertexContents[0].parts[0].text}` }],
          },
          ...vertexContents.slice(1),
        ];
      }
    }

    const requestBody: VertexGenerateContentRequest = {
      contents: vertexContents,
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    };

    const response = await fetch(
      `https://aiplatform.googleapis.com/v1/${vertexModelId}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex Express API error ${response.status}: ${errorText}`);
    }

    const data: VertexGenerateContentResponse = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      throw new Error('No candidates in Vertex Express response');
    }

    const text = extractTextFromResponse(candidate);
    const usage = data.usageMetadata;

    return {
      content: [{ type: 'text', text }],
      finishReason: mapFinishReason(candidate.finishReason),
      usage: mapUsage(usage),
      warnings: [],
      request: {
        body: requestBody,
      },
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> {
    const { prompt, temperature, maxOutputTokens, headers } = options;

    const vertexModelId = this.modelId.startsWith('publishers/')
      ? this.modelId
      : `publishers/google/models/${this.modelId}`;

    let vertexContents = convertPromptToVertexFormat(prompt);

    // Handle system message by prepending to first user message
    const systemMessage = prompt.find((msg) => msg.role === 'system');
    if (systemMessage && vertexContents.length > 0) {
      const systemText = extractTextFromMessage(systemMessage);
      if (systemText && vertexContents[0]?.role === 'user') {
        vertexContents = [
          {
            role: 'user',
            parts: [{ text: `${systemText}\n\n${vertexContents[0].parts[0].text}` }],
          },
          ...vertexContents.slice(1),
        ];
      }
    }

    const requestBody: VertexGenerateContentRequest = {
      contents: vertexContents,
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    };

    const response = await fetch(
      `https://aiplatform.googleapis.com/v1/${vertexModelId}:streamGenerateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Vertex Express API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Track text ID for streaming
    const textId = crypto.randomUUID();

    // Transform Vertex SSE stream to AI SDK format
    const stream = response.body;
    const transformStream = new TransformStream<Uint8Array, LanguageModelV3StreamPart>({
      start(controller) {
        controller.enqueue({ type: 'text-delta', delta: '', id: textId });
      },
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk, { stream: true });
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              const textContent = data.candidates[0].content.parts[0].text;
              controller.enqueue({
                type: 'text-delta',
                delta: textContent,
                id: textId,
              });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      request: {
        body: requestBody,
      },
    };
  }
}

/**
 * Create a Vertex Express model instance
 *
 * Returns a LanguageModelV3 implementation which is assignable to LanguageModel
 * (LanguageModel = LanguageModelV3 | LanguageModelV2 | GlobalProviderModelId)
 */
export function createVertexExpress(
  modelId: string,
  settings: VertexExpressSettings
): LanguageModel {
  return new VertexExpressLanguageModel(modelId, settings);
}

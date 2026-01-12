import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'

export interface PodcastSegment {
  speaker: 'host' | 'guest'
  text: string
}

export async function generatePodcastScript(
  sources: Source[],
  lengthMinutes: number = 5,
): Promise<string> {
  const config = await getModelWithConfig()
  if (!config) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  const result = await generateText({
    model: config.model,
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
  })

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: config.modelConfigId,
      providerId: config.providerId,
      model: config.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch(err => console.warn('[Transform] Failed to track podcast-script usage:', err))
  }

  return result.text
}

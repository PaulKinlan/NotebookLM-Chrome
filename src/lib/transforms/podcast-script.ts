import { getModelWithConfig, generateTextWithImages, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { PodcastConfig } from '../../types/index.ts'
import { DEFAULT_PODCAST_CONFIG } from '../transform-config.ts'

export interface PodcastSegment {
  speaker: 'host' | 'guest'
  text: string
}

export async function generatePodcastScript(
  sources: Source[],
  config: Partial<PodcastConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_PODCAST_CONFIG, ...config }

  // Build speaker labels
  const speakerLabels = c.speakerNames?.length
    ? c.speakerNames.slice(0, c.speakerCount)
    : c.speakerCount === 3
      ? ['Host A', 'Host B', 'Host C']
      : ['Host A', 'Host B']

  // Tone descriptions
  const toneDescriptions: Record<typeof c.tone, string> = {
    casual: 'relaxed, friendly, and conversational with natural humor',
    professional: 'polished and articulate while remaining accessible',
    educational: 'clear and instructive, breaking down complex topics',
    entertaining: 'lively, engaging, and fun with good chemistry',
  }

  const systemPrompt = `You are a helpful AI assistant that creates engaging podcast scripts.
Write a natural conversation between ${c.speakerCount} hosts discussing the topics.
The tone should be ${toneDescriptions[c.tone]}.
The hosts should be curious, ask follow-up questions, and build on each other's points.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const focusNote = c.focusArea ? `\n\nFocus particularly on: ${c.focusArea}` : ''

  const textPrompt = `Create a ${c.lengthMinutes}-minute podcast script (approximately ${
    c.lengthMinutes * 150
  } words) based on these sources:

${buildSourceContextSimple(sources)}

Format as a dialogue between ${speakerLabels.join(' and ')}:
${speakerLabels[0]}: [Introduction and topic setup]
${speakerLabels[1]}: [Response and first point]
...continue the natural conversation...

Make it engaging and educational, covering the key points from the sources.${focusNote}`

  const result = await generateTextWithImages(modelConfig, systemPrompt, textPrompt, sources)

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: modelConfig.modelConfigId,
      providerId: modelConfig.providerId,
      model: modelConfig.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch(err => console.warn('[Transform] Failed to track podcast-script usage:', err))
  }

  return result.text
}

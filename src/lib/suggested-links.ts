/**
 * AI-powered link filtering and suggestion system
 */
import { getModelWithConfig, generateText } from './transforms/shared.ts';
import { trackUsage } from './usage.ts';
import type { Source, SuggestedLink, ExtractedLink } from '../types/index.ts';

/**
 * Collect all unique links from sources with deduplication
 */
function collectLinksFromSources(sources: Source[]): Array<ExtractedLink & { sourceId: string; sourceTitle: string }> {
  const seen = new Set<string>();
  const allLinks: Array<ExtractedLink & { sourceId: string; sourceTitle: string }> = [];

  for (const source of sources) {
    if (!source.links || source.links.length === 0) continue;

    for (const link of source.links) {
      // Skip duplicates
      if (seen.has(link.url)) continue;
      seen.add(link.url);

      // Skip links that are already sources
      const isAlreadySource = sources.some(s => s.url === link.url);
      if (isAlreadySource) continue;

      allLinks.push({
        ...link,
        sourceId: source.id,
        sourceTitle: source.title,
      });
    }
  }

  return allLinks;
}

/**
 * Build a compact link context for the AI to analyze
 */
function buildLinkContext(
  links: Array<ExtractedLink & { sourceId: string; sourceTitle: string }>,
  sources: Source[]
): string {
  // First, provide brief context about the notebook's content
  const sourceContext = sources
    .slice(0, 5)
    .map((s, i) => `${i + 1}. "${s.title}" - ${s.content.slice(0, 200)}...`)
    .join('\n');

  // Then list the links with their context
  const linkContext = links
    .map((link, i) =>
      `[${i}] URL: ${link.url}\n    Text: "${link.text}"\n    Context: ${link.context}\n    From: "${link.sourceTitle}"`
    )
    .join('\n\n');

  return `## Current Sources (for topic understanding):\n${sourceContext}\n\n## Links to Analyze:\n${linkContext}`;
}

/**
 * Parse AI response into structured suggestions
 */
function parseAIResponse(
  responseText: string,
  links: Array<ExtractedLink & { sourceId: string; sourceTitle: string }>
): SuggestedLink[] {
  try {
    // Try to find JSON array in the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[SuggestedLinks] No JSON array found in AI response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      title: string;
      description: string;
      relevanceScore: number;
    }>;

    return parsed
      .filter(item =>
        typeof item.index === 'number' &&
        item.index >= 0 &&
        item.index < links.length &&
        typeof item.relevanceScore === 'number' &&
        item.relevanceScore >= 0.5  // Only include reasonably relevant links
      )
      .map(item => {
        const link = links[item.index];
        return {
          url: link.url,
          title: item.title || link.text,
          description: item.description || '',
          relevanceScore: Math.min(1, Math.max(0, item.relevanceScore)),
          sourceId: link.sourceId,
          sourceTitle: link.sourceTitle,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.error('[SuggestedLinks] Failed to parse AI response:', error);
    return [];
  }
}

/**
 * Filter and rank links using AI
 */
export async function filterLinksWithAI(
  sources: Source[],
  maxLinks: number = 10
): Promise<SuggestedLink[]> {
  // Collect all links from sources
  const allLinks = collectLinksFromSources(sources);

  if (allLinks.length === 0) {
    return [];
  }

  // Limit links sent to AI to avoid token limits
  const linksToAnalyze = allLinks.slice(0, 50);

  const config = await getModelWithConfig();
  if (!config) {
    throw new Error(
      "AI provider not configured. Please add your API key in settings."
    );
  }

  const systemPrompt = `You are an expert at analyzing content and identifying valuable related resources.
Given a collection of sources (to understand the notebook's topic) and links extracted from those sources,
identify the most relevant links that would add value if the user added them as additional sources.

## Instructions:
1. Analyze each link's URL, anchor text, and surrounding context
2. Consider how relevant the link is to the notebook's overall topic
3. Filter out low-value links and keep only the most valuable ones

## EXCLUDE links that are:
- Privacy policies, terms of service, cookie notices
- Login/signup pages, account management
- Social media profiles (unless the notebook is specifically about that topic)
- Navigation links (home, about us, contact)
- Advertisement or sponsored content
- Generic "read more" or "click here" style links
- Internal site navigation that doesn't add substantive content

## INCLUDE links that are:
- Referenced as important sources or further reading
- Academic papers, research, or primary sources
- Detailed explanations of concepts mentioned in the sources
- Related tools, documentation, or authoritative resources
- News articles or reports that expand on the topic

## Response Format:
Return ONLY a JSON array with up to ${maxLinks} links, sorted by relevance (highest first):
[
  {
    "index": 0,
    "title": "Inferred or extracted title for the link",
    "description": "Brief explanation of why this link is relevant (1-2 sentences)",
    "relevanceScore": 0.9
  }
]

Score guidelines:
- 0.9-1.0: Highly relevant, directly expands on key topics
- 0.7-0.9: Relevant, provides useful additional context
- 0.5-0.7: Somewhat relevant, might be useful
- Below 0.5: Do not include`;

  const userPrompt = `Analyze these links and return the most relevant ones as JSON:\n\n${buildLinkContext(linksToAnalyze, sources)}`;

  const result = await generateText({
    model: config.model,
    system: systemPrompt,
    prompt: userPrompt,
  });

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: config.modelConfigId,
      providerId: config.providerId,
      model: config.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch((err) => console.warn('[SuggestedLinks] Failed to track usage:', err));
  }

  const suggestions = parseAIResponse(result.text, linksToAnalyze);
  return suggestions.slice(0, maxLinks);
}

/**
 * Check if sources have any extractable links
 */
export function hasExtractableLinks(sources: Source[]): boolean {
  return sources.some(source => source.links && source.links.length > 0);
}

/**
 * Get raw link count across all sources (for UI display)
 */
export function getRawLinkCount(sources: Source[]): number {
  const seen = new Set<string>();
  let count = 0;

  for (const source of sources) {
    if (!source.links) continue;
    for (const link of source.links) {
      if (!seen.has(link.url)) {
        seen.add(link.url);
        count++;
      }
    }
  }

  return count;
}

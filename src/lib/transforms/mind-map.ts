import { getModelWithConfig, generateText, buildSourceContextSimple, type Source } from './shared.ts'
import { trackUsage } from '../usage.ts'
import type { MindMapConfig } from '../../types/index.ts'
import { DEFAULT_MINDMAP_CONFIG } from '../transform-config.ts'

export async function generateMindMap(
  sources: Source[],
  config: Partial<MindMapConfig> = {},
): Promise<string> {
  const modelConfig = await getModelWithConfig()
  if (!modelConfig) {
    throw new Error(
      'AI provider not configured. Please add your API key in settings.',
    )
  }

  // Merge with defaults
  const c = { ...DEFAULT_MINDMAP_CONFIG, ...config }

  // Layout descriptions
  const layoutDesc: Record<typeof c.layout, string> = {
    radial: 'radiating outward from a central node with branches in all directions',
    tree: 'top-down hierarchical tree structure with clear parent-child relationships',
    organic: 'flowing, organic layout with natural clustering of related concepts',
  }

  const systemPrompt = `You are a helpful AI assistant that creates interactive visual mind maps as self-contained HTML/CSS/JS.
Create a ${layoutDesc[c.layout]} mind map with maximum ${c.maxDepth} levels of depth.
Each branch should have at most ${c.maxNodesPerBranch} child nodes.
Organize concepts visually to show relationships between ideas.

IMPORTANT: Generate ONLY valid HTML with embedded <style> and <script> tags. No markdown.
Do not include <!DOCTYPE>, <html>, <head>, or <body> tags - just the content div with styles and scripts.${
  c.customInstructions ? `\n\nAdditional instructions: ${c.customInstructions}` : ''
}`

  const result = await generateText({
    model: modelConfig.model,
    system: systemPrompt,
    prompt: `Create an interactive visual mind map based on these sources:

${buildSourceContextSimple(sources)}

Generate a self-contained HTML mind map with:
1. A central topic node prominently displayed
2. ${c.layout === 'radial' ? 'Main branches radiating from the center' : c.layout === 'tree' ? 'Main branches flowing down from the top' : 'Organically arranged main topic clusters'}
3. Up to ${c.maxDepth} levels of sub-branches
4. Maximum ${c.maxNodesPerBranch} items per branch
5. Clickable nodes that expand/collapse their children
6. Visual connections (lines) between related nodes
7. Color-coded branches for different main topics
8. Hover effects on nodes
9. Smooth expand/collapse animations
10. Clean, modern design with rounded nodes

Structure your response as:
<div class="mindmap-container">
  <!-- Mind map HTML structure - generate FIRST so you have context for CSS/JS -->
</div>
<style>
  /* CSS styles targeting the mind map structure above */
</style>
<script>
  // Interactive JavaScript for expand/collapse - reference elements from HTML above
</script>`,
  })

  // Track usage
  if (result.usage) {
    trackUsage({
      modelConfigId: modelConfig.modelConfigId,
      providerId: modelConfig.providerId,
      model: modelConfig.modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      operation: 'transform',
    }).catch(err => console.warn('[Transform] Failed to track mind-map usage:', err))
  }

  return result.text
}

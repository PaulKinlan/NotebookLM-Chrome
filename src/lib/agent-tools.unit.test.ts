/**
 * Unit tests for agent-tools module
 *
 * Tests the agent tool functions including:
 * - listSources: Get metadata for all sources in a notebook
 * - readSource: Get full content of a specific source
 * - findRelevantSources: Use LLM to rank sources by relevance
 * - Cache key generation and retrieval
 * - Error handling when sources are unavailable
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Source } from '../types/index.ts';

// Mock storage data
(globalThis as unknown as Record<string, unknown>).__mockSources = [] as Source[];
(globalThis as unknown as Record<string, unknown>).__mockToolCache = {} as Record<string, unknown>

// Helper to clear mocks
const clearMocks = () => {
  (globalThis as unknown as Record<string, unknown>).__mockSources = [];
  (globalThis as unknown as Record<string, unknown>).__mockToolCache = {}
}

// Mock the storage module
vi.mock('./storage.ts', () => ({
  getSourcesByNotebook: vi.fn((notebookId: string) => {
    const sources = (globalThis as unknown as Record<string, unknown>).__mockSources as Source[]
    return Promise.resolve(sources.filter(s => s.notebookId === notebookId))
  }),
  getSource: vi.fn((sourceId: string) => {
    const sources = (globalThis as unknown as Record<string, unknown>).__mockSources as Source[]
    return Promise.resolve(sources.find(s => s.id === sourceId) ?? null)
  }),
}))

// Mock the db module for caching
vi.mock('./db.ts', () => ({
  dbGet: vi.fn((store: string, key: string) => {
    const cache = (globalThis as unknown as Record<string, unknown>).__mockToolCache as Record<string, unknown>
    const cacheKey = `${store}:${key}`
    const value = cache[cacheKey]
    if (!value) return Promise.resolve(null)

    // Parse the cached value
    const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value
    return Promise.resolve({ key, value: parsed })
  }),
  dbPut: vi.fn((store: string, { key, value }: { key: string, value: unknown }) => {
    const cache = (globalThis as unknown as Record<string, unknown>).__mockToolCache as Record<string, unknown>
    const cacheKey = `${store}:${key}`
    cache[cacheKey] = JSON.stringify(value)
    return Promise.resolve(undefined)
  }),
  dbDelete: vi.fn((store: string, key: string) => {
    const cache = (globalThis as unknown as Record<string, unknown>).__mockToolCache as Record<string, unknown>
    const cacheKey = `${store}:${key}`
    delete cache[cacheKey]
    return Promise.resolve(undefined)
  }),
}))

// Mock the ai module
vi.mock('./ai.ts', () => ({
  rankSourceRelevance: vi.fn((sources: Source[], query: string) => {
    // Return mock ranked sources with varying relevance scores
    return Promise.resolve(sources.map((s, i) => ({
      ...s,
      relevanceScore: 1 - (i * 0.2), // Decreasing scores: 1.0, 0.8, 0.6, 0.4, 0.2
      relevanceReason: `Source ${i + 1} is ${i < 2 ? 'highly' : i < 4 ? 'somewhat' : 'less'} relevant to "${query}"`,
    })))
  }),
}))

// Type for the agent-tools module
type AgentToolsModule = typeof import('./agent-tools.ts')

describe('agent-tools', () => {
  let agentTools: AgentToolsModule

  const mockSources: Source[] = [
    {
      id: 'source-1',
      notebookId: 'notebook-1',
      title: 'Introduction to TypeScript',
      url: 'https://example.com/ts-intro',
      type: 'manual',
      content: 'TypeScript is a typed superset of JavaScript...',
      metadata: { wordCount: 150 },
      syncStatus: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'source-2',
      notebookId: 'notebook-1',
      title: 'Advanced TypeScript Patterns',
      url: 'https://example.com/ts-advanced',
      type: 'manual',
      content: 'Advanced TypeScript patterns include generics...',
      metadata: { wordCount: 300 },
      syncStatus: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'source-3',
      notebookId: 'notebook-1',
      title: 'JavaScript Best Practices',
      url: 'https://example.com/js-best',
      type: 'manual',
      content: 'JavaScript best practices include...',
      metadata: { wordCount: 200 },
      syncStatus: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'source-4',
      notebookId: 'notebook-1',
      title: 'Web Development Guide',
      url: 'https://example.com/web-dev',
      type: 'manual',
      content: 'Web development requires...',
      metadata: { wordCount: 400 },
      syncStatus: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'source-5',
      notebookId: 'notebook-2',
      title: 'Python Programming',
      url: 'https://example.com/python',
      type: 'manual',
      content: 'Python is a versatile language...',
      metadata: { wordCount: 250 },
      syncStatus: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]

  beforeEach(async () => {
    // Clear all mocks
    clearMocks()
    vi.clearAllMocks();

    // Set up mock sources
    (globalThis as Record<string, unknown>).__mockSources = [...mockSources]

    // Dynamic import to get fresh module with mocks applied
    agentTools = await import('./agent-tools.ts')
  })

  describe('listSources', () => {
    it('should return metadata for all sources in a notebook', async () => {
      const tool = agentTools.listSources
      const result = await (tool.execute as unknown as (args: { notebookId: string }) => Promise<{
        sources: Array<{ id: string, title: string, url: string, type: string, wordCount: number }>
        totalCount: number
      }>)({ notebookId: 'notebook-1' })

      expect(result.totalCount).toBe(4)
      expect(result.sources).toHaveLength(4)
      expect(result.sources[0]).toEqual({
        id: 'source-1',
        title: 'Introduction to TypeScript',
        url: 'https://example.com/ts-intro',
        type: 'manual',
        wordCount: 150,
      })
    })

    it('should return empty array for notebook with no sources', async () => {
      const tool = agentTools.listSources
      const result = await (tool.execute as unknown as (args: { notebookId: string }) => Promise<{
        sources: unknown[]
        totalCount: number
      }>)({ notebookId: 'notebook-nonexistent' })

      expect(result.totalCount).toBe(0)
      expect(result.sources).toHaveLength(0)
    })

    it('should include wordCount from metadata', async () => {
      const tool = agentTools.listSources
      const result = await (tool.execute as unknown as (args: { notebookId: string }) => Promise<{
        sources: Array<{ wordCount: number }>
        totalCount: number
      }>)({ notebookId: 'notebook-1' })

      expect(result.sources[0].wordCount).toBe(150)
      expect(result.sources[1].wordCount).toBe(300)
    })

    it('should default to 0 wordCount when metadata is missing', async () => {
      // Add a source without metadata
      const sourceWithoutMetadata: Source = {
        id: 'source-no-metadata',
        notebookId: 'notebook-1',
        title: 'No Metadata',
        url: 'https://example.com/no-meta',
        type: 'manual',
        content: 'Content without metadata',
        metadata: {},
        syncStatus: 'synced',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      (globalThis as Record<string, unknown>).__mockSources = [...mockSources, sourceWithoutMetadata]

      // Re-import to pick up new source
      agentTools = await import('./agent-tools.ts')

      const tool = agentTools.listSources
      const result = await (tool.execute as unknown as (args: { notebookId: string }) => Promise<{
        sources: Array<{ id: string, wordCount: number }>
        totalCount: number
      }>)({ notebookId: 'notebook-1' })

      const noMetaSource = result.sources.find(s => s.id === 'source-no-metadata')
      expect(noMetaSource?.wordCount).toBe(0)
    })
  })

  describe('readSource', () => {
    it('should return full content of a specific source', async () => {
      const tool = agentTools.readSource
      const execute = tool.execute as unknown as (args: { sourceId: string }) => Promise<{
        id: string
        title: string
        url: string
        type: string
        content: string
        metadata?: { wordCount?: number }
      }>
      const result = await execute({ sourceId: 'source-1' })

      expect(result.id).toBe('source-1')
      expect(result.title).toBe('Introduction to TypeScript')
      expect(result.content).toBe('TypeScript is a typed superset of JavaScript...')
      expect(result.metadata?.wordCount).toBe(150)
    })

    it('should throw error for non-existent source', async () => {
      const tool = agentTools.readSource
      const execute = tool.execute as unknown as (args: { sourceId: string }) => Promise<unknown>

      await expect(execute({ sourceId: 'source-nonexistent' }))
        .rejects.toThrow('Source source-nonexistent not found')
    })

    it('should include all metadata fields', async () => {
      const tool = agentTools.readSource
      const execute = tool.execute as unknown as (args: { sourceId: string }) => Promise<{
        metadata?: { wordCount: number }
      }>
      const result = await execute({ sourceId: 'source-2' })

      expect(result.metadata?.wordCount).toBe(300)
    })
  })

  describe('findRelevantSources', () => {
    it('should rank sources by relevance score', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        query: string
        totalMatches: number
        sources: Array<{ id: string, relevanceScore: number, relevanceReason: string }>
      }>
      const result = await execute({
        notebookId: 'notebook-1',
        query: 'TypeScript patterns',
        maxSources: 10,
        minScore: 0.0,
      })

      expect(result.query).toBe('TypeScript patterns')
      expect(result.totalMatches).toBe(4)
      expect(result.sources).toHaveLength(4)

      // Check that sources are ranked (mock returns decreasing scores)
      expect(result.sources[0].relevanceScore).toBeGreaterThan(result.sources[1].relevanceScore)
    })

    it('should filter sources by minScore threshold', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        totalMatches: number
        sources: Array<{ relevanceScore: number }>
      }>
      const result = await execute({
        notebookId: 'notebook-1',
        query: 'TypeScript',
        maxSources: 10,
        minScore: 0.7, // Only include sources with score >= 0.7
      })

      // Mock returns: 1.0, 0.8, 0.6, 0.4, 0.2
      // With minScore 0.7: only 1.0 and 0.8 should be included
      expect(result.totalMatches).toBe(2)
      expect(result.sources).toHaveLength(2)

      result.sources.forEach((source) => {
        expect(source.relevanceScore).toBeGreaterThanOrEqual(0.7)
      })
    })

    it('should limit results by maxSources', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        totalMatches: number
        sources: unknown[]
      }>
      const result = await execute({
        notebookId: 'notebook-1',
        query: 'development',
        maxSources: 2,
        minScore: 0.0,
      })

      expect(result.totalMatches).toBe(2)
      expect(result.sources).toHaveLength(2)
    })

    it('should include relevance reasons for each source', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        sources: Array<{ relevanceReason: string }>
      }>
      const result = await execute({
        notebookId: 'notebook-1',
        query: 'TypeScript',
        maxSources: 10,
        minScore: 0.0,
      })

      result.sources.forEach((source) => {
        expect(source.relevanceReason).toBeDefined()
        expect(typeof source.relevanceReason).toBe('string')
        expect(source.relevanceReason.length).toBeGreaterThan(0)
      })
    })

    it('should return empty result when no sources match', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        totalMatches: number
        sources: unknown[]
      }>
      const result = await execute({
        notebookId: 'notebook-nonexistent',
        query: 'anything',
        maxSources: 10,
        minScore: 0.0,
      })

      expect(result.totalMatches).toBe(0)
      expect(result.sources).toHaveLength(0)
    })

    it('should filter all sources when minScore is too high', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        totalMatches: number
        sources: Array<{ relevanceScore: number }>
      }>
      const result = await execute({
        notebookId: 'notebook-1',
        query: 'TypeScript',
        maxSources: 10,
        minScore: 0.95, // Only the first source (1.0) should match
      })

      // Mock returns: 1.0, 0.8, 0.6, 0.4
      // Only 1.0 is >= 0.95
      expect(result.totalMatches).toBe(1)
      expect(result.sources[0].relevanceScore).toBe(1.0)
    })
  })

  describe('cache key generation', () => {
    it('should generate consistent cache keys for identical inputs', async () => {
      // We can't directly test generateCacheKey as it's not exported
      // But we can test caching behavior by calling findRelevantSources twice

      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<unknown>

      const params = {
        notebookId: 'notebook-1',
        query: 'TypeScript',
        maxSources: 10,
        minScore: 0.5,
      }

      // First call
      const result1 = await execute(params)

      // Second call should return cached result
      const result2 = await execute(params)

      expect(result1).toEqual(result2)
    })

    it('should generate different cache keys for different parameters', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        totalMatches: number
      }>

      const result1 = await execute({
        notebookId: 'notebook-1',
        query: 'cache key test 1', // Unique query to avoid cache collision
        maxSources: 10,
        minScore: 0.5,
      })

      // First call with minScore 0.5 should return 3 sources (scores: 1.0, 0.8, 0.6)
      expect(result1.totalMatches).toBe(3)

      const result2 = await execute({
        notebookId: 'notebook-1',
        query: 'cache key test 1', // Same query
        maxSources: 5, // Different maxSources
        minScore: 0.5,
      })

      // Results should have different totalMatches due to different maxSources
      expect(result2.totalMatches).toBeLessThanOrEqual(5)
    })
  })

  describe('cache behavior', () => {
    it('should return cached result on subsequent calls', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        query: string
        totalMatches: number
      }>

      const params = {
        notebookId: 'notebook-1',
        query: 'cached query',
        maxSources: 10,
        minScore: 0.0,
      }

      // First call - should compute
      const result1 = await execute(params)

      // Second call - should use cache
      const result2 = await execute(params)

      expect(result1).toEqual(result2)

      // Verify the structure is preserved
      expect(result1.query).toBe('cached query')
      expect(result1.totalMatches).toBeGreaterThan(0)
    })

    it('should cache and retrieve listSources results', async () => {
      const tool = agentTools.listSources
      const execute = tool.execute as unknown as (args: { notebookId: string }) => Promise<{
        totalCount: number
      }>

      const params = { notebookId: 'notebook-1' }

      const result1 = await execute(params)
      const result2 = await execute(params)

      expect(result1).toEqual(result2)
      expect(result2.totalCount).toBe(4)
    })

    it('should cache and retrieve readSource results', async () => {
      const tool = agentTools.readSource
      const execute = tool.execute as unknown as (args: { sourceId: string }) => Promise<{
        id: string
      }>

      const params = { sourceId: 'source-1' }

      const result1 = await execute(params)
      const result2 = await execute(params)

      expect(result1).toEqual(result2)
      expect(result2.id).toBe('source-1')
    })
  })

  describe('error handling', () => {
    it('should handle missing notebook gracefully', async () => {
      const tool = agentTools.listSources
      const execute = tool.execute as unknown as (args: { notebookId: string }) => Promise<{
        totalCount: number
        sources: unknown[]
      }>

      const result = await execute({ notebookId: 'nonexistent-notebook' })

      expect(result.totalCount).toBe(0)
      expect(result.sources).toHaveLength(0)
    })

    it('should handle missing source with error', async () => {
      const tool = agentTools.readSource
      const execute = tool.execute as (args: { sourceId: string }) => Promise<unknown>

      await expect(execute({ sourceId: 'nonexistent-source' }))
        .rejects.toThrow('Source nonexistent-source not found')
    })

    it('should handle empty notebook in findRelevantSources', async () => {
      const tool = agentTools.findRelevantSources
      const execute = tool.execute as unknown as (args: {
        notebookId: string
        query: string
        maxSources: number
        minScore: number
      }) => Promise<{
        totalMatches: number
        sources: unknown[]
      }>

      const result = await execute({
        notebookId: 'empty-notebook',
        query: 'anything',
        maxSources: 10,
        minScore: 0.0,
      })

      expect(result.totalMatches).toBe(0)
      expect(result.sources).toHaveLength(0)
    })
  })

  describe('tool metadata', () => {
    it('should export listSources tool with description', () => {
      expect(agentTools.listSources).toBeDefined()
      expect(agentTools.listSources.description).toContain('Get metadata for all sources')
    })

    it('should export readSource tool with description', () => {
      expect(agentTools.readSource).toBeDefined()
      expect(agentTools.readSource.description).toContain('Get the full content')
    })

    it('should export findRelevantSources tool with description', () => {
      expect(agentTools.findRelevantSources).toBeDefined()
      expect(agentTools.findRelevantSources.description).toContain('Find sources relevant')
    })

    it('should export sourceTools registry', () => {
      expect(agentTools.sourceTools).toBeDefined()
      expect(agentTools.sourceTools.listSources).toBeDefined()
      expect(agentTools.sourceTools.readSource).toBeDefined()
      expect(agentTools.sourceTools.findRelevantSources).toBeDefined()

      // Verify tools are properly registered (without caching = same reference)
      expect(agentTools.sourceTools.listSources).toBe(agentTools.listSources)
      expect(agentTools.sourceTools.readSource).toBe(agentTools.readSource)

      // With caching, tool is wrapped but should still have same core properties
      expect(agentTools.sourceTools.findRelevantSources.description).toBe(agentTools.findRelevantSources.description)
    })

    // Note: TypeScript interfaces (SourceMetadata, SourceContent) are not
    // available at runtime, so we don't test for their existence
  })
})

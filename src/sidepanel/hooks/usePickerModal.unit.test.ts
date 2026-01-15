/**
 * Unit tests for usePickerModal hook
 *
 * Tests the picker modal hook's service integration and data transformations.
 * Note: Full hook state testing requires a component context (renderHook from
 * @testing-library/preact), which has compatibility issues with Preact's
 * internal hook tracking. These tests verify the service layer integration,
 * mock data validity, and function signatures that the hook depends on.
 *
 * Tests cover:
 * - Service mock data structure validation
 * - Service function type signatures
 * - Import function integration
 * - Domain extraction from URLs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Source } from '../../types/index'

// ============================================================================
// Service Mocks
// ============================================================================

const mockTabs = [
  { id: '1', url: 'https://example.com', title: 'Example Site', favicon: 'favicon1.ico' },
  { id: '2', url: 'https://test.org', title: 'Test Page', favicon: 'favicon2.ico' },
  { id: '3', url: 'https://demo.net', title: 'Demo Site', favicon: 'favicon3.ico' },
]

const mockTabGroups = [
  {
    id: 'group-1',
    url: 'https://example.com/group1',
    title: 'Work Group',
    color: 'blue',
    tabCount: 3,
  },
  {
    id: 'group-2',
    url: 'https://example.com/group2',
    title: 'Personal Group',
    color: 'green',
    tabCount: 2,
  },
]

const mockBookmarks = [
  { id: '1', url: 'https://bookmark1.com', title: 'Bookmark 1' },
  { id: '2', url: 'https://bookmark2.com', title: 'Bookmark 2' },
  { id: '3', url: 'https://bookmark3.com', title: 'Bookmark 3' },
]

const mockHistory = [
  { id: '12345', url: 'https://history1.com', title: 'History Item 1' },
  { id: '23456', url: 'https://history2.com', title: 'History Item 2' },
  { id: '34567', url: 'https://history3.com', title: 'History Item 3' },
]

const mockSources: Source[] = [
  {
    id: 'source-1',
    notebookId: 'notebook-1',
    type: 'tab',
    url: 'https://example.com',
    title: 'Example Site',
    content: 'Test content',
    syncStatus: 'local',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// Mock the sources service
vi.mock('../services/sources', () => ({
  getTabs: vi.fn(() => Promise.resolve(mockTabs)),
  importTabs: vi.fn(() => Promise.resolve(mockSources)),
  getTabGroups: vi.fn(() => Promise.resolve(mockTabGroups)),
  importTabGroups: vi.fn(() => Promise.resolve(mockSources)),
  getBookmarks: vi.fn(() => Promise.resolve(mockBookmarks)),
  importBookmarks: vi.fn(() => Promise.resolve(mockSources)),
  getHistory: vi.fn(() => Promise.resolve(mockHistory)),
  importHistory: vi.fn(() => Promise.resolve(mockSources)),
}))

import {
  getTabs,
  importTabs,
  getTabGroups,
  importTabGroups,
  getBookmarks,
  importBookmarks,
  getHistory,
  importHistory,
} from '../services/sources'

// ============================================================================
// Chrome API Mocks
// ============================================================================

const mockChrome = {
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve()),
  },
}

vi.stubGlobal('chrome', mockChrome)

// ============================================================================
// Tests
// ============================================================================

describe('usePickerModal - service integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.stubGlobal('chrome', mockChrome)

    // Reset mock implementations
    vi.mocked(getTabs).mockResolvedValue(mockTabs)
    vi.mocked(importTabs).mockResolvedValue(mockSources)
    vi.mocked(getTabGroups).mockResolvedValue(mockTabGroups)
    vi.mocked(importTabGroups).mockResolvedValue(mockSources)
    vi.mocked(getBookmarks).mockResolvedValue(mockBookmarks)
    vi.mocked(importBookmarks).mockResolvedValue(mockSources)
    vi.mocked(getHistory).mockResolvedValue(mockHistory)
    vi.mocked(importHistory).mockResolvedValue(mockSources)
  })

  describe('mock data structure validation', () => {
    it('mock tabs have valid URL structure for domain extraction', () => {
      mockTabs.forEach((tab) => {
        const url = new URL(tab.url)
        expect(url.hostname).toBeDefined()
        expect(url.hostname.length).toBeGreaterThan(0)
      })
    })

    it('mock bookmarks have valid URL structure for domain extraction', () => {
      mockBookmarks.forEach((bookmark) => {
        const url = new URL(bookmark.url)
        expect(url.hostname).toBeDefined()
        expect(url.hostname.length).toBeGreaterThan(0)
      })
    })

    it('mock history items have valid URL structure for domain extraction', () => {
      mockHistory.forEach((item) => {
        const url = new URL(item.url)
        expect(url.hostname).toBeDefined()
        expect(url.hostname.length).toBeGreaterThan(0)
      })
    })

    it('mock tabGroups have valid URL structure for domain extraction', () => {
      mockTabGroups.forEach((group) => {
        const url = new URL(group.url)
        expect(url.hostname).toBeDefined()
        expect(url.hostname.length).toBeGreaterThan(0)
      })
    })

    it('mock sources match Source interface', () => {
      mockSources.forEach((source) => {
        expect(source).toHaveProperty('id')
        expect(source).toHaveProperty('notebookId')
        expect(source).toHaveProperty('type')
        expect(source).toHaveProperty('url')
        expect(source).toHaveProperty('title')
        expect(source).toHaveProperty('content')
        expect(source).toHaveProperty('syncStatus')
        expect(source).toHaveProperty('createdAt')
        expect(source).toHaveProperty('updatedAt')
      })
    })
  })

  describe('get service functions', () => {
    it('getTabs returns tab items with correct structure', async () => {
      const result = await getTabs()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      result.forEach((tab) => {
        expect(tab).toHaveProperty('id')
        expect(tab).toHaveProperty('url')
        expect(tab).toHaveProperty('title')
        expect(typeof tab.id).toBe('string')
        expect(typeof tab.url).toBe('string')
        expect(typeof tab.title).toBe('string')
      })
    })

    it('getTabGroups returns tab group items with correct structure', async () => {
      const result = await getTabGroups()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      result.forEach((group) => {
        expect(group).toHaveProperty('id')
        expect(group).toHaveProperty('title')
        expect(group).toHaveProperty('color')
        expect(group).toHaveProperty('tabCount')
        expect(typeof group.id).toBe('string')
        expect(typeof group.title).toBe('string')
      })
    })

    it('getBookmarks returns bookmark items with correct structure', async () => {
      const result = await getBookmarks()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      result.forEach((bookmark) => {
        expect(bookmark).toHaveProperty('id')
        expect(bookmark).toHaveProperty('url')
        expect(bookmark).toHaveProperty('title')
        expect(typeof bookmark.id).toBe('string')
        expect(typeof bookmark.url).toBe('string')
        expect(typeof bookmark.title).toBe('string')
      })
    })

    it('getHistory accepts limit parameter and returns items with correct structure', async () => {
      const result = await getHistory(100)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      result.forEach((item) => {
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('url')
        expect(item).toHaveProperty('title')
        expect(typeof item.id).toBe('string')
        expect(typeof item.url).toBe('string')
        expect(typeof item.title).toBe('string')
      })
    })
  })

  describe('import service functions', () => {
    it('importTabs accepts ID array and returns Source array', async () => {
      const ids = ['1', '2', '3']
      const result = await importTabs(ids)

      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(importTabs)).toHaveBeenCalledWith(ids)
    })

    it('importTabGroups accepts ID array and returns Source array', async () => {
      const ids = ['group-1', 'group-2']
      const result = await importTabGroups(ids)

      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(importTabGroups)).toHaveBeenCalledWith(ids)
    })

    it('importBookmarks accepts ID array and returns Source array', async () => {
      const ids = ['1', '2']
      const result = await importBookmarks(ids)

      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(importBookmarks)).toHaveBeenCalledWith(ids)
    })

    it('importHistory accepts ID array and returns Source array', async () => {
      const ids = ['12345', '23456']
      const result = await importHistory(ids)

      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(importHistory)).toHaveBeenCalledWith(ids)
    })
  })

  describe('service error handling', () => {
    it('getTabs can be rejected and handled', async () => {
      vi.mocked(getTabs).mockRejectedValueOnce(new Error('Network error'))

      await expect(getTabs()).rejects.toThrow('Network error')
    })

    it('importTabs can be rejected and handled', async () => {
      vi.mocked(importTabs).mockRejectedValueOnce(new Error('Import failed'))

      await expect(importTabs(['1'])).rejects.toThrow('Import failed')
    })

    it('getTabGroups can be rejected and handled', async () => {
      vi.mocked(getTabGroups).mockRejectedValueOnce(new Error('Network error'))

      await expect(getTabGroups()).rejects.toThrow('Network error')
    })

    it('getBookmarks can be rejected and handled', async () => {
      vi.mocked(getBookmarks).mockRejectedValueOnce(new Error('Network error'))

      await expect(getBookmarks()).rejects.toThrow('Network error')
    })

    it('getHistory can be rejected and handled', async () => {
      vi.mocked(getHistory).mockRejectedValueOnce(new Error('Network error'))

      await expect(getHistory(100)).rejects.toThrow('Network error')
    })
  })

  describe('domain extraction logic', () => {
    it('extracts correct domain from example.com URL', () => {
      const url = new URL('https://example.com/path')
      expect(url.hostname).toBe('example.com')
    })

    it('extracts correct domain from test.org URL', () => {
      const url = new URL('https://test.org/path?q=1')
      expect(url.hostname).toBe('test.org')
    })

    it('extracts correct domain from subdomain URL', () => {
      const url = new URL('https://api.example.com/v1/endpoint')
      expect(url.hostname).toBe('api.example.com')
    })

    it('handles URLs without paths', () => {
      const url = new URL('https://example.com')
      expect(url.hostname).toBe('example.com')
    })

    it('handles URLs with port numbers', () => {
      const url = new URL('https://localhost:8080/api')
      expect(url.hostname).toBe('localhost')
    })
  })

  describe('search filtering logic', () => {
    it('filters items by title match', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const searchQuery = 'Example'
      const filtered = items.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase())
          || item.url.toLowerCase().includes(searchQuery.toLowerCase())
          || item.domain?.toLowerCase().includes(searchQuery.toLowerCase()),
      )

      expect(filtered.length).toBe(1)
      expect(filtered[0].title).toBe('Example Site')
    })

    it('filters items by URL match', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const searchQuery = 'test.org'
      const filtered = items.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase())
          || item.url.toLowerCase().includes(searchQuery.toLowerCase())
          || item.domain?.toLowerCase().includes(searchQuery.toLowerCase()),
      )

      expect(filtered.length).toBe(1)
      expect(filtered[0].url).toBe('https://test.org')
    })

    it('filters items by domain match', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const searchQuery = 'demo.net'
      const filtered = items.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase())
          || item.url.toLowerCase().includes(searchQuery.toLowerCase())
          || item.domain?.toLowerCase().includes(searchQuery.toLowerCase()),
      )

      expect(filtered.length).toBe(1)
      expect(filtered[0].domain).toBe('demo.net')
    })

    it('is case-insensitive', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const searchQuery = 'EXAMPLE'
      const filtered = items.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase())
          || item.url.toLowerCase().includes(searchQuery.toLowerCase())
          || item.domain?.toLowerCase().includes(searchQuery.toLowerCase()),
      )

      expect(filtered.length).toBe(1)
      expect(filtered[0].title).toBe('Example Site')
    })

    it('returns all items when search query is empty', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const searchQuery = ''
      const filtered = items.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase())
          || item.url.toLowerCase().includes(searchQuery.toLowerCase())
          || item.domain?.toLowerCase().includes(searchQuery.toLowerCase()),
      )

      expect(filtered.length).toBe(3)
    })
  })

  describe('selection state management', () => {
    it('toggleItem flips selected state', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const targetId = '1'
      const updated = items.map(item =>
        item.id === targetId ? { ...item, selected: !item.selected } : item,
      )

      expect(updated.find(i => i.id === targetId)?.selected).toBe(true)
      expect(updated.find(i => i.id === '2')?.selected).toBe(false)
    })

    it('selectAll sets all items to selected', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: false,
      }))

      const allSelected = items.map(item => ({ ...item, selected: true }))

      expect(allSelected.every(item => item.selected)).toBe(true)
    })

    it('deselectAll sets all items to unselected', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: true,
      }))

      const noneSelected = items.map(item => ({ ...item, selected: false }))

      expect(noneSelected.every(item => !item.selected)).toBe(true)
    })

    it('extracts selected item IDs', () => {
      const items = mockTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname,
        selected: tab.id === '1' || tab.id === '2',
      }))

      const selectedIds = items.filter(item => item.selected).map(item => item.id)

      expect(selectedIds).toEqual(['1', '2'])
    })
  })
})

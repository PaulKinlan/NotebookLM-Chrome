/**
 * Unit tests for sources service module
 *
 * Tests the source-related functions including:
 * - addNote: Add a user-created text note as a source
 * - addImage: Add an image as a source
 * - getImagesFromCurrentPage: Extract images from the current tab
 * - importImages: Import multiple images as sources
 * - extractFilenameFromUrl: Extract a human-readable filename from URL
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Source } from '../../types/index'
import type { ImageInfo } from './sources'

// Mock chrome API
const mockChromeTabsQuery = vi.fn()
const mockChromeScriptingExecuteScript = vi.fn()
const mockChromeRuntimeSendMessage = vi.fn()

// Set up global chrome mock
globalThis.chrome = {
  tabs: {
    query: mockChromeTabsQuery,
  },
  scripting: {
    executeScript: mockChromeScriptingExecuteScript,
  },
  runtime: {
    sendMessage: mockChromeRuntimeSendMessage,
  },
} as unknown as typeof chrome

// Mock notebook ID state
let mockNotebookId: string | null = 'notebook-123'

// Mock addSourceToNotebook returns
let mockSourceCounter = 0
const createMockSource = (type: Source['type'], url: string, title: string, content: string): Source => ({
  id: `source-${++mockSourceCounter}`,
  notebookId: mockNotebookId!,
  type,
  url,
  title,
  content,
  metadata: {},
  syncStatus: 'synced',
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

// Mock the notebooks service
vi.mock('./notebooks', () => ({
  getCurrentNotebookIdState: vi.fn(() => Promise.resolve(mockNotebookId)),
  addSourceToNotebook: vi.fn((_notebookId: string, type: Source['type'], url: string, title: string, content: string) => {
    return createMockSource(type, url, title, content)
  }),
}))

// Mock the storage service
const mockSaveSource = vi.fn(() => Promise.resolve())
vi.mock('../../lib/storage', () => ({
  saveSource: mockSaveSource,
}))

// Mock the permissions module (not needed for note/image functions but required by module)
vi.mock('../../lib/permissions', () => ({
  checkPermissions: vi.fn(() => Promise.resolve({
    tabs: true,
    tabGroups: true,
    bookmarks: true,
    history: true,
  })),
  requestPermission: vi.fn(() => Promise.resolve(true)),
}))

// Type for the sources module
type SourcesModule = typeof import('./sources')

describe('sources service - notes and images', () => {
  let sourcesModule: SourcesModule

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()
    mockSourceCounter = 0
    mockNotebookId = 'notebook-123'

    // Reset chrome mocks
    mockChromeTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com/page' }])
    mockChromeScriptingExecuteScript.mockResolvedValue([{ result: [] }])
    mockChromeRuntimeSendMessage.mockResolvedValue(undefined)

    // Dynamic import to get fresh module with mocks applied
    sourcesModule = await import('./sources')
  })

  describe('addNote', () => {
    it('should create a note source with title and content', async () => {
      const result = await sourcesModule.addNote('My Test Note', 'This is the note content.')

      expect(result).not.toBeNull()
      expect(result!.type).toBe('note')
      expect(result!.title).toBe('My Test Note')
      expect(result!.content).toBe('This is the note content.')
      expect(result!.url).toBe('')
    })

    it('should use "Untitled Note" when title is empty', async () => {
      const result = await sourcesModule.addNote('', 'Some content')

      expect(result).not.toBeNull()
      expect(result!.title).toBe('Untitled Note')
    })

    it('should save the source to storage', async () => {
      await sourcesModule.addNote('Test', 'Content')

      expect(mockSaveSource).toHaveBeenCalled()
    })

    it('should send SOURCE_ADDED message', async () => {
      await sourcesModule.addNote('Test', 'Content')

      expect(mockChromeRuntimeSendMessage).toHaveBeenCalledWith({ type: 'SOURCE_ADDED' })
    })

    it('should return null when no notebook is selected', async () => {
      mockNotebookId = null

      const result = await sourcesModule.addNote('Test', 'Content')

      expect(result).toBeNull()
    })
  })

  describe('addImage', () => {
    it('should create an image source with URL and title', async () => {
      const result = await sourcesModule.addImage(
        'https://example.com/image.png',
        'Test Image',
      )

      expect(result).not.toBeNull()
      expect(result!.type).toBe('image')
      expect(result!.url).toBe('https://example.com/image.png')
      expect(result!.title).toBe('Test Image')
    })

    it('should include alt text in content description', async () => {
      const result = await sourcesModule.addImage(
        'https://example.com/image.png',
        'Test Image',
        { altText: 'A beautiful sunset' },
      )

      expect(result).not.toBeNull()
      expect(result!.content).toContain('Description: A beautiful sunset')
    })

    it('should store image metadata', async () => {
      const result = await sourcesModule.addImage(
        'https://example.com/image.png',
        'Test Image',
        {
          altText: 'Test alt',
          dimensions: { width: 800, height: 600 },
          thumbnailDataUrl: 'data:image/png;base64,abc123',
          sourcePageUrl: 'https://example.com/page',
        },
      )

      expect(result).not.toBeNull()
      expect(result!.metadata).toEqual(expect.objectContaining({
        imageUrl: 'https://example.com/image.png',
        altText: 'Test alt',
        dimensions: { width: 800, height: 600 },
        thumbnailUrl: 'data:image/png;base64,abc123',
        sourcePageUrl: 'https://example.com/page',
      }))
    })

    it('should use "Untitled Image" when title is empty', async () => {
      const result = await sourcesModule.addImage('https://example.com/image.png', '')

      expect(result).not.toBeNull()
      expect(result!.title).toBe('Untitled Image')
    })

    it('should save the source to storage', async () => {
      await sourcesModule.addImage('https://example.com/image.png', 'Test')

      expect(mockSaveSource).toHaveBeenCalled()
    })

    it('should send SOURCE_ADDED message', async () => {
      await sourcesModule.addImage('https://example.com/image.png', 'Test')

      expect(mockChromeRuntimeSendMessage).toHaveBeenCalledWith({ type: 'SOURCE_ADDED' })
    })

    it('should return null when no notebook is selected', async () => {
      mockNotebookId = null

      const result = await sourcesModule.addImage('https://example.com/image.png', 'Test')

      expect(result).toBeNull()
    })
  })

  describe('getImagesFromCurrentPage', () => {
    it('should return images extracted from the active tab', async () => {
      const mockImages = [
        { src: 'https://example.com/img1.png', alt: 'Image 1', width: 800, height: 600 },
        { src: 'https://example.com/img2.jpg', alt: 'Image 2', width: 1024, height: 768 },
      ]
      mockChromeScriptingExecuteScript.mockResolvedValue([{ result: mockImages }])

      const result = await sourcesModule.getImagesFromCurrentPage()

      expect(result).toHaveLength(2)
      expect(result[0].src).toBe('https://example.com/img1.png')
      expect(result[1].src).toBe('https://example.com/img2.jpg')
    })

    it('should return empty array when no active tab', async () => {
      mockChromeTabsQuery.mockResolvedValue([])

      const result = await sourcesModule.getImagesFromCurrentPage()

      expect(result).toEqual([])
    })

    it('should return empty array when tab has no ID', async () => {
      mockChromeTabsQuery.mockResolvedValue([{ url: 'https://example.com' }])

      const result = await sourcesModule.getImagesFromCurrentPage()

      expect(result).toEqual([])
    })

    it('should return empty array when script execution fails', async () => {
      mockChromeScriptingExecuteScript.mockResolvedValue([{ result: null }])

      const result = await sourcesModule.getImagesFromCurrentPage()

      expect(result).toEqual([])
    })

    it('should call chrome.scripting.executeScript with correct target', async () => {
      mockChromeTabsQuery.mockResolvedValue([{ id: 42, url: 'https://example.com' }])
      mockChromeScriptingExecuteScript.mockResolvedValue([{ result: [] }])

      await sourcesModule.getImagesFromCurrentPage()

      expect(mockChromeScriptingExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 42 },
        }),
      )
    })
  })

  describe('importImages', () => {
    it('should import multiple images as sources', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/img1.png', alt: 'Image 1', width: 800, height: 600 },
        { src: 'https://example.com/img2.jpg', alt: 'Image 2', width: 1024, height: 768 },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('image')
      expect(result[1].type).toBe('image')
    })

    it('should include source page URL in image metadata', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/img.png', alt: 'Test', width: 800, height: 600 },
      ]
      mockChromeTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com/source-page' }])

      const result = await sourcesModule.importImages(images)

      expect(result[0].metadata?.sourcePageUrl).toBe('https://example.com/source-page')
    })

    it('should use alt text as title when available', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/img.png', alt: 'Beautiful sunset photo', width: 800, height: 600 },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result[0].title).toBe('Beautiful sunset photo')
    })

    it('should extract filename from URL when alt text is empty', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/my-cool-image.png', alt: '', width: 800, height: 600 },
      ]

      const result = await sourcesModule.importImages(images)

      // The extractFilenameFromUrl function removes extension and replaces dashes with spaces
      expect(result[0].title).toBe('my cool image')
    })

    it('should throw error when no notebook is selected', async () => {
      mockNotebookId = null

      const images: ImageInfo[] = [
        { src: 'https://example.com/img.png', alt: 'Test', width: 800, height: 600 },
      ]

      await expect(sourcesModule.importImages(images)).rejects.toThrow('No notebook selected')
    })

    it('should return empty array when given empty images array', async () => {
      const result = await sourcesModule.importImages([])

      expect(result).toEqual([])
    })

    it('should handle images with thumbnailDataUrl', async () => {
      const images: ImageInfo[] = [
        {
          src: 'https://example.com/img.png',
          alt: 'Test',
          width: 800,
          height: 600,
          thumbnailDataUrl: 'data:image/png;base64,abc123',
        },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result[0].metadata?.thumbnailUrl).toBe('data:image/png;base64,abc123')
    })

    it('should store dimensions in metadata', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/img.png', alt: 'Test', width: 1920, height: 1080 },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result[0].metadata?.dimensions).toEqual({ width: 1920, height: 1080 })
    })
  })

  describe('extractFilenameFromUrl (internal function)', () => {
    // Test indirectly through importImages
    it('should handle URLs with path segments', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/path/to/image-file.jpg', alt: '', width: 800, height: 600 },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result[0].title).toBe('image file')
    })

    it('should handle URLs with underscores', async () => {
      const images: ImageInfo[] = [
        { src: 'https://example.com/my_image_file.png', alt: '', width: 800, height: 600 },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result[0].title).toBe('my image file')
    })

    it('should fallback to "Image" for invalid URLs', async () => {
      const images: ImageInfo[] = [
        { src: 'not-a-valid-url', alt: '', width: 800, height: 600 },
      ]

      const result = await sourcesModule.importImages(images)

      expect(result[0].title).toBe('Image')
    })
  })

  describe('ImageInfo interface', () => {
    it('should accept optional thumbnailDataUrl', async () => {
      const imageWithThumbnail: ImageInfo = {
        src: 'https://example.com/img.png',
        alt: 'Test',
        width: 800,
        height: 600,
        thumbnailDataUrl: 'data:image/png;base64,xyz',
      }

      const imageWithoutThumbnail: ImageInfo = {
        src: 'https://example.com/img2.png',
        alt: 'Test 2',
        width: 640,
        height: 480,
      }

      const result = await sourcesModule.importImages([imageWithThumbnail, imageWithoutThumbnail])

      expect(result).toHaveLength(2)
      expect(result[0].metadata?.thumbnailUrl).toBe('data:image/png;base64,xyz')
      expect(result[1].metadata?.thumbnailUrl).toBeUndefined()
    })
  })
})

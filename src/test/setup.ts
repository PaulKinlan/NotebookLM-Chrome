/**
 * Vitest Test Setup
 *
 * Configures global mocks for Chrome extension APIs.
 * Uses simple custom mocks instead of sinon-chrome (deprecated since 2018).
 * Uses fake-indexeddb for IndexedDB mocking.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Event mock for Chrome events
class ChromeEvent {
  private listeners: Array<(...args: unknown[]) => void> = []

  addListener = vi.fn((callback: (...args: unknown[]) => void) => {
    this.listeners.push(callback)
  })

  removeListener = vi.fn((callback: (...args: unknown[]) => void) => {
    const index = this.listeners.indexOf(callback)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  })

  hasListener = vi.fn((callback: (...args: unknown[]) => void) => {
    return this.listeners.includes(callback)
  })

  dispatch = vi.fn((...args: unknown[]) => {
    this.listeners.forEach(listener => listener(...args))
  })
}

// Storage area mock
class StorageArea {
  data: Record<string, unknown> = {}

  get = vi.fn(
    (keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> => {
      return Promise.resolve(this.filterData(keys))
    },
  )

  set = vi.fn(async (items: Record<string, unknown>): Promise<void> => {
    Object.assign(this.data, items)
  })

  clear = vi.fn(async (): Promise<void> => {
    this.data = {}
  })

  remove = vi.fn(async (keys: string | string[]): Promise<void> => {
    const keysToRemove = Array.isArray(keys) ? keys : [keys]
    keysToRemove.forEach(key => delete this.data[key])
  })

  getBytesInUse = vi.fn(
    (): Promise<number> => {
      return Promise.resolve(0)
    },
  )

  private filterData(
    keys: string | string[] | Record<string, unknown> | null,
  ): Record<string, unknown> {
    if (keys === null) {
      return { ...this.data }
    }
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] }
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {}
      keys.forEach((key) => {
        if (key in this.data) {
          result[key] = this.data[key]
        }
      })
      return result
    }
    // If keys is an object, return those specific keys
    const result: Record<string, unknown> = {}
    Object.keys(keys).forEach((key) => {
      if (key in this.data) {
        result[key] = this.data[key]
      }
    })
    return result
  }

  // Helper for tests to directly inspect/manipulate storage
  _getData = () => this.data
  _setData = (newData: Record<string, unknown>) => {
    this.data = newData
  }
}

// Create Chrome API mock
const createChromeMock = () => ({
  // Storage API
  storage: {
    local: new StorageArea(),
    sync: new StorageArea(),
    managed: new StorageArea(),
    onChanged: new ChromeEvent(),
  },

  // Runtime API
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
    getManifest: vi.fn(() => ({
      name: 'FolioLM',
      version: '0.1.0',
      manifest_version: 3,
    })),
    sendMessage: vi.fn(),
    onMessage: new ChromeEvent(),
    onConnect: new ChromeEvent(),
    onInstalled: new ChromeEvent(),
  },

  // Tabs API
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    onActivated: new ChromeEvent(),
    onUpdated: new ChromeEvent(),
    onRemoved: new ChromeEvent(),
  },

  // Bookmarks API
  bookmarks: {
    getTree: vi.fn(),
    search: vi.fn(),
    get: vi.fn(),
    onCreated: new ChromeEvent(),
    onRemoved: new ChromeEvent(),
    onChanged: new ChromeEvent(),
  },

  // History API
  history: {
    search: vi.fn(),
    addUrl: vi.fn(),
    onVisited: new ChromeEvent(),
    onVisitRemoved: new ChromeEvent(),
  },

  // Side Panel API
  sidePanel: {
    getOptions: vi.fn(),
    setOptions: vi.fn(),
  },

  // Permissions API
  permissions: {
    request: vi.fn(),
    contains: vi.fn(),
    getAll: vi.fn(),
    onAdded: new ChromeEvent(),
    onRemoved: new ChromeEvent(),
  },
})

export type ChromeMock = ReturnType<typeof createChromeMock>

// Extend global scope with chrome and browser
declare global {
  namespace NodeJS {
    interface Global {
      chrome: ChromeMock
      browser: ChromeMock
    }
  }
}

// Mock Chrome and browser APIs globally
const chromeMock = createChromeMock();

// Extend global scope with test-specific chrome mock
// Cast to unknown to allow setting properties that aren't in the official Chrome types
(globalThis as unknown as { chrome: typeof chromeMock, browser: typeof chromeMock }).chrome = chromeMock;
(globalThis as unknown as { chrome: typeof chromeMock, browser: typeof chromeMock }).browser = chromeMock

// Store names in the database (matching db.ts schema)
const DB_STORES = ['notebooks', 'sources', 'chatMessages', 'chatEvents', 'transformations', 'settings', 'responseCache', 'summaries', 'providerConfigs', 'toolResults', 'approvalRequests'] as const
const DB_NAME = 'notebooklm-chrome'
const DB_VERSION = 6

// Global reference to the test database for clearing
let testDB: IDBDatabase | null = null

// Initialize database once before all tests
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    // Manually create the database schema (matching db.ts)
    request.onupgradeneeded = () => {
      const db = request.result

      // Notebooks store
      if (!db.objectStoreNames.contains('notebooks')) {
        const notebooksStore = db.createObjectStore('notebooks', { keyPath: 'id' })
        notebooksStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        notebooksStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      // Sources store
      if (!db.objectStoreNames.contains('sources')) {
        const sourcesStore = db.createObjectStore('sources', { keyPath: 'id' })
        sourcesStore.createIndex('notebookId', 'notebookId', { unique: false })
        sourcesStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        sourcesStore.createIndex('type', 'type', { unique: false })
      }

      // Chat messages store
      if (!db.objectStoreNames.contains('chatMessages')) {
        const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id' })
        chatStore.createIndex('notebookId', 'notebookId', { unique: false })
        chatStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Chat events store (new - replaces chatMessages)
      if (!db.objectStoreNames.contains('chatEvents')) {
        const chatEventsStore = db.createObjectStore('chatEvents', { keyPath: 'id' })
        chatEventsStore.createIndex('notebookId', 'notebookId', { unique: false })
        chatEventsStore.createIndex('timestamp', 'timestamp', { unique: false })
        chatEventsStore.createIndex('type', 'type', { unique: false })
      }

      // Transformations store
      if (!db.objectStoreNames.contains('transformations')) {
        const transformStore = db.createObjectStore('transformations', { keyPath: 'id' })
        transformStore.createIndex('notebookId', 'notebookId', { unique: false })
        transformStore.createIndex('type', 'type', { unique: false })
      }

      // Settings store (key-value)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }

      // Response cache store
      if (!db.objectStoreNames.contains('responseCache')) {
        const cacheStore = db.createObjectStore('responseCache', { keyPath: 'id' })
        cacheStore.createIndex('notebookId', 'notebookId', { unique: false })
        cacheStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Summaries store
      if (!db.objectStoreNames.contains('summaries')) {
        const summariesStore = db.createObjectStore('summaries', { keyPath: 'id' })
        summariesStore.createIndex('notebookId', 'notebookId', { unique: true })
      }

      // Provider configurations store
      if (!db.objectStoreNames.contains('providerConfigs')) {
        const configsStore = db.createObjectStore('providerConfigs', { keyPath: 'id' })
        configsStore.createIndex('isDefault', 'isDefault', { unique: false })
        configsStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Tool results cache (for agentic mode)
      if (!db.objectStoreNames.contains('toolResults')) {
        const toolsStore = db.createObjectStore('toolResults', { keyPath: 'key' })
        toolsStore.createIndex('expiresAt', 'expiresAt', { unique: false })
      }

      // Approval requests (for tool requiring user approval)
      if (!db.objectStoreNames.contains('approvalRequests')) {
        const approvalStore = db.createObjectStore('approvalRequests', { keyPath: 'key' })
        approvalStore.createIndex('status', 'status', { unique: false })
      }
    }

    request.onsuccess = () => {
      testDB = request.result
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
})

// Clean up after all tests
afterAll(async () => {
  if (testDB) {
    testDB.close()
    testDB = null
  }
})

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()

  // Reset chrome.storage mock data
  const chrome = globalThis.chrome
  if (chrome?.storage?.local && '_setData' in chrome.storage.local) {
    (chrome.storage.local as unknown as { _setData: (data: unknown) => void })._setData({})
  }
  if (chrome?.storage?.sync && '_setData' in chrome.storage.sync) {
    (chrome.storage.sync as unknown as { _setData: (data: unknown) => void })._setData({})
  }
})

// Clear IndexedDB stores after each test
afterEach(async () => {
  if (!testDB) return

  const tx = testDB.transaction(DB_STORES, 'readwrite')

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)

    // Clear each store that exists
    for (const storeName of DB_STORES) {
      if (testDB?.objectStoreNames.contains(storeName)) {
        const store = tx.objectStore(storeName)
        store.clear()
      }
    }
  })
})

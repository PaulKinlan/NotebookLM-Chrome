const DB_NAME = 'notebooklm-chrome'
const DB_VERSION = 6

export interface DBSchema {
  notebooks: {
    key: string
    indexes: {
      syncStatus: string
      updatedAt: number
    }
  }
  sources: {
    key: string
    indexes: {
      notebookId: string
      syncStatus: string
      type: string
    }
  }
  chatEvents: {
    key: string
    indexes: {
      notebookId: string
      timestamp: number
      type: string
    }
  }
  transformations: {
    key: string
    indexes: {
      notebookId: string
      type: string
    }
  }
  settings: {
    key: string
  }
  responseCache: {
    key: string
    indexes: {
      notebookId: string
      createdAt: number
    }
  }
  summaries: {
    key: string
    indexes: {
      notebookId: string
    }
  }
  providerConfigs: {
    key: string
    indexes: {
      isDefault: boolean
      createdAt: number
    }
  }
  toolResults: {
    key: string
    indexes: {
      expiresAt: number
    }
  }
  approvalRequests: {
    key: string
    indexes: {
      status: string
    }
  }
  // @deprecated Kept for migration from v5
  chatMessages: {
    key: string
    indexes: {
      notebookId: string
      timestamp: number
    }
  }
}

/**
 * ChatMessage type from v5 schema (deprecated)
 */
interface ChatMessage {
  id: string
  notebookId: string
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
  timestamp: number
}

/**
 * ChatEvent type for v6 schema
 */
interface ChatEvent {
  id: string
  notebookId: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
  citations?: string[]
}

/**
 * Migration helper: Convert ChatMessage (v5) to ChatEvent (v6)
 * ChatMessage { id, notebookId, role: 'user' | 'assistant', content, citations?, timestamp }
 *   → UserEvent { id, notebookId, type: 'user', content, timestamp }
 *   → AssistantEvent { id, notebookId, type: 'assistant', content, citations?, timestamp }
 *
 * NOTE: This function must be called from within onupgradeneeded and uses
 * the implicit version change transaction passed as a parameter.
 */
function migrateChatMessagesToChatEvents(transaction: IDBTransaction): void {
  const db = transaction.db
  if (!db.objectStoreNames.contains('chatMessages') || !db.objectStoreNames.contains('chatEvents')) {
    console.log('[DB Migration] chatMessages or chatEvents store missing, skipping migration')
    return
  }

  const oldStore = transaction.objectStore('chatMessages')
  const newStore = transaction.objectStore('chatEvents')

  const request = oldStore.openCursor()
  let migratedCount = 0

  request.onsuccess = () => {
    const cursor = request.result
    if (cursor) {
      const msg = cursor.value as ChatMessage
      // Convert ChatMessage to ChatEvent
      const chatEvent: ChatEvent = {
        id: msg.id,
        notebookId: msg.notebookId,
        timestamp: msg.timestamp,
        type: msg.role, // 'user' or 'assistant'
        content: msg.content,
        ...(msg.citations && { citations: msg.citations }),
      }
      newStore.put(chatEvent)
      migratedCount++
      cursor.continue()
    }
    else {
      console.log(`[DB Migration] Migrated ${migratedCount} chatMessages to chatEvents`)
    }
  }

  request.onerror = () => {
    console.error('[DB Migration] Error migrating chatMessages:', request.error)
  }
}

let dbInstance: IDBDatabase | null = null

export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open database'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const request = event.target
      if (!request || !(request instanceof IDBOpenDBRequest)) {
        throw new Error('Invalid upgrade request')
      }
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

      // Chat messages store (deprecated - replaced by chatEvents)
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

      // Migration: v5 → v6 (chatMessages → chatEvents)
      if (event.oldVersion < 6 && db.objectStoreNames.contains('chatMessages')) {
        // Get the transaction from the event (implicit version change transaction)
        const request = event.target
        if (request && request instanceof IDBOpenDBRequest && request.transaction) {
          migrateChatMessagesToChatEvents(request.transaction)
        }
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

      // Response cache store (for offline support)
      if (!db.objectStoreNames.contains('responseCache')) {
        const cacheStore = db.createObjectStore('responseCache', { keyPath: 'id' })
        cacheStore.createIndex('notebookId', 'notebookId', { unique: false })
        cacheStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Summaries store (cached notebook overviews)
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
  })
}

// Generic CRUD operations

export async function dbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onerror = () => reject(new Error(`Failed to get ${key} from ${storeName}`))
    request.onsuccess = () => resolve((request.result as T) ?? null)
  })
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`))
    request.onsuccess = () => resolve(request.result as T[])
  })
}

export async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)

    request.onerror = () => reject(new Error(`Failed to query ${storeName} by ${indexName}`))
    request.onsuccess = () => resolve(request.result as T[])
  })
}

export async function dbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(value)

    request.onerror = () => reject(new Error(`Failed to put into ${storeName}`))
    request.onsuccess = () => resolve()
  })
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onerror = () => reject(new Error(`Failed to delete ${key} from ${storeName}`))
    request.onsuccess = () => resolve()
  })
}

export async function dbDeleteByIndex(
  storeName: string,
  indexName: string,
  value: IDBValidKey,
): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.openCursor(value)

    request.onerror = () => reject(new Error(`Failed to delete from ${storeName} by ${indexName}`))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
      else {
        resolve()
      }
    }
  })
}

export async function dbCountByIndex(
  storeName: string,
  indexName: string,
  value: IDBValidKey,
): Promise<number> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.count(value)

    request.onerror = () => reject(new Error(`Failed to count ${storeName} by ${indexName}`))
    request.onsuccess = () => resolve(request.result)
  })
}

export async function dbClear(storeName: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onerror = () => reject(new Error(`Failed to clear ${storeName}`))
    request.onsuccess = () => resolve()
  })
}

/**
 * Clear all data from the database
 */
export async function dbClearAll(): Promise<void> {
  const db = await getDB()
  const storeNames = ['notebooks', 'sources', 'chatEvents', 'transformations', 'responseCache', 'settings', 'providerConfigs', 'toolResults', 'approvalRequests']

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, 'readwrite')

    transaction.onerror = () => reject(new Error('Failed to clear database'))

    transaction.oncomplete = () => resolve()

    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName)
      store.clear()
    }
  })
}

const DB_NAME = 'notebooklm-chrome';
const DB_VERSION = 2;

export interface DBSchema {
  notebooks: {
    key: string;
    indexes: {
      syncStatus: string;
      updatedAt: number;
    };
  };
  sources: {
    key: string;
    indexes: {
      notebookId: string;
      syncStatus: string;
      type: string;
    };
  };
  chatMessages: {
    key: string;
    indexes: {
      notebookId: string;
      timestamp: number;
    };
  };
  transformations: {
    key: string;
    indexes: {
      notebookId: string;
      type: string;
    };
  };
  settings: {
    key: string;
  };
  responseCache: {
    key: string;
    indexes: {
      notebookId: string;
      createdAt: number;
    };
  };
}

let dbInstance: IDBDatabase | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Notebooks store
      if (!db.objectStoreNames.contains('notebooks')) {
        const notebooksStore = db.createObjectStore('notebooks', { keyPath: 'id' });
        notebooksStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        notebooksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Sources store
      if (!db.objectStoreNames.contains('sources')) {
        const sourcesStore = db.createObjectStore('sources', { keyPath: 'id' });
        sourcesStore.createIndex('notebookId', 'notebookId', { unique: false });
        sourcesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        sourcesStore.createIndex('type', 'type', { unique: false });
      }

      // Chat messages store
      if (!db.objectStoreNames.contains('chatMessages')) {
        const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id' });
        chatStore.createIndex('notebookId', 'notebookId', { unique: false });
        chatStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Transformations store
      if (!db.objectStoreNames.contains('transformations')) {
        const transformStore = db.createObjectStore('transformations', { keyPath: 'id' });
        transformStore.createIndex('notebookId', 'notebookId', { unique: false });
        transformStore.createIndex('type', 'type', { unique: false });
      }

      // Settings store (key-value)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Response cache store (for offline support)
      if (!db.objectStoreNames.contains('responseCache')) {
        const cacheStore = db.createObjectStore('responseCache', { keyPath: 'id' });
        cacheStore.createIndex('notebookId', 'notebookId', { unique: false });
        cacheStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// Generic CRUD operations

export async function dbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(new Error(`Failed to get ${key} from ${storeName}`));
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onerror = () => reject(new Error(`Failed to query ${storeName} by ${indexName}`));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function dbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onerror = () => reject(new Error(`Failed to put into ${storeName}`));
    request.onsuccess = () => resolve();
  });
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(new Error(`Failed to delete ${key} from ${storeName}`));
    request.onsuccess = () => resolve();
  });
}

export async function dbDeleteByIndex(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.openCursor(value);

    request.onerror = () => reject(new Error(`Failed to delete from ${storeName} by ${indexName}`));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
}

export async function dbClear(storeName: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    request.onsuccess = () => resolve();
  });
}

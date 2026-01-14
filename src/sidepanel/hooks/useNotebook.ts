/**
 * useNotebook Hook
 *
 * Manages notebook selection and loading state.
 * Reduces duplicate notebook management code in controllers.ts.
 */

import { useState, useCallback, useEffect, useRef } from 'preact/hooks'
import type { Notebook } from '../../types/index.ts'
import {
  getNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
  saveNotebook,
  deleteNotebook as deleteNb,
  createNotebook as createNb,
} from '../../lib/storage.ts'

export interface UseNotebookReturn {
  /** Current selected notebook ID */
  currentNotebookId: string | null
  /** All available notebooks */
  notebooks: Notebook[]
  /** Loading state for notebooks */
  isLoading: boolean
  /** Select a notebook by ID */
  selectNotebook: (id: string) => Promise<void>
  /** Create a new notebook */
  createNotebook: (name: string) => Promise<Notebook | null>
  /** Delete a notebook */
  deleteNotebook: (id: string) => Promise<void>
  /** Reload notebooks list */
  reloadNotebooks: () => Promise<void>
  /** Set current notebook ID directly */
  setCurrentNotebookId: (id: string | null) => void
}

/**
 * Hook for managing notebook state
 *
 * @example
 * ```tsx
 * function NotebookSelector() {
 *   const { currentNotebookId, notebooks, selectNotebook, isLoading } = useNotebook()
 *
 *   return (
 *     <select onChange={(e) => selectNotebook(e.target.value)}>
 *       {notebooks.map(nb => (
 *         <option key={nb.id} value={nb.id}>{nb.name}</option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 */
export function useNotebook(): UseNotebookReturn {
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(null)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Track if we've loaded from storage to prevent overwriting manually set state
  const loadedFromStorage = useRef(false)

  // Load notebooks on mount
  useEffect(() => {
    void loadNotebooks()
    void loadActiveNotebook()
  }, [])

  const loadNotebooks = useCallback(async () => {
    setIsLoading(true)
    try {
      const loaded = await getNotebooks()
      setNotebooks(loaded)
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  const loadActiveNotebook = useCallback(async () => {
    // Only load from storage if we haven't manually set a notebook ID yet
    // This prevents overwriting a newly created/selected notebook with stale storage data
    if (!loadedFromStorage.current) {
      const activeId = await getActiveNotebookId()
      if (activeId) {
        setCurrentNotebookId(activeId)
      }
      loadedFromStorage.current = true
    }
  }, [])

  const selectNotebook = async (id: string): Promise<void> => {
    console.log('[useNotebook] selectNotebook called with id:', id)
    // Update active notebook
    await setActiveNotebookId(id)
    console.log('[useNotebook] About to call setCurrentNotebookId with:', id, 'type of setCurrentNotebookId:', typeof setCurrentNotebookId)
    setCurrentNotebookId(id)
    console.log('[useNotebook] currentNotebookId set to:', id)

    // Reload notebooks to get latest data
    const loaded = await getNotebooks()
    console.log('[useNotebook] About to call setNotebooks with', loaded.length, 'notebooks, type of setNotebooks:', typeof setNotebooks)
    setNotebooks(loaded)
    console.log('[useNotebook] notebooks reloaded, count:', loaded.length)
  }

  const createNotebook = async (name: string): Promise<Notebook | null> => {
    console.log('[useNotebook] createNotebook called with name:', name)
    const newNotebook = createNb(name)
    console.log('[useNotebook] created notebook object with id:', newNotebook.id)

    // Save the new notebook
    await saveNotebook(newNotebook)
    console.log('[useNotebook] saved notebook to storage')

    // Reload notebooks list
    const loaded = await getNotebooks()
    setNotebooks(loaded)
    console.log('[useNotebook] notebooks reloaded, count:', loaded.length)
    return newNotebook
  }

  const deleteNotebook = async (id: string): Promise<void> => {
    await deleteNb(id)

    // If we deleted the active notebook, clear it
    const activeId = await getActiveNotebookId()
    if (activeId === id) {
      setCurrentNotebookId(null)
    }

    // Reload notebooks
    const loaded = await getNotebooks()
    setNotebooks(loaded)
  }

  const reloadNotebooks = async (): Promise<void> => {
    await loadNotebooks()
    await loadActiveNotebook()
  }

  return {
    currentNotebookId,
    notebooks,
    isLoading,
    selectNotebook,
    createNotebook,
    deleteNotebook,
    reloadNotebooks,
    setCurrentNotebookId,
  }
}

/**
 * useNotebook Hook
 *
 * Manages notebook selection and loading state.
 * Reduces duplicate notebook management code in controllers.ts.
 */

import { useState, useCallback, useEffect } from '../../jsx-runtime/hooks/index.ts'
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
    const activeId = await getActiveNotebookId()
    setCurrentNotebookId(activeId)
  }, [])

  const selectNotebook = async (id: string): Promise<void> => {
    // Update active notebook
    await setActiveNotebookId(id)
    setCurrentNotebookId(id)

    // Reload notebooks to get latest data
    const loaded = await getNotebooks()
    setNotebooks(loaded)
  }

  const createNotebook = async (name: string): Promise<Notebook | null> => {
    const newNotebook = createNb(name)

    // Save the new notebook
    await saveNotebook(newNotebook)

    // Reload notebooks list
    const loaded = await getNotebooks()
    setNotebooks(loaded)
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

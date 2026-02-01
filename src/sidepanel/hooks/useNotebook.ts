/**
 * useNotebook Hook
 *
 * Manages notebook selection and loading state using Preact signals.
 * The signals are stored globally in the store, this hook provides
 * the operations interface.
 */

import { useCallback, useEffect } from 'preact/hooks'
import type { Notebook } from '../../types/index.ts'
import {
  currentNotebookId,
  notebooks,
  notebooksLoading,
  sourceCountsByNotebook,
} from '../store'
import {
  getNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
  saveNotebook,
  deleteNotebook as deleteNb,
  createNotebook as createNb,
  getSourceCountByNotebook,
  getNotebook,
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
  createNotebook: (name: string) => Promise<Notebook>
  /** Delete a notebook */
  deleteNotebook: (id: string) => Promise<void>
  /** Rename a notebook */
  renameNotebook: (id: string, name: string) => Promise<void>
  /** Reload notebooks list */
  reloadNotebooks: () => Promise<void>
}

/**
 * Hook for managing notebook state using signals
 */
export function useNotebook(): UseNotebookReturn {
  // Load notebooks and active notebook on mount
  useEffect(() => {
    void loadNotebooks()
    void loadActiveNotebook()
  }, [])

  const loadSourceCounts = useCallback(async (notebookList: Notebook[]) => {
    const counts: Record<string, number> = {}
    await Promise.all(
      notebookList.map(async (notebook) => {
        counts[notebook.id] = await getSourceCountByNotebook(notebook.id)
      }),
    )
    sourceCountsByNotebook.value = counts
  }, [])

  const loadNotebooks = useCallback(async () => {
    notebooksLoading.value = true
    try {
      const loaded = await getNotebooks()
      notebooks.value = loaded
      // Load source counts for all notebooks
      await loadSourceCounts(loaded)
    }
    finally {
      notebooksLoading.value = false
    }
  }, [loadSourceCounts])

  const loadActiveNotebook = useCallback(async () => {
    const activeId = await getActiveNotebookId()
    if (activeId) {
      currentNotebookId.value = activeId
    }
  }, [])

  const selectNotebook = useCallback(async (id: string) => {
    // Reload notebooks to get latest data first
    const loaded = await getNotebooks()

    // Then update both signals together to avoid rendering with mismatched state
    await setActiveNotebookId(id)
    currentNotebookId.value = id
    notebooks.value = loaded
  }, [])

  const createNotebook = useCallback(async (name: string): Promise<Notebook> => {
    const newNotebook = createNb(name)

    // Save the new notebook
    await saveNotebook(newNotebook)

    // Select the new notebook (this also reloads the notebooks list)
    await selectNotebook(newNotebook.id)

    // Rebuild context menus to include the new notebook
    chrome.runtime.sendMessage({ type: 'REBUILD_CONTEXT_MENUS' }).catch(() => {
      // Background script may not be ready yet
    })

    return newNotebook
  }, [selectNotebook])

  const deleteNotebook = useCallback(async (id: string) => {
    await deleteNb(id)

    // If we deleted the active notebook, clear it
    const activeId = await getActiveNotebookId()
    if (activeId === id) {
      currentNotebookId.value = null
    }

    // Reload notebooks
    await loadNotebooks()

    // Rebuild context menus to remove the deleted notebook
    chrome.runtime.sendMessage({ type: 'REBUILD_CONTEXT_MENUS' }).catch(() => {
      // Background script may not be ready yet
    })
  }, [loadNotebooks])

  const renameNotebook = useCallback(async (id: string, name: string): Promise<void> => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const existing = await getNotebook(id)
    if (!existing) {
      return
    }

    await saveNotebook({
      ...existing,
      name: trimmedName,
    })

    await loadNotebooks()

    chrome.runtime.sendMessage({ type: 'REBUILD_CONTEXT_MENUS' }).catch(() => {
      // Background script may not be ready yet
    })
  }, [loadNotebooks])

  const reloadNotebooks = async (): Promise<void> => {
    await loadNotebooks()
    await loadActiveNotebook()
  }

  return {
    currentNotebookId: currentNotebookId.value,
    notebooks: notebooks.value,
    isLoading: notebooksLoading.value,
    selectNotebook,
    createNotebook,
    deleteNotebook,
    renameNotebook,
    reloadNotebooks,
  }
}

/**
 * useSources Hook
 *
 * Manages sources state for a notebook.
 * Handles loading, filtering, and managing sources.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import type { Source } from '../../types/index.ts'
import { getSourcesByNotebook, saveSource, deleteSource } from '../../lib/storage.ts'

export interface UseSourcesReturn {
  /** Sources for the current notebook */
  sources: Source[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Filtered sources (if using filter) */
  filteredSources: Source[]
  /** Load sources for a notebook */
  loadSources: (notebookId: string) => Promise<void>
  /** Add a source to the notebook */
  addSource: (source: Source) => Promise<void>
  /** Remove a source */
  removeSource: (sourceId: string) => Promise<void>
  /** Set sources manually */
  setSources: (sources: Source[]) => void
  /** Clear all sources */
  clearSources: () => void
}

/**
 * Hook for managing sources in a notebook
 *
 * @param notebookId - The notebook ID to load sources for
 *
 * @example
 * ```tsx
 * function SourcesList() {
 *   const { sources, isLoading, loadSources, removeSource } = useSources(null)
 *
 *   useEffect(() => {
 *     if (currentNotebookId) {
 *       loadSources(currentNotebookId)
 *     }
 *   }, [currentNotebookId])
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   return (
 *     <ul>
 *       {sources.map(source => (
 *         <li key={source.id}>
 *           {source.title}
 *           <button onClick={() => removeSource(source.id)}>Remove</button>
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useSources(notebookId: string | null): UseSourcesReturn {
  const [sources, setSources] = useState<Source[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load sources when notebookId changes
  useEffect(() => {
    if (notebookId) {
      void loadSources(notebookId)
    }
    else {
      setSources([])
    }
  }, [notebookId])

  const loadSources = async (id: string): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const loaded = await getSourcesByNotebook(id)
      setSources(loaded)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources')
    }
    finally {
      setIsLoading(false)
    }
  }

  const addSource = async (source: Source): Promise<void> => {
    if (!notebookId) return

    setIsLoading(true)
    try {
      await saveSource(source)
      // Reload sources
      await loadSources(notebookId)
    }
    finally {
      setIsLoading(false)
    }
  }

  const removeSource = async (sourceId: string): Promise<void> => {
    if (!notebookId) return

    setIsLoading(true)
    try {
      await deleteSource(sourceId)
      // Reload sources
      await loadSources(notebookId)
    }
    finally {
      setIsLoading(false)
    }
  }

  const clearSources = (): void => {
    setSources([])
  }

  // For now, filteredSources is just all sources (can be extended with filter logic)
  const filteredSources = sources

  return {
    sources,
    isLoading,
    error,
    filteredSources,
    loadSources,
    addSource,
    removeSource,
    setSources,
    clearSources,
  }
}

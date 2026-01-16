/**
 * useSources Hook
 *
 * Manages source operations (add, remove, refresh) for the current notebook.
 * Uses Preact signals for state and BroadcastChannel for cross-context sync.
 */

import { useCallback, useEffect } from 'preact/hooks'
import type { Source } from '../../types/index.ts'
import { sources, sourcesLoading } from '../store'
import { getChannel, CHANNELS } from '../lib/broadcast'
import type { SourcesEvent } from '../lib/broadcast'
import {
  getSourcesByNotebook,
  saveSource,
  deleteSource as deleteSrc,
} from '../../lib/storage.ts'

export interface UseSourcesReturn {
  /** Sources for the current notebook */
  sources: Source[]
  /** Loading state for sources */
  isLoading: boolean
  /** Add a source to the current notebook */
  addSource: (source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Source>
  /** Remove a source by ID */
  removeSource: (sourceId: string) => Promise<void>
  /** Reload sources for the current notebook */
  reloadSources: () => Promise<void>
  /** Clear all sources */
  clearSources: () => void
}

/**
 * Hook for managing source state using signals and BroadcastChannel
 */
export function useSources(notebookId: string | null): UseSourcesReturn {
  const loadSources = useCallback(async () => {
    if (!notebookId) {
      sources.value = []
      return
    }

    sourcesLoading.value = true
    try {
      const loaded = await getSourcesByNotebook(notebookId)
      sources.value = loaded
    }
    finally {
      sourcesLoading.value = false
    }
  }, [notebookId])

  // Load sources when notebook changes
  useEffect(() => {
    if (notebookId) {
      void loadSources()
    }
    else {
      sources.value = []
    }
  }, [notebookId, loadSources])

  // Listen for external storage changes via BroadcastChannel
  useEffect(() => {
    const channel = getChannel(CHANNELS.SOURCES)
    const handleMessage = (event: MessageEvent<SourcesEvent>) => {
      // Only reload if event affects current notebook
      if (notebookId && event.data.notebookId === notebookId) {
        void loadSources()
      }
    }

    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
    }
  }, [notebookId, loadSources])

  // Listen for sources-changed event (from chrome-bridge when background adds sources)
  useEffect(() => {
    const handleSourcesChanged = () => {
      if (notebookId) {
        void loadSources()
      }
    }

    window.addEventListener('foliolm:sources-changed', handleSourcesChanged)
    return () => {
      window.removeEventListener('foliolm:sources-changed', handleSourcesChanged)
    }
  }, [notebookId, loadSources])

  const addSource = useCallback(async (
    sourceData: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Source> => {
    if (!notebookId) {
      throw new Error('No active notebook')
    }

    const source: Source = {
      ...sourceData,
      id: crypto.randomUUID(),
      notebookId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await saveSource(source)

    // Reload sources
    await loadSources()

    return source
  }, [notebookId, loadSources])

  const removeSource = useCallback(async (sourceId: string) => {
    await deleteSrc(sourceId)

    // Reload sources
    await loadSources()
  }, [loadSources])

  const clearSources = useCallback(() => {
    sources.value = []
  }, [])

  return {
    sources: sources.value,
    isLoading: sourcesLoading.value,
    addSource,
    removeSource,
    reloadSources: loadSources,
    clearSources,
  }
}

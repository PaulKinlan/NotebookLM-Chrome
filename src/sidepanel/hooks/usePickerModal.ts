/**
 * usePickerModal Hook
 *
 * Manages the source picker modal state (tabs, bookmarks, history).
 */

import { useState, useCallback } from 'preact/hooks'
import type { Source } from '../../types/index.ts'
import {
  getTabs,
  importTabs,
  getTabGroups,
  importTabGroups,
  getBookmarks,
  importBookmarks,
  getHistory,
  importHistory,
  type PickerItem as ServicePickerItem,
} from '../services/sources'

export type PickerType = 'tabs' | 'tabGroups' | 'bookmarks' | 'history'

export interface PickerItem {
  id: string
  title: string
  url?: string
  domain?: string
  favicon?: string
  selected: boolean
}

export interface UsePickerModalReturn {
  /** Whether the picker is open */
  isOpen: boolean
  /** Type of picker currently showing */
  pickerType: PickerType | null
  /** Items in the picker */
  items: PickerItem[]
  /** Whether items are being loaded */
  isLoading: boolean
  /** Search query for filtering */
  searchQuery: string
  /** Filtered items based on search */
  filteredItems: PickerItem[]
  /** Open the picker */
  openPicker: (type: PickerType) => Promise<void>
  /** Close the picker */
  closePicker: () => void
  /** Set search query */
  setSearchQuery: (query: string) => void
  /** Toggle item selection */
  toggleItem: (id: string) => void
  /** Select all items */
  selectAll: () => void
  /** Deselect all items */
  deselectAll: () => void
  /** Add selected items */
  addSelected: () => Promise<number>
}

/**
 * Convert service picker items to hook picker items
 */
function toPickerItem(item: ServicePickerItem): PickerItem {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    domain: item.url ? new URL(item.url).hostname : undefined,
    favicon: item.favicon,
    selected: false,
  }
}

/**
 * Hook for managing the source picker modal
 */
export function usePickerModal(): UsePickerModalReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [pickerType, setPickerType] = useState<PickerType | null>(null)
  const [items, setItems] = useState<PickerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const openPicker = useCallback(async (type: PickerType) => {
    setPickerType(type)
    setIsOpen(true)
    setSearchQuery('')
    setIsLoading(true)

    try {
      let fetchedItems: ServicePickerItem[] = []

      switch (type) {
        case 'tabs':
          fetchedItems = await getTabs()
          break
        case 'tabGroups':
          fetchedItems = await getTabGroups()
          break
        case 'bookmarks':
          fetchedItems = await getBookmarks()
          break
        case 'history':
          fetchedItems = await getHistory(100)
          break
      }

      setItems(fetchedItems.map(toPickerItem))
    }
    catch (error) {
      console.error(`[usePickerModal] Failed to load ${type}:`, error)
      setItems([])
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  const closePicker = useCallback(() => {
    setIsOpen(false)
    setPickerType(null)
    setItems([])
    setSearchQuery('')
  }, [])

  const toggleItem = useCallback((id: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    )
  }, [])

  const selectAll = useCallback(() => {
    setItems(prev => prev.map(item => ({ ...item, selected: true })))
  }, [])

  const deselectAll = useCallback(() => {
    setItems(prev => prev.map(item => ({ ...item, selected: false })))
  }, [])

  const addSelected = useCallback(async (): Promise<number> => {
    if (!pickerType) {
      return 0
    }

    const selectedItems = items.filter(item => item.selected)
    if (selectedItems.length === 0) {
      return 0
    }

    const selectedIds = selectedItems.map(item => item.id)
    let sources: Source[] = []

    try {
      switch (pickerType) {
        case 'tabs':
          sources = await importTabs(selectedIds)
          break
        case 'tabGroups':
          sources = await importTabGroups(selectedIds)
          break
        case 'bookmarks':
          sources = await importBookmarks(selectedIds)
          break
        case 'history':
          sources = await importHistory(selectedIds)
          break
      }

      closePicker()
      return sources.length
    }
    catch (error) {
      console.error('[usePickerModal] Failed to add items:', error)
      return 0
    }
  }, [pickerType, items, closePicker])

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(query)
      || item.url?.toLowerCase().includes(query)
      || item.domain?.toLowerCase().includes(query)
    )
  })

  return {
    isOpen,
    pickerType,
    items,
    isLoading,
    searchQuery,
    filteredItems,
    openPicker,
    closePicker,
    setSearchQuery,
    toggleItem,
    selectAll,
    deselectAll,
    addSelected,
  }
}

/**
 * usePickerModal Hook
 *
 * Manages the state for the picker modal (tabs, bookmarks, history selection).
 * Handles loading items, managing selection state, and opening/closing the modal.
 */

import { useState } from '../../jsx-runtime/hooks/index.ts'
import type { PickerItem } from '../services/sources.ts'
import { getTabs, getBookmarks, getHistory, getTabGroups } from '../services/sources.ts'

export type PickerType = 'tab' | 'tabGroup' | 'bookmark' | 'history' | null

export interface UsePickerModalReturn {
  /** Available picker items */
  items: PickerItem[]
  /** Currently selected item IDs */
  selectedItems: Set<string>
  /** Which picker type is currently open */
  pickerType: PickerType
  /** Whether items are being loaded */
  isLoading: boolean
  /** Open the picker for a specific type */
  openPicker: (type: PickerType) => Promise<void>
  /** Close the picker */
  closePicker: () => void
  /** Toggle selection of an item */
  toggleItem: (id: string) => void
  /** Select all items */
  selectAll: () => void
  /** Clear selection */
  clearSelection: () => void
  /** Get selected items as an array */
  getSelectedItems: () => PickerItem[]
}

/**
 * Hook for managing picker modal state
 *
 * @example
 * ```tsx
 * function PickerModal() {
 *   const { items, selectedItems, pickerType, isLoading, openPicker, closePicker, toggleItem, getSelectedItems } = usePickerModal()
 *
 *   const handleAddSources = async () => {
 *     const selected = getSelectedItems()
 *     await addSourcesToNotebook(selected)
 *     closePicker()
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={() => openPicker('tab')}>Open Tabs Picker</button>
 *       {pickerType && (
 *         <Modal onClose={closePicker}>
 *           {items.map(item => (
 *             <div key={item.id}>
 *               <input
 *                 type="checkbox"
 *                 checked={selectedItems.has(item.id)}
 *                 onChange={() => toggleItem(item.id)}
 *               />
 *               {item.title}
 *             </div>
 *           ))}
 *           <button onClick={handleAddSources}>Add Selected</button>
 *         </Modal>
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export function usePickerModal(): UsePickerModalReturn {
  const [items, setItems] = useState<PickerItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [pickerType, setPickerType] = useState<PickerType>(null)
  const [isLoading, setIsLoading] = useState(false)

  const openPicker = async (type: PickerType): Promise<void> => {
    if (!type) return

    setPickerType(type)
    setSelectedItems(new Set())
    setIsLoading(true)

    try {
      let loadedItems: PickerItem[] = []

      switch (type) {
        case 'tab': {
          loadedItems = await getTabs()
          break
        }
        case 'bookmark': {
          loadedItems = await getBookmarks()
          break
        }
        case 'history': {
          loadedItems = await getHistory()
          break
        }
        case 'tabGroup': {
          loadedItems = await getTabGroups()
          break
        }
      }

      setItems(loadedItems)
    }
    finally {
      setIsLoading(false)
    }
  }

  const closePicker = (): void => {
    setPickerType(null)
    setItems([])
    setSelectedItems(new Set())
  }

  const toggleItem = (id: string): void => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = (): void => {
    const allIds = new Set(items.map(item => item.id))
    setSelectedItems(allIds)
  }

  const clearSelection = (): void => {
    setSelectedItems(new Set())
  }

  const getSelectedItems = (): PickerItem[] => {
    return items.filter(item => selectedItems.has(item.id))
  }

  return {
    items,
    selectedItems,
    pickerType,
    isLoading,
    openPicker,
    closePicker,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedItems,
  }
}

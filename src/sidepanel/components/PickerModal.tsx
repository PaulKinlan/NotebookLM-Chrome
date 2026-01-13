/**
 * PickerModal Component
 *
 * Modal for selecting tabs, bookmarks, history, or tab groups to add as sources.
 * Uses the usePickerModal hook for state management.
 */

import { usePickerModal } from '../hooks/usePickerModal.ts'
import { useState } from '../../jsx-runtime/hooks/index.ts'
import type { PickerItem } from '../services/sources.ts'

/**
 * Favicon component
 */
interface FaviconProps {
  src?: string
  fallback?: string
}

function Favicon({ src, fallback = '?' }: FaviconProps): JSX.Element {
  if (src) {
    return <img src={src} alt="" className="item-favicon" />
  }
  return <span className="item-favicon-fallback">{fallback}</span>
}

/**
 * PickerItem component
 */
interface PickerItemComponentProps {
  key?: string // JSX key prop, extracted by runtime
  item: PickerItem
  selected: boolean
  onToggle: (id: string) => void
  searchTerm: string
}

function PickerItemComponent({ item, selected, onToggle, searchTerm }: PickerItemComponentProps): JSX.Element {
  const handleChange = () => {
    onToggle(item.id)
  }

  // Highlight matching text
  const highlightMatch = (text: string): JSX.Element => {
    if (!searchTerm) return <>{text}</>

    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase())
    if (index === -1) return <>{text}</>

    return (
      <>
        {text.slice(0, index)}
        <strong>{text.slice(index, index + searchTerm.length)}</strong>
        {text.slice(index + searchTerm.length)}
      </>
    )
  }

  // Get fallback character from title
  const fallbackChar = item.title.charAt(0).toUpperCase()

  return (
    <label className="picker-item">
      <input
        type="checkbox"
        checked={selected}
        onChange={handleChange}
      />
      <span className="item-title">{highlightMatch(item.title)}</span>
      <Favicon src={item.favicon} fallback={fallbackChar} />
      {item.tabCount && (
        <span className="item-count">{item.tabCount}</span>
      )}
    </label>
  )
}

/**
 * PickerModal Component
 */
export interface PickerModalProps {
  onAddSources: (items: PickerItem[]) => void | Promise<void>
  onClose?: () => void
}

export function PickerModal({ onAddSources, onClose }: PickerModalProps): JSX.Element | null {
  const {
    items,
    selectedItems,
    pickerType,
    isLoading,
    openPicker,
    closePicker,
    toggleItem,
    getSelectedItems,
  } = usePickerModal()

  // Internal state for search
  const [searchTerm, setSearchTerm] = useState('')
  const [localPickerType, setLocalPickerType] = useState<typeof pickerType>(null)

  const handleAddSelected = () => {
    const selected = getSelectedItems()
    void onAddSources(selected)
    closePicker()
    setSearchTerm('')
    setLocalPickerType(null)
  }

  const handleClose = () => {
    closePicker()
    setSearchTerm('')
    setLocalPickerType(null)
    if (onClose) onClose()
  }

  const handlePickerTypeClick = (type: 'tab' | 'tabGroup' | 'bookmark' | 'history') => {
    setLocalPickerType(type)
    void openPicker(type)
  }

  // Filter items based on search term
  const filteredItems = searchTerm
    ? items.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
        || item.url.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : items

  // Show picker controls if no picker type is selected
  if (!localPickerType || !pickerType) {
    return (
      <div className="picker-modal">
        <div className="picker-header">
          <h3>Add Sources</h3>
        </div>
        <div className="picker-controls">
          <button
            className="btn btn-outline"
            onClick={() => handlePickerTypeClick('tab')}
            type="button"
          >
            Add Tabs
          </button>
          <button
            className="btn btn-outline"
            onClick={() => handlePickerTypeClick('tabGroup')}
            type="button"
          >
            Add Tab Groups
          </button>
          <button
            className="btn btn-outline"
            onClick={() => handlePickerTypeClick('bookmark')}
            type="button"
          >
            Add Bookmarks
          </button>
          <button
            className="btn btn-outline"
            onClick={() => handlePickerTypeClick('history')}
            type="button"
          >
            Add History
          </button>
        </div>
      </div>
    )
  }

  // Show picker for selected type
  return (
    <div className="picker-modal">
      <div className="picker-header">
        <h3>
          Select
          {' '}
          {pickerType}
          s
        </h3>
        <button
          className="icon-btn"
          onClick={handleClose}
          type="button"
        >
          ✕
        </button>
      </div>

      {isLoading
        ? (
            <p>Loading...</p>
          )
        : (
            <>
              <div className="picker-search">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onInput={(e: Event) => {
                    const target = e.target as HTMLInputElement
                    setSearchTerm(target.value)
                  }}
                />
              </div>

              <div className="picker-items">
                {filteredItems.length === 0
                  ? (
                      <p className="picker-empty">No items found</p>
                    )
                  : (
                      filteredItems.map(item => (
                        <PickerItemComponent
                          key={item.id}
                          item={item}
                          selected={selectedItems.has(item.id)}
                          onToggle={toggleItem}
                          searchTerm={searchTerm}
                        />
                      ))
                    )}
              </div>

              <div className="picker-footer">
                <button
                  className="btn btn-outline"
                  onClick={handleClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleAddSelected}
                  disabled={selectedItems.size === 0}
                  type="button"
                >
                  Add
                  {' '}
                  {selectedItems.size}
                  {' '}
                  {pickerType}
                  {selectedItems.size !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
    </div>
  )
}

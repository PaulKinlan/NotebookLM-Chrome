/**
 * NotebookSelector Component
 *
 * Example component demonstrating useNotebook hook.
 * Displays current notebook, allows switching and creating notebooks.
 */

import { useNotebook } from '../hooks/index.ts'

export function NotebookSelector() {
  const { currentNotebookId, notebooks, isLoading, selectNotebook, createNotebook } = useNotebook()

  const handleCreateNotebook = async () => {
    const name = prompt('Enter notebook name:')
    if (name) {
      await createNotebook(name)
    }
  }

  const currentNotebook = notebooks.find(nb => nb.id === currentNotebookId)

  return (
    <div className="notebook-selector">
      <h2>Notebooks</h2>

      {isLoading && <p>Loading notebooks...</p>}

      <select
        value={currentNotebookId || ''}
        onChange={(e: Event) => {
          const target = e.currentTarget
          if (target instanceof HTMLSelectElement && target.value) {
            void selectNotebook(target.value)
          }
        }}
      >
        <option value="">Select a notebook...</option>
        {notebooks.map(nb => (
          <option key={nb.id} value={nb.id}>{nb.name}</option>
        ))}
      </select>

      <button onClick={handleCreateNotebook}>+ New Notebook</button>

      {currentNotebook && (
        <div className="current-notebook">
          <p>
            <strong>Current:</strong>
            {' '}
            {currentNotebook.name}
          </p>
          <p>
            <strong>ID:</strong>
            {' '}
            {currentNotebook.id}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * PermissionsBadge Component
 *
 * Example component demonstrating usePermissions hook.
 * Shows permission status and allows requesting permissions.
 */

import { usePermissions } from '../hooks/index.ts'

export function PermissionsBadge() {
  const { permissions, ensurePermission, reloadPermissions } = usePermissions()

  const handleRequestPermission = async (type: keyof typeof permissions) => {
    await ensurePermission(type)
    // Reload to update UI
    await reloadPermissions()
  }

  return (
    <div className="permissions-badge">
      <h3>Permissions</h3>
      <div className="permission-list">
        {Object.entries(permissions).map(([key, granted]) => (
          <div key={key} className="permission-item">
            <span>
              {key}
              :
            </span>
            <span className={granted ? 'granted' : 'denied'}>
              {granted ? '✓ Granted' : '✗ Denied'}
            </span>
            {!granted && (
              <button onClick={() => handleRequestPermission(key as keyof typeof permissions)}>
                Request
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * SourceList Component
 *
 * Example component demonstrating useSources hook.
 * Displays sources for the current notebook.
 */

import { useSources } from '../hooks/index.ts'
import type { Source } from '../../types/index.ts'

interface SourceListProps {
  notebookId: string | null
}

export function SourceList({ notebookId }: SourceListProps) {
  const { sources, isLoading, error, removeSource } = useSources(notebookId)

  if (isLoading) return <p>Loading sources...</p>
  if (error) return (
    <p>
      Error:
      {error}
    </p>
  )
  if (!notebookId) return <p>Select a notebook to view sources</p>

  return (
    <div className="source-list">
      <h3>
        Sources (
        {sources.length}
        )
      </h3>
      {sources.length === 0
        ? (
            <p>No sources yet. Add some tabs, bookmarks, or history items.</p>
          )
        : (
            <ul>
              {sources.map((source: Source) => (
                <li key={source.id} className="source-item">
                  <span className="source-type">{source.type}</span>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                  <button onClick={() => removeSource(source.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}

/**
 * PickerModal Component
 *
 * Example component demonstrating usePickerModal hook.
 * Allows selecting tabs, bookmarks, or history to add as sources.
 */

import { usePickerModal } from '../hooks/index.ts'
import type { PickerItem } from '../services/sources.ts'

interface PickerModalProps {
  onAddSources: (items: PickerItem[]) => Promise<void>
}

export function PickerModal({ onAddSources }: PickerModalProps) {
  const { items, selectedItems, pickerType, isLoading, openPicker, closePicker, toggleItem, getSelectedItems } = usePickerModal()

  const handleAddSelected = async () => {
    const selected = getSelectedItems()
    await onAddSources(selected)
    closePicker()
  }

  if (!pickerType) {
    return (
      <div className="picker-controls">
        <h3>Add Sources</h3>
        <button onClick={() => openPicker('tab')}>Add Tabs</button>
        <button onClick={() => openPicker('bookmark')}>Add Bookmarks</button>
        <button onClick={() => openPicker('history')}>Add History</button>
        <button onClick={() => openPicker('tabGroup')}>Add Tab Groups</button>
      </div>
    )
  }

  return (
    <div className="picker-modal">
      <div className="picker-header">
        <h3>
          Select
          {pickerType}
          s
        </h3>
        <button onClick={closePicker}>✕</button>
      </div>

      {isLoading
        ? (
            <p>Loading...</p>
          )
        : (
            <>
              <div className="picker-items">
                {items.map(item => (
                  <label key={item.id} className="picker-item">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span className="item-title">{item.title}</span>
                    {item.favicon && <img src={item.favicon} alt="" className="item-favicon" />}
                  </label>
                ))}
              </div>

              <div className="picker-footer">
                <button onClick={closePicker}>Cancel</button>
                <button onClick={handleAddSelected} disabled={selectedItems.size === 0}>
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

/**
 * Modals Components
 *
 * Contains picker modal, confirm dialog, and notebook dialog components.
 * These are controlled components that receive their state as props.
 * The parent component (App.tsx) uses useDialog and usePickerModal hooks.
 */

import type { ConfirmDialogState, NotebookDialogState } from '../hooks/useDialog.ts'
import type { UsePickerModalReturn } from '../hooks/usePickerModal.ts'

// ============================================================================
// Picker Modal (imperative wrapper for compatibility)
// ============================================================================

/**
 * PickerModal Component
 *
 * Placeholder for picker modal - currently managed imperatively by controllers.ts.
 * TODO: Convert to fully stateful component with usePickerModal.
 */
export function PickerModal() {
  // Imperative placeholder - modal visibility controlled by controllers.ts
  return (
    <div id="picker-modal" className="modal hidden">
      <div className="modal-backdrop"></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="picker-title">Select Items</h3>
          <button id="picker-close" className="icon-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="picker-search" placeholder="Search..." />
        </div>
        <div id="picker-list" className="picker-list"></div>
        <div className="modal-footer">
          <span id="picker-selected-count">0 selected</span>
          <div className="modal-actions">
            <button id="picker-cancel" className="btn btn-outline">Cancel</button>
            <button id="picker-add" className="btn btn-primary">Add Selected</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * PickerModalStateful Component
 *
 * Stateful picker modal that uses usePickerModal hook.
 * Not yet integrated - planned for next phase.
 */
export interface PickerModalStatefulProps {
  /** usePickerModal hook return value */
  picker: UsePickerModalReturn
  /** Callback when items are selected and confirmed */
  onConfirm: (items: { id: string, url: string, title: string, favicon?: string }[]) => Promise<void>
}

export function PickerModalStateful({ picker, onConfirm }: PickerModalStatefulProps) {
  const { items, selectedItems, pickerType, isLoading, closePicker, toggleItem, getSelectedItems } = picker

  if (!pickerType) {
    return null
  }

  const typeNames: Record<string, string> = {
    tab: 'Select from Tabs',
    tabGroup: 'Select from Tab Groups',
    bookmark: 'Select from Bookmarks',
    history: 'Select from History',
  }

  const handleConfirm = async () => {
    const selected = getSelectedItems()
    await onConfirm(selected)
    closePicker()
  }

  return (
    <div id="picker-modal" className="modal">
      <div className="modal-backdrop" onClick={closePicker}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="picker-title">{typeNames[pickerType] || 'Select Items'}</h3>
          <button id="picker-close" className="icon-btn" onClick={closePicker}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="picker-search" placeholder="Search..." />
        </div>
        <div id="picker-list" className="picker-list">
          {isLoading
            ? (
                <p>Loading...</p>
              )
            : (
                items.map(item => (
                  <div
                    key={item.id}
                    className={`picker-item ${selectedItems.has(item.id) ? 'selected' : ''}`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span className="picker-item-title">{item.title}</span>
                    {item.favicon && <img className="picker-item-favicon" src={item.favicon} alt="" />}
                  </div>
                ))
              )}
        </div>
        <div className="modal-footer">
          <span id="picker-selected-count">
            {selectedItems.size}
            {' '}
            selected
          </span>
          <div className="modal-actions">
            <button id="picker-cancel" className="btn btn-outline" onClick={closePicker}>Cancel</button>
            <button id="picker-add" className="btn btn-primary" onClick={handleConfirm}>Add Selected</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Notebook Dialog
// ============================================================================

export interface NotebookDialogProps extends NotebookDialogState {
  onConfirm: () => void
  onCancel: () => void
  onInput: (value: string) => void
}

export function NotebookDialog(props: NotebookDialogProps) {
  const { visible, title, placeholder, confirmText, inputValue, onConfirm, onCancel, onInput } = props

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    console.log('[NotebookDialog] handleSubmit called, calling onConfirm with inputValue:', inputValue)
    onConfirm()
  }

  // NOTE: For forms inside <dialog>, we need to handle submission specially
  // The dialog should close after successful submission
  const handleDialogClick = (e: { target: EventTarget, currentTarget: EventTarget }) => {
    const dialog = e.currentTarget as HTMLDialogElement
    if (e.target === dialog) {
      // Clicking backdrop closes the dialog
      onCancel()
    }
  }

  // Note: Use style.display for visibility to avoid re-render loops
  // The template string className changes on every render and causes issues
  const dialogStyle = visible ? {} : { display: 'none' }

  return (
    <dialog
      id="notebook-dialog"
      className="dialog"
      style={dialogStyle}
      onClick={handleDialogClick}
    >
      <h3 id="notebook-dialog-title">{title}</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          id="notebook-name-input"
          placeholder={placeholder}
          value={inputValue}
          onInput={(e: { target: HTMLInputElement }) => {
            console.log('[NotebookDialog] onInput called with value:', e.target.value)
            onInput(e.target.value)
          }}
          autoFocus
        />
        <div className="dialog-actions">
          <button
            type="button"
            id="notebook-dialog-cancel"
            className="btn btn-outline"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            id="notebook-dialog-confirm"
            className="btn btn-primary"
          >
            {confirmText}
          </button>
        </div>
      </form>
    </dialog>
  )
}

// ============================================================================
// Confirm Dialog
// ============================================================================

export interface ConfirmDialogProps extends ConfirmDialogState {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { visible, title, message, confirmText, cancelText, isDestructive, onConfirm, onCancel } = props

  if (!visible) {
    return null
  }

  return (
    <dialog
      id="confirm-dialog"
      className="dialog"
      open={visible}
      onCancel={onCancel}
    >
      <h3 id="confirm-dialog-title">{title}</h3>
      <p id="confirm-dialog-message">{message}</p>
      <div className="dialog-actions">
        <button
          id="confirm-dialog-cancel"
          className="btn btn-outline"
          onClick={onCancel}
        >
          {cancelText}
        </button>
        <button
          id="confirm-dialog-confirm"
          className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </dialog>
  )
}

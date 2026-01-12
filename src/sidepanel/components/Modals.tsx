/**
 * Modals Components
 *
 * Contains picker modal, confirm dialog, and notebook dialog components.
 * These are controlled components that receive their state as props.
 * The parent component (App.tsx) uses useDialog and usePickerModal hooks.
 */

import type { ConfirmDialogState, NotebookDialogState } from '../hooks/useDialog.ts'

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

  if (!visible) {
    return null
  }

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    onConfirm()
  }

  return (
    <dialog
      id="notebook-dialog"
      className="dialog"
      open={visible}
      onCancel={onCancel}
    >
      <h3 id="notebook-dialog-title">{title}</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          id="notebook-name-input"
          placeholder={placeholder}
          value={inputValue}
          onInput={(e: { target: HTMLInputElement }) => onInput(e.target.value)}
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

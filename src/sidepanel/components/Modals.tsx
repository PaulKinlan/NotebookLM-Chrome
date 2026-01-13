/**
 * Modals Components
 *
 * Contains confirm dialog and notebook dialog components.
 * These are controlled components that receive their state as props.
 * The parent component (App.tsx) uses useDialog hook.
 *
 * Note: The picker modal has been moved to PickerModal.tsx as a
 * fully stateful component integrated with AddTabStateful.
 */

import { useEffect, useRef } from '../../jsx-runtime/hooks/index.ts'
import type { ConfirmDialogState, NotebookDialogState } from '../hooks/useDialog.ts'

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
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  console.log('[NotebookDialog] Render called with visible:', visible, 'dialogRef.current:', dialogRef.current)

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    console.log('[NotebookDialog] handleSubmit called, calling onConfirm with inputValue:', inputValue)
    onConfirm()
  }

  // NOTE: For forms inside <dialog>, we need to handle submission specially
  // The dialog should close after successful submission
  const handleDialogClick = (e: { target: EventTarget, currentTarget: EventTarget }) => {
    const dialog = e.currentTarget
    if (dialog instanceof HTMLDialogElement && e.target === dialog) {
      // Clicking backdrop closes the dialog
      onCancel()
    }
  }

  // Use the native <dialog> element's showModal() and close() methods
  // This is required for proper <dialog> behavior
  useEffect(() => {
    console.log('[NotebookDialog] useEffect called, visible:', visible, 'dialogRef.current:', dialogRef.current)
    const dialog = dialogRef.current
    if (!dialog) {
      console.log('[NotebookDialog] useEffect: dialog ref is null, exiting')
      return
    }

    console.log('[NotebookDialog] useEffect: dialog.open:', dialog.open)

    if (visible && !dialog.open) {
      console.log('[NotebookDialog] Calling showModal()')
      dialog.showModal()
    }
    else if (!visible && dialog.open) {
      console.log('[NotebookDialog] Calling close()')
      dialog.close()
    }
  }, [visible])

  if (!visible) {
    // Don't render the dialog when not visible (optional, saves DOM nodes)
    // But we need to keep it mounted for the ref to work
    // So we render it but the dialog will be closed
  }

  return (
    <dialog
      ref={dialogRef}
      id="notebook-dialog"
      className="dialog"
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

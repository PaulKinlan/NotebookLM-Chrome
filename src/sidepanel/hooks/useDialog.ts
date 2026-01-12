/**
 * useDialog Hook
 *
 * Manages dialog state for confirm dialogs and notebook dialogs.
 * Replaces imperative showConfirmDialog() and showNotebookDialog() from services/ui.ts.
 */

import { useState, useRef } from '../../jsx-runtime/hooks/index.ts'

export interface ConfirmDialogState {
  visible: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  isDestructive: boolean
}

export interface NotebookDialogState {
  visible: boolean
  title: string
  placeholder: string
  confirmText: string
  inputValue: string
}

export interface DialogHandlers {
  // Confirm dialog
  showConfirm: (options: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    isDestructive?: boolean
  }) => Promise<boolean>

  // Notebook dialog
  showNotebook: (options?: {
    title?: string
    placeholder?: string
    confirmText?: string
  }) => Promise<string | null>

  // Internal handlers (used by dialog components)
  _handleConfirm: () => void
  _handleConfirmCancel: () => void
  _handleNotebookConfirm: () => void
  _handleNotebookCancel: () => void
  _setNotebookInput: (value: string) => void
}

/**
 * useDialog hook
 *
 * Provides dialog state and control functions for both confirm and notebook dialogs.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { confirmDialog, notebookDialog, showConfirm, showNotebook } = useDialog()
 *
 *   const handleDelete = async () => {
 *     const confirmed = await showConfirm({
 *       title: 'Delete Notebook',
 *       message: 'Are you sure you want to delete this notebook?',
 *       confirmText: 'Delete',
 *       isDestructive: true,
 *     })
 *     if (confirmed) {
 *       // Delete the notebook
 *     }
 *   }
 *
 *   const handleNewNotebook = async () => {
 *     const name = await showNotebook({
 *       title: 'New Notebook',
 *       placeholder: 'Enter notebook name...',
 *     })
 *     if (name) {
 *       // Create notebook with name
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       <button onClick={handleNewNotebook}>New Notebook</button>
 *
 *       {confirmDialog.visible && (
 *         <ConfirmDialog
 *           title={confirmDialog.title}
 *           message={confirmDialog.message}
 *           confirmText={confirmDialog.confirmText}
 *           cancelText={confirmDialog.cancelText}
 *           isDestructive={confirmDialog.isDestructive}
 *           onConfirm={() => resolveConfirm(true)}
 *           onCancel={() => resolveConfirm(false)}
 *         />
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export type UseDialogReturn = DialogHandlers & {
  confirmDialog: ConfirmDialogState
  notebookDialog: NotebookDialogState
}

export function useDialog(): UseDialogReturn {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDestructive: false,
  })

  const [notebookDialog, setNotebookDialog] = useState<NotebookDialogState>({
    visible: false,
    title: 'New Notebook',
    placeholder: 'Enter notebook name...',
    confirmText: 'Create',
    inputValue: '',
  })

  // Refs to store promise resolve functions
  const confirmResolveRef = useRef<((result: boolean) => void) | null>(null)
  const notebookResolveRef = useRef<((result: string | null) => void) | null>(null)

  const showConfirm: DialogHandlers['showConfirm'] = (options) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve
      setConfirmDialog({
        visible: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        isDestructive: options.isDestructive || false,
      })
    })
  }

  const hideConfirm = (result: boolean) => {
    setConfirmDialog((prev) => ({ ...prev, visible: false }))
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result)
      confirmResolveRef.current = null
    }
  }

  const showNotebook: DialogHandlers['showNotebook'] = (options = {}) => {
    return new Promise<string | null>((resolve) => {
      notebookResolveRef.current = resolve
      setNotebookDialog({
        visible: true,
        title: options.title || 'New Notebook',
        placeholder: options.placeholder || 'Enter notebook name...',
        confirmText: options.confirmText || 'Create',
        inputValue: '',
      })
    })
  }

  const hideNotebook = (result: string | null) => {
    setNotebookDialog((prev) => ({ ...prev, visible: false, inputValue: '' }))
    if (notebookResolveRef.current) {
      notebookResolveRef.current(result)
      notebookResolveRef.current = null
    }
  }

  return {
    confirmDialog,
    notebookDialog,
    showConfirm,
    showNotebook,
    // Internal handlers for components to call
    _handleConfirm: () => hideConfirm(true),
    _handleConfirmCancel: () => hideConfirm(false),
    _handleNotebookConfirm: () => hideNotebook(notebookDialog.inputValue || null),
    _handleNotebookCancel: () => hideNotebook(null),
    _setNotebookInput: (value: string) => {
      setNotebookDialog((prev) => ({ ...prev, inputValue: value }))
    },
  }
}

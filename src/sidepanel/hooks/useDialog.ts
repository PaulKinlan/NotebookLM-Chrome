/**
 * useDialog Hook
 *
 * Manages dialog state for confirm dialogs and notebook dialogs.
 * Replaces imperative showConfirmDialog() and showNotebookDialog() from services/ui.ts.
 */

import { useState, useRef } from 'preact/hooks'

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

  // Ref to track current input value (avoids stale closure issues in confirm handler)
  const inputValueRef = useRef<string>('')

  const hideConfirm = (result: boolean) => {
    setConfirmDialog(prev => ({ ...prev, visible: false }))
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result)
      confirmResolveRef.current = null
    }
  }

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

  const hideNotebook = (result: string | null) => {
    console.log('[useDialog] hideNotebook called with result:', result)
    setNotebookDialog((prev) => {
      console.log('[useDialog] Setting visible to false, current prev.visible:', prev.visible)
      return { ...prev, visible: false, inputValue: '' }
    })
    if (notebookResolveRef.current) {
      console.log('[useDialog] Resolving notebook promise with:', result)
      notebookResolveRef.current(result)
      notebookResolveRef.current = null
    }
  }

  const showNotebook: DialogHandlers['showNotebook'] = (options = {}) => {
    console.log('[useDialog] showNotebook called with options:', options)
    return new Promise<string | null>((resolve) => {
      console.log('[useDialog] Creating promise for notebook dialog, setting visible to true')
      notebookResolveRef.current = resolve
      inputValueRef.current = '' // Reset ref when showing dialog
      console.log('[useDialog] About to call setNotebookDialog with visible=true')
      setNotebookDialog({
        visible: true,
        title: options.title || 'New Notebook',
        placeholder: options.placeholder || 'Enter notebook name...',
        confirmText: options.confirmText || 'Create',
        inputValue: '',
      })
      console.log('[useDialog] setNotebookDialog called, waiting for state update...')
    })
  }

  return {
    confirmDialog,
    notebookDialog,
    showConfirm,
    showNotebook,
    // Internal handlers for components to call
    _handleConfirm: () => hideConfirm(true),
    _handleConfirmCancel: () => hideConfirm(false),
    _handleNotebookConfirm: () => {
      // Read from ref to get the latest value (avoids stale closure issues)
      const currentValue = inputValueRef.current
      console.log('[useDialog] _handleNotebookConfirm called, inputValue from ref:', currentValue)
      hideNotebook(currentValue || null)
    },
    _handleNotebookCancel: () => hideNotebook(null),
    _setNotebookInput: (value: string) => {
      console.log('[useDialog] _setNotebookInput called with value:', value)
      // Update both state and ref to keep them in sync
      inputValueRef.current = value
      setNotebookDialog(prev => ({ ...prev, inputValue: value }))
    },
  }
}

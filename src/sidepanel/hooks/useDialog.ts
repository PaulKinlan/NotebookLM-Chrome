/**
 * useDialog Hook
 *
 * Manages modal dialog state (notebook dialog, confirm dialog).
 * Uses global signals for state, this hook provides the action interface.
 */

import { useCallback } from 'preact/hooks'
import {
  notebookDialog,
  confirmDialog,
  confirmCallback,
} from '../store'

export interface UseDialogReturn {
  /** Open notebook dialog for creating */
  openCreateNotebookDialog: () => void
  /** Open notebook dialog for editing */
  openEditNotebookDialog: (name: string) => void
  /** Close notebook dialog */
  closeNotebookDialog: () => void
  /** Show confirm dialog */
  showConfirmDialog: (title: string, message: string, onConfirm: () => void) => void
  /** Close confirm dialog */
  closeConfirmDialog: () => void
  /** Trigger confirm dialog action (called by component) */
  triggerConfirm: () => void
}

/**
 * Hook for managing modal dialog state using signals
 *
 * The actual dialog state is stored in global signals (notebookDialog, confirmDialog).
 * This hook only provides action functions to manipulate that state.
 * Components should access the signals directly for reactive updates.
 */
export function useDialog(): UseDialogReturn {
  const openCreateNotebookDialog = useCallback(() => {
    notebookDialog.value = {
      isOpen: true,
      mode: 'create',
      initialName: '',
    }
  }, [])

  const openEditNotebookDialog = useCallback((name: string) => {
    notebookDialog.value = {
      isOpen: true,
      mode: 'edit',
      initialName: name,
    }
  }, [])

  const closeNotebookDialog = useCallback(() => {
    notebookDialog.value = {
      isOpen: false,
      mode: 'create',
      initialName: '',
    }
  }, [])

  const showConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    confirmDialog.value = {
      isOpen: true,
      title,
      message,
    }
    confirmCallback.value = onConfirm
  }, [])

  const closeConfirmDialog = useCallback(() => {
    confirmDialog.value = null
    confirmCallback.value = null
  }, [])

  const triggerConfirm = useCallback(() => {
    const callback = confirmCallback.value
    if (callback) {
      callback()
    }
    closeConfirmDialog()
  }, [closeConfirmDialog])

  return {
    openCreateNotebookDialog,
    openEditNotebookDialog,
    closeNotebookDialog,
    showConfirmDialog,
    closeConfirmDialog,
    triggerConfirm,
  }
}

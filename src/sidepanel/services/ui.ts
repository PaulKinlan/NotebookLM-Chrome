/**
 * UI Service
 *
 * Helper functions for showing notifications, dialogs, and other UI interactions.
 */

import type { PickerItem } from './sources.ts'

// ============================================================================
// Notification
// ============================================================================

export function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const notification = document.getElementById('notification') as HTMLDivElement | null
  if (!notification) return

  notification.textContent = message
  notification.className = `notification notification--${type}`
  notification.classList.remove('hidden')

  setTimeout(() => {
    notification.classList.add('hidden')
  }, 3000)
}

export function hideNotification(): void {
  const notification = document.getElementById('notification') as HTMLDivElement | null
  if (!notification) return

  notification.classList.add('hidden')
}

// ============================================================================
// Dialogs
// ============================================================================

export interface DialogOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
}

export function showConfirmDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog') as HTMLDialogElement | null
    const titleEl = document.getElementById('confirm-dialog-title') as HTMLHeadingElement | null
    const messageEl = document.getElementById('confirm-dialog-message') as HTMLParagraphElement | null
    const confirmBtn = document.getElementById('confirm-dialog-confirm') as HTMLButtonElement | null
    const cancelBtn = document.getElementById('confirm-dialog-cancel') as HTMLButtonElement | null

    if (!dialog || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
      resolve(false)
      return
    }

    titleEl.textContent = options.title
    messageEl.textContent = options.message
    confirmBtn.textContent = options.confirmText || 'Confirm'
    cancelBtn.textContent = options.cancelText || 'Cancel'

    if (options.isDestructive) {
      confirmBtn.classList.add('btn-danger')
    }
    else {
      confirmBtn.classList.remove('btn-danger')
    }

    const closeDialog = (result: boolean) => {
      dialog.close()
      confirmBtn.removeEventListener('click', onConfirm)
      cancelBtn.removeEventListener('click', onCancel)
      resolve(result)
    }

    const onConfirm = () => closeDialog(true)
    const onCancel = () => closeDialog(false)

    confirmBtn.addEventListener('click', onConfirm)
    cancelBtn.addEventListener('click', onCancel)

    dialog.showModal()
  })
}

export interface NotebookDialogOptions {
  title?: string
  placeholder?: string
  confirmText?: string
}

export function showNotebookDialog(options: NotebookDialogOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.getElementById('notebook-dialog') as HTMLDialogElement | null
    const titleEl = document.getElementById('notebook-dialog-title') as HTMLHeadingElement | null
    const inputEl = document.getElementById('notebook-name-input') as HTMLInputElement | null
    const confirmBtn = document.getElementById('notebook-dialog-confirm') as HTMLButtonElement | null
    const cancelBtn = document.getElementById('notebook-dialog-cancel') as HTMLButtonElement | null

    if (!dialog || !titleEl || !inputEl || !confirmBtn || !cancelBtn) {
      resolve(null)
      return
    }

    titleEl.textContent = options.title || 'New Notebook'
    inputEl.placeholder = options.placeholder || 'Enter notebook name...'
    inputEl.value = ''
    confirmBtn.textContent = options.confirmText || 'Create'

    const closeDialog = (result: string | null) => {
      dialog.close()
      confirmBtn.removeEventListener('click', onConfirm)
      cancelBtn.removeEventListener('click', onCancel)
      resolve(result)
    }

    const onConfirm = () => {
      const name = inputEl.value.trim()
      closeDialog(name || null)
    }

    const onCancel = () => closeDialog(null)

    confirmBtn.addEventListener('click', onConfirm)
    cancelBtn.addEventListener('click', onCancel)

    dialog.showModal()
    inputEl.focus()
  })
}

// ============================================================================
// Picker Modal
// ============================================================================

export function showPickerModal(type: 'tab' | 'tabGroup' | 'bookmark' | 'history', _items: PickerItem[]): void {
  const modal = document.getElementById('picker-modal') as HTMLDivElement | null
  const titleEl = document.getElementById('picker-title') as HTMLHeadingElement | null
  const listEl = document.getElementById('picker-list') as HTMLDivElement | null

  if (!modal || !titleEl || !listEl) return

  const typeNames = {
    tab: 'Select from Tabs',
    tabGroup: 'Select from Tab Groups',
    bookmark: 'Select from Bookmarks',
    history: 'Select from History',
  }

  titleEl.textContent = typeNames[type]
  modal.classList.remove('hidden')

  // Render items (this would normally be done by a component)
  // For now, this is a placeholder - the actual rendering happens in index.ts
}

export function hidePickerModal(): void {
  const modal = document.getElementById('picker-modal') as HTMLDivElement | null
  if (!modal) return

  modal.classList.add('hidden')
}

// ============================================================================
// Onboarding
// ============================================================================

export interface OnboardingStep {
  icon: string
  title: string
  description: string
}

export function showOnboarding(): void {
  const overlay = document.getElementById('onboarding-overlay') as HTMLDivElement | null
  if (!overlay) return

  overlay.classList.remove('hidden')
}

export function hideOnboarding(): void {
  const overlay = document.getElementById('onboarding-overlay') as HTMLDivElement | null
  if (!overlay) return

  overlay.classList.add('hidden')
}

export function setOnboardingStep(_step: number, data: OnboardingStep): void {
  const iconEl = document.getElementById('onboarding-icon') as HTMLDivElement | null
  const titleEl = document.getElementById('onboarding-title') as HTMLHeadingElement | null
  const descEl = document.getElementById('onboarding-description') as HTMLParagraphElement | null

  if (!iconEl || !titleEl || !descEl) return

  iconEl.innerHTML = data.icon
  titleEl.textContent = data.title
  descEl.textContent = data.description
}

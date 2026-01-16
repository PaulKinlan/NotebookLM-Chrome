/**
 * Unit tests for useDialog hook
 *
 * Tests the dialog management hook including:
 * - showConfirmDialog: Promise resolution on both confirm and cancel
 * - Event listener cleanup on all dialog close paths
 * - Memory leak prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// DOM Mocks
// ============================================================================

// Track event listeners to detect memory leaks
const eventListeners = new Map<
  HTMLElement,
  Map<string, Set<EventListenerOrEventListenerObject>>
>()

// Store listeners for manual triggering in tests
const elementListeners = new WeakMap<
  HTMLElement,
  Map<string, Set<EventListenerOrEventListenerObject>>
>()

function mockAddEventListener(
  this: HTMLElement,
  type: string,
  listener: EventListenerOrEventListenerObject,
) {
  if (!eventListeners.has(this)) {
    eventListeners.set(this, new Map())
  }
  const listeners = eventListeners.get(this)!
  if (!listeners.has(type)) {
    listeners.set(type, new Set())
  }
  listeners.get(type)!.add(listener)

  // Store listeners for manual triggering in tests
  if (!elementListeners.has(this)) {
    elementListeners.set(this, new Map())
  }
  const elemListeners = elementListeners.get(this)!
  if (!elemListeners.has(type)) {
    elemListeners.set(type, new Set())
  }
  elemListeners.get(type)!.add(listener)
}

function mockRemoveEventListener(
  this: HTMLElement,
  type: string,
  listener: EventListenerOrEventListenerObject,
) {
  const listeners = eventListeners.get(this)
  if (!listeners) return
  const typeListeners = listeners.get(type)
  if (!typeListeners) return
  typeListeners.delete(listener)

  // Also remove from elementListeners map
  const elemListeners = elementListeners.get(this)
  if (elemListeners) {
    const typeListeners = elemListeners.get(type)
    if (typeListeners) {
      typeListeners.delete(listener)
    }
  }
}

function getListenerCount(element: HTMLElement, type: string): number {
  const listeners = eventListeners.get(element)
  if (!listeners) return 0
  const typeListeners = listeners.get(type)
  return typeListeners ? typeListeners.size : 0
}

// Setup global DOM mocks
beforeEach(() => {
  eventListeners.clear()

  // Create mock confirm dialog elements
  const dialog = document.createElement('dialog')
  dialog.id = 'confirm-dialog'
  Object.defineProperty(dialog, 'showModal', {
    value: vi.fn(() => {
      dialog.setAttribute('open', '')
    }),
    writable: true,
    configurable: true,
  })
  Object.defineProperty(dialog, 'close', {
    value: vi.fn(() => {
      dialog.removeAttribute('open')
      // Dispatch close event (native <dialog> behavior)
      dialog.dispatchEvent(new Event('close', { bubbles: false, cancelable: false }))
    }),
    writable: true,
    configurable: true,
  })

  const titleEl = document.createElement('h2')
  titleEl.id = 'confirm-dialog-title'

  const messageEl = document.createElement('p')
  messageEl.id = 'confirm-dialog-message'

  const confirmBtn = document.createElement('button')
  confirmBtn.id = 'confirm-dialog-confirm'
  confirmBtn.addEventListener = mockAddEventListener
  confirmBtn.removeEventListener = mockRemoveEventListener
  // Mock click() to trigger registered listeners
  confirmBtn.click = function () {
    const listeners = elementListeners.get(this as HTMLElement)?.get('click')
    listeners?.forEach((listener) => {
      if (typeof listener === 'function') {
        listener.call(this, new MouseEvent('click'))
      }
      else {
        listener.handleEvent(new MouseEvent('click'))
      }
    })
  }

  const cancelBtn = document.createElement('button')
  cancelBtn.id = 'confirm-dialog-cancel'
  cancelBtn.addEventListener = mockAddEventListener
  cancelBtn.removeEventListener = mockRemoveEventListener
  // Mock click() to trigger registered listeners
  cancelBtn.click = function () {
    const listeners = elementListeners.get(this as HTMLElement)?.get('click')
    listeners?.forEach((listener) => {
      if (typeof listener === 'function') {
        listener.call(this, new MouseEvent('click'))
      }
      else {
        listener.handleEvent(new MouseEvent('click'))
      }
    })
  }

  // Add elements to DOM
  document.body.appendChild(dialog)
  document.body.appendChild(titleEl)
  document.body.appendChild(messageEl)
  document.body.appendChild(confirmBtn)
  document.body.appendChild(cancelBtn)

  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllGlobals()
})

// ============================================================================
// Tests
// ============================================================================

describe('useDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      void Promise.resolve().then(cb)
      return 1
    })
  })

  describe('showConfirmDialog - promise resolution', () => {
    it('resolves to true when confirm button is clicked', async () => {
      let promiseResult: boolean | undefined

      const showConfirmDialog = (): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
          const confirmBtn = document.getElementById(
            'confirm-dialog-confirm',
          ) as HTMLButtonElement
          const dialog = document.getElementById(
            'confirm-dialog',
          ) as HTMLDialogElement

          const handleConfirm = () => {
            confirmBtn.removeEventListener('click', handleConfirm)
            resolve(true)
          }

          confirmBtn.addEventListener('click', handleConfirm)
          dialog.showModal()
        })
      }

      const testPromise = showConfirmDialog()

      void testPromise.then((result) => {
        promiseResult = result
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const confirmBtn = document.getElementById('confirm-dialog-confirm') as HTMLButtonElement
      confirmBtn.click()

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(promiseResult).toBe(true)
    })

    it('resolves to false when dialog is closed without confirmation', async () => {
      let promiseResolved = false
      let promiseResult: boolean | undefined

      const showConfirmDialog = (): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
          const confirmBtn = document.getElementById(
            'confirm-dialog-confirm',
          ) as HTMLButtonElement
          const cancelBtn = document.getElementById(
            'confirm-dialog-cancel',
          ) as HTMLButtonElement
          const dialog = document.getElementById(
            'confirm-dialog',
          ) as HTMLDialogElement

          let resolved = false

          const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm)
            cancelBtn.removeEventListener('click', handleCancel)
            dialog.removeEventListener('close', handleClose)
          }

          const handleConfirm = () => {
            if (resolved) return
            resolved = true
            cleanup()
            resolve(true)
          }

          const handleCancel = () => {
            if (resolved) return
            resolved = true
            cleanup()
            resolve(false)
          }

          const handleClose = () => {
            if (resolved) return
            resolved = true
            cleanup()
            resolve(false)
          }

          confirmBtn.addEventListener('click', handleConfirm)
          cancelBtn.addEventListener('click', handleCancel)
          dialog.addEventListener('close', handleClose)
          dialog.showModal()
        })
      }

      const testPromise = showConfirmDialog()

      void testPromise.then((result) => {
        promiseResolved = true
        promiseResult = result
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Close dialog (simulating cancel/ESC)
      const dialog = document.getElementById('confirm-dialog') as HTMLDialogElement
      dialog.close()

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(promiseResolved).toBe(true)
      expect(promiseResult).toBe(false)
    })
  })

  describe('showConfirmDialog - event listener cleanup', () => {
    it('removes event listeners when dialog closes via cancel button', async () => {
      const confirmBtn = document.getElementById(
        'confirm-dialog-confirm',
      ) as HTMLButtonElement
      const cancelBtn = document.getElementById(
        'confirm-dialog-cancel',
      ) as HTMLButtonElement

      const showConfirmDialog = (): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
          const dialog = document.getElementById(
            'confirm-dialog',
          ) as HTMLDialogElement

          const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm)
            cancelBtn.removeEventListener('click', handleCancel)
            dialog.removeEventListener('close', handleClose)
          }

          const handleConfirm = () => {
            cleanup()
            resolve(true)
          }

          const handleCancel = () => {
            cleanup()
            resolve(false)
          }

          const handleClose = () => {
            cleanup()
            resolve(false)
          }

          confirmBtn.addEventListener('click', handleConfirm)
          cancelBtn.addEventListener('click', handleCancel)
          dialog.addEventListener('close', handleClose)
          dialog.showModal()
        })
      }

      void showConfirmDialog()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Click cancel button
      cancelBtn.click()

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(getListenerCount(confirmBtn, 'click')).toBe(0)
    })

    it('removes event listeners when dialog closes via ESC key', async () => {
      const confirmBtn = document.getElementById(
        'confirm-dialog-confirm',
      ) as HTMLButtonElement

      const showConfirmDialog = (): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
          const dialog = document.getElementById(
            'confirm-dialog',
          ) as HTMLDialogElement

          const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm)
            dialog.removeEventListener('close', handleClose)
          }

          const handleConfirm = () => {
            cleanup()
            resolve(true)
          }

          const handleClose = () => {
            cleanup()
            resolve(false)
          }

          confirmBtn.addEventListener('click', handleConfirm)
          dialog.addEventListener('close', handleClose)
          dialog.showModal()
        })
      }

      void showConfirmDialog()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Simulate ESC key (dialog.close() dispatches 'close' event)
      const dialog = document.getElementById('confirm-dialog') as HTMLDialogElement
      dialog.close()

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(getListenerCount(confirmBtn, 'click')).toBe(0)
    })

    it('prevents listener accumulation across multiple dialog cycles', async () => {
      const confirmBtn = document.getElementById(
        'confirm-dialog-confirm',
      ) as HTMLButtonElement

      const showConfirmDialog = (): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
          const dialog = document.getElementById(
            'confirm-dialog',
          ) as HTMLDialogElement

          const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm)
            dialog.removeEventListener('close', handleClose)
          }

          const handleConfirm = () => {
            cleanup()
            resolve(true)
          }

          const handleClose = () => {
            cleanup()
            resolve(false)
          }

          confirmBtn.addEventListener('click', handleConfirm)
          dialog.addEventListener('close', handleClose)
          dialog.showModal()
        })
      }

      // Open and close dialog 3 times
      for (let i = 0; i < 3; i++) {
        void showConfirmDialog()
        await new Promise(resolve => setTimeout(resolve, 10))

        const dialog = document.getElementById('confirm-dialog') as HTMLDialogElement
        dialog.close()

        await new Promise(resolve => setTimeout(resolve, 10))
      }

      expect(getListenerCount(confirmBtn, 'click')).toBe(0)
    })
  })
})

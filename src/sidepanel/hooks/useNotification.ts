/**
 * useNotification Hook
 *
 * Manages notification state for displaying temporary messages.
 * Replaces imperative showNotification() from services/ui.ts.
 */

import { useState } from '../../jsx-runtime/hooks/index.ts'

export type NotificationType = 'success' | 'error' | 'info'

export interface NotificationState {
  visible: boolean
  message: string
  type: NotificationType
}

const AUTO_HIDE_DURATION = 3000

/**
 * useNotification hook
 *
 * Provides notification state and control functions.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const notification, showNotification, hideNotification } = useNotification()
 *
 *   const handleClick = () => {
 *     showNotification('Saved successfully!', 'success')
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleClick}>Save</button>
 *       {notification.visible && (
 *         <div className={`notification notification--${notification.type}`}>
 *           {notification.message}
 *         </div>
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export function useNotification() {
  const [notification, setNotification] = useState<NotificationState>({
    visible: false,
    message: '',
    type: 'info',
  })

  let hideTimeout: number | null = null

  const showNotification = (message: string, type: NotificationType = 'info') => {
    // Clear any existing timeout
    if (hideTimeout !== null) {
      clearTimeout(hideTimeout)
    }

    setNotification({ visible: true, message, type })

    // Auto-hide after duration
    hideTimeout = window.setTimeout(() => {
      setNotification((prev) => ({ ...prev, visible: false }))
    }, AUTO_HIDE_DURATION)
  }

  const hideNotification = () => {
    if (hideTimeout !== null) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    setNotification((prev) => ({ ...prev, visible: false }))
  }

  return { notification, showNotification, hideNotification }
}

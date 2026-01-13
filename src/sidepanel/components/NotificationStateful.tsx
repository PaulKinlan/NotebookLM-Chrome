/**
 * NotificationStateful Component
 *
 * Displays temporary notification messages.
 * Uses useNotification hook to manage state internally.
 * Replaces imperative showNotification() from services/ui.ts.
 */

import { useNotification } from '../hooks/useNotification.ts'

/**
 * NotificationStateful Component
 *
 * Self-contained notification component that manages its own visibility.
 * Can be accessed globally via window.showNotification for imperative use.
 *
 * @example
 * ```tsx
 * function App() {
 *   return <NotificationStateful />
 * }
 *
 * // Imperative use (for legacy code)
 * window.showNotification('Saved successfully!', 'success')
 * ```
 */
export function NotificationStateful() {
  const { notification } = useNotification()

  if (!notification.visible) {
    return null
  }

  return (
    <div id="notification" className={`notification notification--${notification.type}`}>
      {notification.message}
    </div>
  )
}

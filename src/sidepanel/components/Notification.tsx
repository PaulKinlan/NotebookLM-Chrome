/**
 * Notification component
 *
 * Displays toast notifications. Uses the notification signal directly
 * from the store, so no props are needed.
 */

import { notification } from '../store'

export function Notification() {
  return (
    <div
      id="notification"
      className={`notification ${notification.value ? 'show' : 'hidden'}`}
    >
      {notification.value ?? ''}
    </div>
  )
}

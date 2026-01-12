interface NotificationProps {
  message?: string
  type?: 'success' | 'error' | 'info'
}

export function Notification(props: NotificationProps) {
  const { message, type = 'info' } = props

  if (!message) {
    return null
  }

  return (
    <div id="notification" className={`notification notification--${type}`}>
      {message}
    </div>
  )
}

import type { JSX } from 'preact'

interface RefreshButtonProps {
  /** Whether the button is in loading/refreshing state */
  isLoading: boolean
  /** Click handler for the button */
  onClick: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void
  /** Tooltip text for the button */
  title: string
  /** Optional id for the button element */
  id?: string
  /** Size of the icon in pixels (default: 14) */
  size?: number
  /** Additional CSS classes to apply */
  className?: string
  /** Whether the button is disabled (defaults to isLoading if not provided) */
  disabled?: boolean
  /** Button variant: 'default' includes btn classes, 'icon' uses only className */
  variant?: 'default' | 'icon'
  /** Optional aria-label for accessibility */
  ariaLabel?: string
}

/**
 * A reusable refresh/reload button with spinning animation when loading.
 * Uses consistent styling across the application.
 */
export function RefreshButton({
  isLoading,
  onClick,
  title,
  id,
  size = 14,
  className = '',
  disabled,
  variant = 'default',
  ariaLabel,
}: RefreshButtonProps): JSX.Element {
  const isDisabled = disabled ?? isLoading

  const buttonClasses = variant === 'default'
    ? `btn btn-small btn-outline refresh-button${isLoading ? ' refreshing' : ''}${className ? ` ${className}` : ''}`
    : `refresh-button${isLoading ? ' refreshing' : ''}${className ? ` ${className}` : ''}`

  return (
    <button
      id={id}
      className={buttonClasses}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={isDisabled}
      type="button"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={isLoading ? 'spin' : ''}
      >
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  )
}

/**
 * SourcesList Component
 *
 * Displays sources for the current notebook with removal capability.
 * Uses the useSources hook for state management.
 */

import { useSources } from '../hooks/useSources.ts'
import type { Source } from '../../types/index.ts'

interface SourcesListProps {
  notebookId: string | null
  onRemoveSource: (sourceId: string) => void
  limit?: number
}

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  }
  catch {
    return url
  }
}

/**
 * SVG icons as components
 */
function ExternalIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  )
}

function RemoveIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
}

/**
 * Individual source item component
 */
interface SourceItemProps {
  key?: string // JSX key prop, extracted by runtime
  source: Source
  onRemove: (id: string) => void
}

function SourceItem({ source, onRemove }: SourceItemProps): JSX.Element {
  const domain = extractDomain(source.url)
  const initial = source.title.charAt(0).toUpperCase()

  const handleRemove = (e: Event) => {
    e.stopPropagation()
    onRemove(source.id)
  }

  return (
    <div className="source-item" data-source-id={source.id}>
      <div className="source-icon">{initial}</div>
      <div className="source-info">
        <div className="source-title">
          <span className="source-title-text">{source.title}</span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-external"
            title="Open in new tab"
          >
            {ExternalIcon()}
          </a>
        </div>
        <div className="source-url">{domain}</div>
      </div>
      <div className="source-actions">
        <button
          className="icon-btn btn-remove"
          onClick={handleRemove}
          title="Remove"
          type="button"
        >
          {RemoveIcon()}
        </button>
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
interface EmptyStateProps {
  message: string
}

function EmptyState({ message }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  )
}

/**
 * SourcesList Component
 *
 * Renders a list of sources with remove functionality.
 * Can be rendered in compact mode (for chat tab) or full mode.
 */
export function SourcesList({ notebookId, onRemoveSource, limit }: SourcesListProps): JSX.Element {
  const { sources, isLoading, error } = useSources(notebookId)

  // Handle empty notebook case
  if (!notebookId) {
    return <EmptyState message="Select or create a notebook to add sources." />
  }

  // Handle loading state
  if (isLoading) {
    return <EmptyState message="Loading sources..." />
  }

  // Handle error state
  if (error) {
    return (
      <div className="error-state">
        <p>
          Error:
          {' '}
          {error}
        </p>
      </div>
    )
  }

  // Apply limit if specified (for showing recent sources)
  const displayedSources = limit ? sources.slice(0, limit) : sources

  // Handle empty sources
  if (displayedSources.length === 0) {
    return <EmptyState message="No sources added yet." />
  }

  // Render source items
  return (
    <>
      {displayedSources.map(source => (
        <SourceItem
          key={source.id}
          source={source}
          onRemove={onRemoveSource}
        />
      ))}
    </>
  )
}

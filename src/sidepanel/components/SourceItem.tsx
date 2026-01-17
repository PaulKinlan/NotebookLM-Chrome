import type { Source } from '../../types/index.ts'

interface SourceItemProps {
  source: Source
  onRemove?: (sourceId: string) => void
  onOpenInNewTab?: (url: string) => void
}

export function SourceItem(props: SourceItemProps) {
  const { source, onRemove, onOpenInNewTab } = props

  const handleOpenInNewTab = () => {
    if (source.url) {
      if (onOpenInNewTab) {
        onOpenInNewTab(source.url)
      }
      else {
        window.open(source.url, '_blank')
      }
    }
  }

  const maxLength = 60
  const truncatedTitle = source.title.length > maxLength
    ? source.title.slice(0, maxLength) + '...'
    : source.title

  // Source icon based on type
  const renderIcon = () => {
    switch (source.type) {
      case 'tab':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
          </svg>
        )
      case 'bookmark':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        )
      case 'history':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        )
      case 'manual':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        )
      case 'text':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        )
      case 'note':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        )
      case 'image':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        )
    }
  }

  // Render thumbnail for image sources
  const renderThumbnail = () => {
    if (source.type !== 'image') return null

    const thumbnailUrl = source.metadata?.thumbnailUrl || source.metadata?.imageUrl || source.url
    if (!thumbnailUrl) return null

    return (
      <div className="source-thumbnail">
        <img
          src={thumbnailUrl}
          alt={source.title}
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement
            img.style.display = 'none'
          }}
        />
      </div>
    )
  }

  // Get subtitle text (URL for links, type label for notes)
  const getSubtitle = () => {
    if (source.type === 'note') {
      return 'Note'
    }
    if (source.type === 'image') {
      const dims = source.metadata?.dimensions
      return dims ? `Image (${dims.width}×${dims.height})` : 'Image'
    }
    return source.url
  }

  return (
    <div className={`source-item ${source.type === 'image' ? 'source-item-with-thumbnail' : ''}`} data-source-id={source.id}>
      {renderThumbnail()}
      <div className="source-icon">{renderIcon()}</div>
      <div className="source-content">
        <div className="source-title" title={source.title}>{truncatedTitle}</div>
        <div className="source-url">{getSubtitle()}</div>
      </div>
      <div className="source-actions">
        {source.url && (
          <button
            className="source-action-btn"
            title="Open in new tab"
            onClick={handleOpenInNewTab}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            className="source-action-btn source-remove-btn"
            data-source-id={source.id}
            title="Remove source"
            onClick={() => void onRemove(source.id)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

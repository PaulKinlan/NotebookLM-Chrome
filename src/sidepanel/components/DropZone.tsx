/**
 * DropZone Component
 *
 * Provides a visual drop target overlay that appears when users drag
 * text, links, or selections from web pages into the side panel.
 * Supports adding dropped content as sources to the active notebook.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks'

interface DropZoneProps {
  onDropLinks: (links: Array<{ url: string, title: string }>) => void
  onDropText: (text: string) => void
  disabled?: boolean
}

export function DropZone({ onDropLinks, onDropText, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  // Extract URLs from dropped content
  const extractUrls = useCallback((text: string): Array<{ url: string, title: string }> => {
    const urls: Array<{ url: string, title: string }> = []

    // Match URLs with common protocols
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
    const matches = text.match(urlRegex)

    if (matches) {
      for (const url of matches) {
        // Clean up trailing punctuation that might have been captured
        const cleanUrl = url.replace(/[.,;:!?]+$/, '')
        if (!urls.some(u => u.url === cleanUrl)) {
          urls.push({ url: cleanUrl, title: cleanUrl })
        }
      }
    }

    return urls
  }, [])

  // Parse HTML content for links
  const extractLinksFromHtml = useCallback((html: string): Array<{ url: string, title: string }> => {
    const links: Array<{ url: string, title: string }> = []

    // Use DOMParser to safely parse HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const anchors = doc.querySelectorAll('a[href]')

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href')
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        const title = anchor.textContent?.trim() || href
        if (!links.some(l => l.url === href)) {
          links.push({ url: href, title })
        }
      }
    }

    return links
  }, [])

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (disabled) return

    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current++
    setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (disabled) return

    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [disabled])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (disabled) return

    e.preventDefault()
    e.stopPropagation()

    // Set the drop effect to indicate this is a valid drop target
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [disabled])

  const handleDrop = useCallback((e: DragEvent) => {
    if (disabled) return

    e.preventDefault()
    e.stopPropagation()

    setIsDragging(false)
    dragCounterRef.current = 0

    if (!e.dataTransfer) return

    const links: Array<{ url: string, title: string }> = []

    // Try to get HTML content first (preserves link titles)
    const html = e.dataTransfer.getData('text/html')
    if (html) {
      const htmlLinks = extractLinksFromHtml(html)
      links.push(...htmlLinks)
    }

    // Also check for uri-list (direct link drops)
    const uriList = e.dataTransfer.getData('text/uri-list')
    if (uriList) {
      const uris = uriList.split('\n').filter(line => !line.startsWith('#'))
      for (const uri of uris) {
        const trimmedUri = uri.trim()
        if (trimmedUri && !links.some(l => l.url === trimmedUri)) {
          links.push({ url: trimmedUri, title: trimmedUri })
        }
      }
    }

    // Get plain text content
    const text = e.dataTransfer.getData('text/plain')

    // If we have links from HTML or uri-list, use those
    if (links.length > 0) {
      onDropLinks(links)
      return
    }

    // Otherwise, try to extract URLs from plain text
    if (text) {
      const textLinks = extractUrls(text)

      if (textLinks.length > 0) {
        // If we found URLs in the text, add them as links
        onDropLinks(textLinks)
      }
      else if (text.trim().length > 0) {
        // No URLs found, add as text content
        onDropText(text.trim())
      }
    }
  }, [disabled, extractLinksFromHtml, extractUrls, onDropLinks, onDropText])

  // Set up global drag event listeners
  useEffect(() => {
    if (disabled) return

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [disabled, handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  if (!isDragging) {
    return null
  }

  return (
    <div
      className="drop-zone-overlay"
      role="dialog"
      aria-label="Drop zone for adding sources to notebook"
      aria-live="polite"
    >
      <div className="drop-zone-content">
        <div className="drop-zone-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            role="img"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="drop-zone-text">
          <span className="drop-zone-title">Drop to add source</span>
          <span className="drop-zone-hint">Links and text will be added to your notebook</span>
        </div>
      </div>
    </div>
  )
}

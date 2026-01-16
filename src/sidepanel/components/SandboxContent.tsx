/**
 * SandboxContent Component
 *
 * Renders content in a sandboxed iframe for security.
 * Used to display transform results with proper HTML rendering.
 */

import { useRef, useEffect, useState } from 'preact/hooks'
import { SandboxRenderer } from '../../lib/sandbox-renderer'
import { renderMarkdown } from '../../lib/markdown-renderer'

interface SandboxContentProps {
  /** The content to render */
  content: string
  /** Whether this is interactive HTML content (quiz, flashcards, etc.) */
  isInteractive: boolean
  /** Maximum height for the sandbox (defaults to 300px for markdown, 500px for interactive) */
  maxHeight?: number
  /** Class name for the container */
  className?: string
}

export function SandboxContent(props: SandboxContentProps) {
  const { content, isInteractive, className = '' } = props
  // Use larger height for interactive content (quizzes, flashcards, etc.)
  const defaultMaxHeight = isInteractive ? 500 : 300
  const maxHeight = props.maxHeight ?? defaultMaxHeight
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SandboxRenderer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clean up previous renderer if exists
    if (rendererRef.current) {
      rendererRef.current.destroy()
      rendererRef.current = null
    }

    // Create new renderer
    const renderer = new SandboxRenderer(container)
    rendererRef.current = renderer

    // Render content
    const renderContent = async () => {
      setLoading(true)
      setError(null)

      try {
        await renderer.waitForReady()

        if (isInteractive) {
          // Interactive content (quiz, flashcards, etc.)
          await renderer.renderInteractive(content)
        } else {
          // Markdown content - convert to HTML first
          const html = renderMarkdown(content)
          await renderer.render(html)
        }
      } catch (err) {
        console.error('[SandboxContent] Render error:', err)
        setError(err instanceof Error ? err.message : 'Failed to render content')
      } finally {
        setLoading(false)
      }
    }

    void renderContent()

    // Cleanup on unmount
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
    }
  }, [content, isInteractive])

  return (
    <div
      ref={containerRef}
      className={`sandbox-content-container ${className}`}
      style={{ maxHeight: `${maxHeight}px`, overflow: 'auto' }}
    >
      {loading && (
        <div className="sandbox-loading">
          <span className="loading-spinner"></span>
          <span>Rendering content...</span>
        </div>
      )}
      {error && (
        <div className="sandbox-error">
          <p>Failed to render: {error}</p>
        </div>
      )}
    </div>
  )
}

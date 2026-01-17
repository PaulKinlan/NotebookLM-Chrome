import { useEffect, useRef } from 'preact/hooks'

interface NotebookDialogProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialName: string
  onClose: () => void
  onCreateNotebook: (name: string) => Promise<unknown>
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: string | null
  message: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Notebook Dialog component
 *
 * Uses refs to call showModal()/close() and inline handlers for buttons.
 * Creates notebooks through the onCreateNotebook callback prop.
 */
export function NotebookDialog(props: NotebookDialogProps) {
  const { isOpen, mode, initialName, onClose, onCreateNotebook } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Show/hide dialog when isOpen changes
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Focus input after dialog opens
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
    else {
      dialog.close()
    }
  }, [isOpen])

  // Set initial name value
  useEffect(() => {
    if (inputRef.current && initialName) {
      inputRef.current.value = initialName
    }
  }, [initialName])

  const handleConfirm = async () => {
    const name = inputRef.current?.value.trim()
    if (!name) return

    if (mode === 'create') {
      await onCreateNotebook(name)

      // Wait for Preact to flush state updates to DOM
      // Use multiple RAFs + setTimeout to ensure render cycle completes
      await new Promise((resolve) => {
        setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve(undefined))
          })
        }, 0)
      })
    }
    // Edit mode not implemented yet

    inputRef.current!.value = ''
    onClose()
  }

  const handleCancel = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleConfirm()
    }
  }

  return (
    <dialog id="notebook-dialog" ref={dialogRef} className="dialog">
      <h3 id="notebook-dialog-title">{mode === 'create' ? 'New Notebook' : 'Edit Notebook'}</h3>
      <input
        type="text"
        id="notebook-name-input"
        ref={inputRef}
        placeholder="Enter notebook name..."
        defaultValue={initialName}
        onKeyDown={handleKeyDown}
      />
      <div className="dialog-actions">
        <button id="notebook-dialog-cancel" className="btn btn-outline" onClick={handleCancel}>
          Cancel
        </button>
        <button id="notebook-dialog-confirm" className="btn btn-primary" onClick={() => void handleConfirm()}>
          {mode === 'create' ? 'Create' : 'Save'}
        </button>
      </div>
    </dialog>
  )
}

/**
 * Confirm Dialog component
 *
 * Uses refs to call showModal()/close() and inline handlers for buttons.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { isOpen, title, message, onConfirm, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Show/hide dialog when isOpen changes
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    }
    else {
      dialog.close()
    }
  }, [isOpen])

  return (
    <dialog id="confirm-dialog" ref={dialogRef} className="dialog">
      <h3 id="confirm-dialog-title">{title ?? 'Confirm'}</h3>
      <p id="confirm-dialog-message">{message ?? ''}</p>
      <div className="dialog-actions">
        <button id="confirm-dialog-cancel" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button id="confirm-dialog-confirm" className="btn btn-danger" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </dialog>
  )
}

/**
 * Picker Modal Props
 */
interface PickerModalProps {
  isOpen: boolean
  title: string
  items: Array<{
    id: string
    title: string
    url?: string
    domain?: string
    favicon?: string
    selected: boolean
  }>
  isLoading: boolean
  searchQuery: string
  selectedCount: number
  onClose: () => void
  onSearchChange: (query: string) => void
  onToggleItem: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onAddSelected: () => void
}

/**
 * Picker Modal component
 *
 * Modal for selecting items (tabs, bookmarks, history) to add as sources.
 */
export function PickerModal(props: PickerModalProps) {
  const {
    isOpen,
    title,
    items,
    isLoading,
    searchQuery,
    selectedCount,
    onClose,
    onSearchChange,
    onToggleItem,
    onSelectAll,
    onDeselectAll,
    onAddSelected,
  } = props

  if (!isOpen) {
    return null
  }

  return (
    <div id="picker-modal" className="modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="picker-title">{title}</h3>
          <button id="picker-close" className="icon-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            id="picker-search"
            placeholder="Search..."
            value={searchQuery}
            onInput={e => onSearchChange((e.target as HTMLInputElement).value)}
          />
        </div>
        <div className="picker-select-actions">
          <button className="btn btn-small btn-outline" onClick={onSelectAll}>Select All</button>
          <button className="btn btn-small btn-outline" onClick={onDeselectAll}>Deselect All</button>
        </div>
        <div id="picker-list" className="picker-list">
          {isLoading
            ? (
                <div className="picker-loading">
                  <span className="loading-spinner"></span>
                  <span>Loading...</span>
                </div>
              )
            : items.length === 0
              ? (
                  <div className="picker-empty">
                    <p>No items found</p>
                  </div>
                )
              : (
                  items.map(item => (
                    <div
                      key={item.id}
                      className={`picker-item ${item.selected ? 'selected' : ''}`}
                      onClick={() => onToggleItem(item.id)}
                    >
                      <div className="picker-checkbox">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div className="picker-icon">
                        {item.favicon
                          ? (
                              <img
                                src={item.favicon}
                                alt=""
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement
                                  img.style.display = 'none'
                                  if (img.parentNode) {
                                    img.parentNode.textContent = item.title.charAt(0).toUpperCase()
                                  }
                                }}
                              />
                            )
                          : (
                              item.title.charAt(0).toUpperCase()
                            )}
                      </div>
                      <div className="picker-info">
                        <div className="picker-title">{item.title}</div>
                        {item.domain && <div className="picker-url">{item.domain}</div>}
                      </div>
                    </div>
                  ))
                )}
        </div>
        <div className="modal-footer">
          <span id="picker-selected-count">{`${selectedCount} selected`}</span>
          <div className="modal-actions">
            <button id="picker-cancel" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button
              id="picker-add"
              className="btn btn-primary"
              onClick={onAddSelected}
              disabled={selectedCount === 0}
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Add Note Dialog Props
 */
interface AddNoteDialogProps {
  isOpen: boolean
  onClose: () => void
  onAddNote: (title: string, content: string) => Promise<void>
}

/**
 * Add Note Dialog component
 *
 * Modal dialog for creating a user note source.
 */
export function AddNoteDialog(props: AddNoteDialogProps) {
  const { isOpen, onClose, onAddNote } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Show/hide dialog when isOpen changes
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Focus title input after dialog opens
      requestAnimationFrame(() => {
        titleRef.current?.focus()
      })
    }
    else {
      // Guard against closing unmounted dialogs
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  const handleConfirm = async () => {
    const title = titleRef.current?.value.trim() || 'Untitled Note'
    const content = contentRef.current?.value.trim()

    if (!content) {
      contentRef.current?.focus()
      return
    }

    await onAddNote(title, content)

    // Clear inputs
    if (titleRef.current) titleRef.current.value = ''
    if (contentRef.current) contentRef.current.value = ''
    onClose()
  }

  const handleCancel = () => {
    if (titleRef.current) titleRef.current.value = ''
    if (contentRef.current) contentRef.current.value = ''
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      void handleConfirm()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <dialog id="add-note-dialog" ref={dialogRef} className="dialog dialog-large">
      <h3>Add Note</h3>
      <input
        type="text"
        ref={titleRef}
        placeholder="Note title (optional)"
        onKeyDown={handleKeyDown}
        className="note-title-input"
      />
      <textarea
        ref={contentRef}
        placeholder="Write your note content here..."
        rows={8}
        onKeyDown={handleKeyDown}
        className="note-content-input"
      />
      <p className="dialog-hint">Press Ctrl+Enter to save</p>
      <div className="dialog-actions">
        <button className="btn btn-outline" onClick={handleCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => void handleConfirm()}>
          Add Note
        </button>
      </div>
    </dialog>
  )
}

/**
 * Image Picker Modal Props
 */
interface ImagePickerModalProps {
  isOpen: boolean
  images: Array<{
    src: string
    alt: string
    width: number
    height: number
    selected: boolean
  }>
  isLoading: boolean
  selectedCount: number
  onClose: () => void
  onToggleImage: (src: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onAddSelected: () => void
}

/**
 * Image Picker Modal component
 *
 * Modal for selecting images from the current page to add as sources.
 */
export function ImagePickerModal(props: ImagePickerModalProps) {
  const {
    isOpen,
    images,
    isLoading,
    selectedCount,
    onClose,
    onToggleImage,
    onSelectAll,
    onDeselectAll,
    onAddSelected,
  } = props

  if (!isOpen) {
    return null
  }

  return (
    <div id="image-picker-modal" className="modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content modal-content-large">
        <div className="modal-header">
          <h3>Select Images from Page</h3>
          <button className="icon-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="picker-select-actions">
          <button className="btn btn-small btn-outline" onClick={onSelectAll}>Select All</button>
          <button className="btn btn-small btn-outline" onClick={onDeselectAll}>Deselect All</button>
        </div>
        <div className="image-picker-grid">
          {isLoading
            ? (
                <div className="picker-loading">
                  <span className="loading-spinner"></span>
                  <span>Scanning page for images...</span>
                </div>
              )
            : images.length === 0
              ? (
                  <div className="picker-empty">
                    <p>No images found on this page</p>
                  </div>
                )
              : (
                  images.map(image => (
                    <div
                      key={image.src}
                      className={`image-picker-item ${image.selected ? 'selected' : ''}`}
                      onClick={() => onToggleImage(image.src)}
                      title={image.alt || 'Image'}
                    >
                      <div className="image-picker-checkbox">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <img
                        src={image.src}
                        alt={image.alt}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.parentElement?.classList.add('image-error')
                        }}
                      />
                      <div className="image-picker-info">
                        <span className="image-dimensions">
                          {image.width}
                          ×
                          {image.height}
                        </span>
                      </div>
                    </div>
                  ))
                )}
        </div>
        <div className="modal-footer">
          <span>{`${selectedCount} image${selectedCount !== 1 ? 's' : ''} selected`}</span>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={onAddSelected}
              disabled={selectedCount === 0}
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

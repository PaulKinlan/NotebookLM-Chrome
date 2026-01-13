/**
 * useFuzzyDropdown Hook
 *
 * Provides fuzzy search dropdown functionality.
 * Converts the imperative FuzzyDropdown class to a hooks-based approach.
 */

import { useState, useRef, useEffect } from '../../jsx-runtime/hooks/index.ts'

export interface FuzzyDropdownOption {
  id: string
  label: string
  subtitle?: string
  group?: string
}

export interface UseFuzzyDropdownOptions {
  /** Available options */
  options: FuzzyDropdownOption[]
  /** Callback when option is selected */
  onSelect: (option: FuzzyDropdownOption) => void
  /** Callback when dropdown is opened/closed */
  onToggle?: (open: boolean) => void
  /** Whether custom values (not in options) are allowed. Default: true */
  allowCustom?: boolean
  /** Initial selected value */
  initialValue?: string
  /** Placeholder text for the input */
  placeholder?: string
}

export interface UseFuzzyDropdownReturn {
  // State
  isOpen: boolean
  inputValue: string
  highlightedIndex: number
  filteredOptions: Array<{ option: FuzzyDropdownOption, score: number }>

  // Actions
  open: () => void
  close: () => void
  toggle: () => void
  setInputValue: (value: string) => void
  setOptionById: (id: string) => void
  handleKeyDown: (e: KeyboardEvent) => void
  handleInput: (value: string) => void
  selectOption: (option: FuzzyDropdownOption) => void

  // Internal
  _inputRef: { current: HTMLInputElement | null }
  _menuRef: { current: HTMLElement | null }
}

/**
 * Simple fuzzy match scoring
 * Returns: 2 for exact match, 1 for starts with, 0 for contains, -1 for no match
 */
function fuzzyMatch(text: string, query: string): number | null {
  if (!query) return 1
  const lower = text.toLowerCase()
  if (lower === query) return 2
  if (lower.startsWith(query)) return 1
  if (lower.includes(query)) return 0
  return -1
}

/**
 * Filter and score options based on query
 */
function filterOptions(options: FuzzyDropdownOption[], query: string): Array<{ option: FuzzyDropdownOption, score: number }> {
  const lowerQuery = query.toLowerCase()

  return options.map(option => ({
    option,
    score: fuzzyMatch(option.label, lowerQuery) ?? (option.subtitle ? fuzzyMatch(option.subtitle, lowerQuery) ?? -1 : -1),
  })).sort((a, b) => {
    // Sort by score descending
    if (a.score !== b.score) return b.score - a.score
    // Then by group
    if (a.option.group !== b.option.group) {
      // Ungrouped items come last
      if (!a.option.group) return 1
      if (!b.option.group) return -1
    }
    // Then by label
    return a.option.label.localeCompare(b.option.label)
  })
}

/**
 * useFuzzyDropdown hook
 */
export function useFuzzyDropdown(options: UseFuzzyDropdownOptions): UseFuzzyDropdownReturn {
  const {
    options: allOptions,
    onSelect,
    onToggle,
    allowCustom = true,
    initialValue = '',
  } = options

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(initialValue)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedId, setSelectedId] = useState(initialValue)
  const [savedInputValue, setSavedInputValue] = useState(initialValue)
  const [selectionMade, setSelectionMade] = useState(false)

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLElement | null>(null)

  // Current filtered options
  const [filteredOptions, setFilteredOptions] = useState<Array<{ option: FuzzyDropdownOption, score: number }>>([])

  /**
   * Filter options based on current input
   */
  function applyFilter(query: string) {
    if (allOptions.length === 0) {
      setFilteredOptions([])
      return
    }

    const scored = filterOptions(allOptions, query)
    const filtered = query ? scored.filter(s => s.score >= 0) : scored
    setFilteredOptions(filtered)
    setHighlightedIndex(-1)
  }

  /**
   * Open the dropdown
   */
  function open() {
    // Save current input value before clearing
    if (!savedInputValue) {
      setSavedInputValue(inputValue)
    }

    setInputValue('')
    setSelectionMade(false)
    setIsOpen(true)
    setHighlightedIndex(-1)
    applyFilter('')
    onToggle?.(true)

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  /**
   * Close the dropdown
   */
  function close() {
    if (!isOpen) return

    // Restore saved value if no selection was made
    if (!selectionMade) {
      setInputValue(savedInputValue)
    }
    else {
      // Update saved value to the new selection
      const currentOption = allOptions.find(o => o.id === selectedId)
      setSavedInputValue(currentOption?.label || inputValue)
    }

    setSelectionMade(false)
    setIsOpen(false)
    setHighlightedIndex(-1)
    onToggle?.(false)
  }

  /**
   * Toggle dropdown open/closed
   */
  function toggle() {
    if (isOpen) {
      close()
    }
    else {
      open()
    }
  }

  /**
   * Select an option
   */
  function selectOption(option: FuzzyDropdownOption) {
    setSelectionMade(true)
    setSelectedId(option.id)
    setInputValue(option.label)
    onSelect(option)
    close()
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeyDown(e: KeyboardEvent) {
    const items = filteredOptions

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (items.length === 0) return
        setHighlightedIndex(Math.min(highlightedIndex + 1, items.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        if (items.length === 0) return
        setHighlightedIndex(Math.max(highlightedIndex - 1, 0))
        break

      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          selectOption(items[highlightedIndex].option)
        }
        else if (inputValue.trim()) {
          if (allowCustom) {
            // Accept custom value
            setSelectionMade(true)
            setSelectedId(inputValue.trim())
            onSelect({
              id: inputValue.trim(),
              label: inputValue.trim(),
            })
            close()
          }
          else {
            // Show invalid state
            inputRef.current?.classList.add('form-input-invalid')
          }
        }
        break

      case 'Escape':
        close()
        break
    }
  }

  /**
   * Handle input changes
   */
  function handleInput(value: string) {
    // Clear invalid state when user types
    inputRef.current?.classList.remove('form-input-invalid')

    // Ensure menu is open when typing
    if (!isOpen) {
      setIsOpen(true)
    }

    setInputValue(value)
    applyFilter(value)
  }

  /**
   * Set option by ID (programmatic selection)
   */
  function setOptionById(id: string) {
    setSelectedId(id)
    const option = allOptions.find(o => o.id === id)
    setInputValue(option?.label || id)
    setSavedInputValue(option?.label || id)
  }

  // Update filtered options when all options change
  useEffect(() => {
    if (isOpen) {
      applyFilter(inputValue)
    }
  }, [allOptions, isOpen])

  return {
    isOpen,
    inputValue,
    highlightedIndex,
    filteredOptions,
    open,
    close,
    toggle,
    setInputValue: (value: string) => {
      setInputValue(value)
      inputRef.current?.classList.remove('form-input-invalid')
    },
    setOptionById,
    handleKeyDown,
    handleInput,
    selectOption,
    _inputRef: inputRef,
    _menuRef: menuRef,
  }
}

/**
 * Reusable Fuzzy Search Dropdown Component
 *
 * Provides a consistent dropdown interface with:
 * - Fuzzy search/filtering
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Visual highlighting
 * - Two-column display (label + subtitle)
 */

import type { SelectableModel } from '../lib/provider-registry.ts'

interface DropdownOption {
  id: string
  label: string
  subtitle?: string
  group?: string
}

interface DropdownConfig {
  /** Container element for the dropdown */
  container: HTMLElement
  /** Current value (pre-selected option) */
  currentValue?: string
  /** Placeholder text for the input */
  placeholder?: string
  /** Optional group header for all items */
  group?: string
  /** Callback when option is selected */
  onSelect: (option: DropdownOption) => void
  /** Callback when dropdown is opened/closed */
  onToggle?: (open: boolean) => void
  /** Whether custom values (not in options) are allowed. Default: true */
  allowCustom?: boolean
}

export class FuzzyDropdown {
  private container: HTMLElement
  private input!: HTMLInputElement
  private toggleBtn!: HTMLButtonElement
  private menu!: HTMLElement
  private onSelect: (option: DropdownOption) => void
  private onToggle?: (open: boolean) => void
  private isOpen: boolean = false
  private highlightedIndex: number = -1
  private options: DropdownOption[] = []
  private selectedId: string = ''
  private savedInputValue: string = ''
  private allowCustom: boolean
  private selectionMade: boolean = false

  constructor(config: DropdownConfig) {
    this.container = config.container
    this.onSelect = config.onSelect
    this.onToggle = config.onToggle
    this.allowCustom = config.allowCustom ?? true
    this.options = []

    this.render(config.placeholder, config.currentValue)
    this.setupEventListeners()
  }

  /**
   * Render the dropdown HTML structure
   */
  private render(placeholder?: string, currentValue?: string): void {
    this.container.innerHTML = `
      <div class="fuzzy-dropdown">
        <input type="text" class="fuzzy-dropdown-input form-input"
               placeholder="${placeholder || 'Type to search...'}"
               autocomplete="off"
               value="${currentValue || ''}"
               aria-expanded="false" />
        <button type="button" class="fuzzy-dropdown-toggle" aria-label="Toggle options list">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M4 6l4 4 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="fuzzy-dropdown-menu dropdown-menu" hidden></div>
      </div>
    `

    const inputEl = this.container.querySelector('.fuzzy-dropdown-input')
    const toggleBtnEl = this.container.querySelector('.fuzzy-dropdown-toggle')
    const menuEl = this.container.querySelector('.fuzzy-dropdown-menu')

    if (!(inputEl instanceof HTMLInputElement)) {
      throw new Error('Input element not found')
    }
    if (!(toggleBtnEl instanceof HTMLButtonElement)) {
      throw new Error('Toggle button not found')
    }
    if (!(menuEl instanceof HTMLElement)) {
      throw new Error('Menu element not found')
    }

    this.input = inputEl
    this.toggleBtn = toggleBtnEl
    this.menu = menuEl

    // Initialize savedInputValue with the current display value
    // This ensures we have a fallback value even if dropdown is never opened
    if (currentValue) {
      this.savedInputValue = currentValue
    }
  }

  /**
   * Set up event listeners for user interactions
   */
  private setupEventListeners(): void {
    // Toggle dropdown on button click
    this.toggleBtn.addEventListener('click', () => this.toggleDropdown())

    // Toggle dropdown on input focus
    this.input.addEventListener('focus', () => this.open())

    // Handle input changes (fuzzy filter)
    this.input.addEventListener('input', () => {
      this.clearInvalid() // Clear error state when user types
      // Ensure menu is open when typing
      if (!this.isOpen) {
        this.isOpen = true
        this.menu.hidden = false
        this.input.setAttribute('aria-expanded', 'true')
      }
      this.filter(this.input.value)
    })

    // Handle keyboard navigation
    this.input.addEventListener('keydown', e => this.handleKeydown(e))

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target
      // Don't close if clicking within the dropdown container
      if (!(target instanceof Node)) return
      if (this.container.contains(target)) {
        return
      }
      // Don't close if clicking on another form input in the same parent card
      // This prevents the dropdown from closing when clicking between related form fields
      const parentCard = this.container.closest('.profile-card, .form-group')
      if (parentCard && parentCard.contains(target)) {
        const isFormInput = target instanceof HTMLElement && (
          target.classList.contains('form-input')
          || target.classList.contains('password-toggle')
          || target.tagName === 'BUTTON'
          || target.closest('.model-dropdown, .password-input-wrapper')
        )
        if (isFormInput) {
          return // Don't close when clicking related form elements
        }
      }
      this.close()
    })

    // Handle option selection
    this.menu.addEventListener('click', (e) => {
      if (!(e.target instanceof Node)) return
      const item = e.target instanceof HTMLElement
        ? e.target.closest('.dropdown-item')
        : null
      if (item instanceof HTMLElement) {
        const value = item.dataset.value
        const option = this.options.find(o => o.id === value)
        if (option) {
          this.selectOption(option)
        }
      }
    })
  }

  /**
   * Open the dropdown
   */
  open(): void {
    // Save current input value before clearing (for restore on close/abandon)
    if (!this.savedInputValue) {
      this.savedInputValue = this.input.value
    }

    // Clear input for searching, but preserve saved value for restore
    this.input.value = ''
    this.selectionMade = false
    this.clearInvalid()
    this.isOpen = true
    this.menu.hidden = false
    this.input.setAttribute('aria-expanded', 'true')
    this.highlightedIndex = -1
    this.filter('')
    this.onToggle?.(true)
  }

  /**
   * Close the dropdown
   */
  close(): void {
    // If already closed, don't process again (prevents clearing value on external clicks)
    if (!this.isOpen) {
      return
    }

    // Only restore saved value if no selection was made (user abandoned)
    if (!this.selectionMade) {
      this.input.value = this.savedInputValue
    }
    else {
      // Selection was made - update saved value to the new selection for future restores
      const currentOption = this.options.find(o => o.id === this.selectedId)
      // Only update saved value if we found a matching option, otherwise keep current input value
      if (currentOption) {
        this.savedInputValue = currentOption.label
      }
      else {
        this.savedInputValue = this.input.value
      }
    }
    this.selectionMade = false
    this.clearInvalid()
    this.isOpen = false
    this.menu.hidden = true
    this.input.setAttribute('aria-expanded', 'false')
    this.highlightedIndex = -1
    this.onToggle?.(false)
  }

  /**
   * Toggle dropdown open/closed
   */
  toggleDropdown(): void {
    if (this.isOpen) {
      this.close()
    }
    else {
      this.open()
    }
  }

  /**
   * Set available options
   */
  setOptions(options: DropdownOption[]): void {
    this.options = options
    if (this.isOpen) {
      this.filter(this.input.value)
    }
  }

  /**
   * Filter and render options based on query
   */
  private filter(query: string): void {
    this.menu.innerHTML = ''
    this.highlightedIndex = -1

    if (this.options.length === 0) {
      this.renderEmpty()
      return
    }

    const lowerQuery = query.toLowerCase()
    const scored = this.options.map(option => ({
      option,
      score: this.fuzzyMatch(option.label, lowerQuery) ?? (option.subtitle ? this.fuzzyMatch(option.subtitle, lowerQuery) ?? -1 : -1),
    }))

    // Sort by score (descending), then by label, then by group (to keep groups together)
    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.option.group !== b.option.group) {
        // Ungrouped items come last
        if (!a.option.group) return 1
        if (!b.option.group) return -1
        // Keep original order of groups by their first appearance
        const aGroupIndex = this.options.findIndex(o => o.group === a.option.group)
        const bGroupIndex = this.options.findIndex(o => o.group === b.option.group)
        return aGroupIndex - bGroupIndex
      }
      return a.option.label.localeCompare(b.option.label)
    })

    // Show all options if query is empty, otherwise only show matches
    const filtered = query ? scored.filter(s => s.score >= 0) : scored

    if (filtered.length === 0) {
      this.renderNoResults()
      return
    }

    // Group items and render with headers
    const grouped = this.groupFilteredOptions(filtered)

    // Count items per group to skip headers for single-item groups
    const groupCounts = new Map<string, number>()
    for (const { option } of grouped) {
      if (option.group) {
        groupCounts.set(option.group, (groupCounts.get(option.group) || 0) + 1)
      }
    }

    let currentGroup: string | undefined

    for (let i = 0; i < grouped.length; i++) {
      const { option, score } = grouped[i]
      const nextOption = grouped[i + 1]?.option

      // Render group header when group changes, but skip for single-item groups
      if (option.group !== currentGroup) {
        currentGroup = option.group
        if (currentGroup && (groupCounts.get(currentGroup) || 0) > 1) {
          this.menu.appendChild(this.renderGroupHeader(currentGroup))
        }
      }

      // Check if this is the last item in the group
      const isLastInGroup = nextOption?.group !== option.group
      const groupHasMultipleItems = option.group && (groupCounts.get(option.group) || 0) > 1

      const item = this.renderOption(option, score, query)
      // Add styling for items in multi-item groups
      if (groupHasMultipleItems) {
        item.classList.add('dropdown-item-in-group')
      }
      // Only add end marker for multi-item groups
      if (isLastInGroup && groupHasMultipleItems) {
        item.classList.add('dropdown-item-group-end')
      }
      this.menu.appendChild(item)
    }
  }

  /**
   * Group filtered options by their group property
   * Preserves sort order within each group
   */
  private groupFilteredOptions(
    filtered: Array<{ option: DropdownOption, score: number }>,
  ): Array<{ option: DropdownOption, score: number }> {
    // Items are already sorted, just need to ensure groups are contiguous
    // The sort in filter() already handles this
    return filtered
  }

  /**
   * Render a group header
   */
  private renderGroupHeader(groupName: string): HTMLElement {
    const header = document.createElement('div')
    header.className = 'dropdown-group-header'
    header.textContent = groupName
    header.setAttribute('role', 'presentation')
    return header
  }

  /**
   * Render a single dropdown option
   */
  private renderOption(option: DropdownOption, score: number, query: string): HTMLElement {
    const item = document.createElement('div')
    item.className = 'dropdown-item'
    item.dataset.value = option.id

    // Dim unmatched items slightly
    if (score === -1 && query) {
      item.style.opacity = '0.5'
    }

    // Mark currently selected value
    if (option.id === this.selectedId) {
      item.classList.add('selected')
    }

    item.setAttribute('role', 'option')

    // Create label span
    const labelSpan = document.createElement('span')
    labelSpan.className = 'dropdown-item-label'
    labelSpan.textContent = option.label

    item.appendChild(labelSpan)

    // Add subtitle if different from label
    if (option.subtitle && option.subtitle !== option.label) {
      const subtitleSpan = document.createElement('span')
      subtitleSpan.className = 'dropdown-item-subtitle'
      subtitleSpan.textContent = option.subtitle
      item.appendChild(subtitleSpan)
    }

    return item
  }

  /**
   * Render empty state
   */
  private renderEmpty(): void {
    const empty = document.createElement('div')
    empty.className = 'dropdown-empty'
    empty.textContent = 'No options available'
    this.menu.appendChild(empty)
  }

  /**
   * Render no results state
   */
  private renderNoResults(): void {
    const noResults = document.createElement('div')
    noResults.className = 'dropdown-empty'
    noResults.textContent = 'No matching results'
    this.menu.appendChild(noResults)
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeydown(e: KeyboardEvent): void {
    const items = this.getItems()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (items.length === 0) return
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, items.length - 1)
        this.updateHighlight(items)
        break

      case 'ArrowUp':
        e.preventDefault()
        if (items.length === 0) return
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0)
        this.updateHighlight(items)
        break

      case 'Enter':
        e.preventDefault()
        if (this.highlightedIndex >= 0 && items[this.highlightedIndex]) {
          // Select the highlighted item
          const value = items[this.highlightedIndex].dataset.value
          const option = this.options.find(o => o.id === value)
          if (option) {
            this.selectOption(option)
          }
        }
        else if (this.input.value.trim()) {
          // No highlight, but user typed something
          if (this.allowCustom) {
            // Accept the custom value
            this.selectCustomValue(this.input.value.trim())
          }
          else {
            // Custom values not allowed - show invalid state, keep dropdown open
            this.setInvalid()
          }
        }
        break

      case 'Escape':
        this.close()
        break
    }
  }

  /**
   * Get current dropdown items
   */
  private getItems(): HTMLElement[] {
    return Array.from(this.menu.querySelectorAll('.dropdown-item'))
      .filter((item): item is HTMLElement => item instanceof HTMLElement)
  }

  /**
   * Update visual highlight
   */
  private updateHighlight(items: HTMLElement[]): void {
    items.forEach((item, index) => {
      item.classList.toggle('highlighted', index === this.highlightedIndex)
    })
  }

  /**
   * Select an option
   */
  private selectOption(option: DropdownOption): void {
    this.selectionMade = true
    this.selectedId = option.id
    this.input.value = option.label
    this.clearInvalid() // Clear error state on valid selection
    this.onSelect(option)
    this.close()
  }

  /**
   * Select a custom value (not in the options list)
   */
  private selectCustomValue(value: string): void {
    this.selectionMade = true
    this.selectedId = value
    this.input.value = value
    // Create a synthetic option for the callback
    const syntheticOption: DropdownOption = {
      id: value,
      label: value,
    }
    this.onSelect(syntheticOption)
    this.close()
  }

  /**
   * Simple fuzzy match scoring
   * Returns: 2 for exact match, 1 for starts with, 0 for contains, -1 for no match
   */
  private fuzzyMatch(text: string, query: string): number | null {
    if (!query) return 1
    const lower = text.toLowerCase()
    if (lower === query) return 2
    if (lower.startsWith(query)) return 1
    if (lower.includes(query)) return 0
    return -1
  }

  /**
   * Get the current selected ID
   */
  get value(): string {
    return this.selectedId
  }

  /**
   * Get the current display label (what's shown in the input)
   */
  get displayValue(): string {
    return this.input.value
  }

  /**
   * Set the selected ID and display label programmatically
   */
  set value(id: string) {
    this.selectedId = id
    const option = this.options.find(o => o.id === id)
    this.input.value = option?.label || id
  }

  /**
   * Show invalid state (red border, keeps dropdown open)
   */
  private setInvalid(): void {
    this.input.classList.add('form-input-invalid')
  }

  /**
   * Clear invalid state
   */
  private clearInvalid(): void {
    this.input.classList.remove('form-input-invalid')
  }

  /**
   * Destroy the dropdown and clean up listeners
   */
  destroy(): void {
    this.close()
    // Note: In a real app we'd remove event listeners here
    // For simplicity, we're relying on the container being removed from DOM
  }
}

/**
 * Helper to convert providers to dropdown options
 */
export function providersToDropdownOptions(providers: { id: string, displayName: string, group?: string }[]): DropdownOption[] {
  return providers.map(p => ({
    id: p.id,
    label: p.displayName,
    group: p.group,
  }))
}

/**
 * Helper to convert models to dropdown options
 */
export function modelsToDropdownOptions(models: SelectableModel[]): DropdownOption[] {
  return models.map(m => ({
    id: m.id,
    label: m.name,
    subtitle: m.id,
  }))
}

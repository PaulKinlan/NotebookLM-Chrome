/**
 * FuzzyDropdown Component
 *
 * A fuzzy search dropdown component using hooks-based architecture.
 * Replaces the imperative FuzzyDropdown class.
 */

import type { FuzzyDropdownOption, UseFuzzyDropdownOptions } from '../hooks/useFuzzyDropdown.ts'
import { useFuzzyDropdown } from '../hooks/useFuzzyDropdown.ts'
import { useEffect, useRef } from 'preact/hooks'

export interface FuzzyDropdownProps extends Omit<UseFuzzyDropdownOptions, 'initialValue'> {
  /** Initial selected value */
  value?: string
}

/**
 * FuzzyDropdown Component
 *
 * Provides a searchable dropdown with fuzzy matching and keyboard navigation.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [selected, setSelected] = useState('option1')
 *   const options = [
 *     { id: 'option1', label: 'Option 1', group: 'Group A' },
 *     { id: 'option2', label: 'Option 2', group: 'Group A' },
 *     { id: 'option3', label: 'Option 3', group: 'Group B' },
 *   ]
 *
 *   return (
 *     <FuzzyDropdown
 *       options={options}
 *       value={selected}
 *       onSelect={(option) => setSelected(option.id)}
 *       placeholder="Select an option..."
 *     />
 *   )
 * }
 * ```
 */
export function FuzzyDropdown(props: FuzzyDropdownProps): JSX.Element {
  const { options, onSelect, onToggle, allowCustom, value, placeholder } = props

  const dropdown = useFuzzyDropdown({
    options,
    onSelect,
    onToggle,
    allowCustom,
    initialValue: value,
    placeholder,
  })

  // Handle click outside to close
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return

      const current = containerRef.current
      if (!current?.contains(target)) {
        // Check if clicking on related form elements
        const parentCard = current?.closest('.profile-card, .form-group')
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
        dropdown.close()
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [dropdown])

  // Group filtered options
  const grouped = getGroupedOptions(dropdown.filteredOptions)

  return (
    <div className="fuzzy-dropdown" ref={containerRef}>
      <input
        ref={dropdown._inputRef}
        type="text"
        className="form-input fuzzy-dropdown-input"
        placeholder={placeholder || 'Type to search...'}
        value={dropdown.inputValue}
        autocomplete="off"
        aria-expanded={dropdown.isOpen}
        onFocus={dropdown.open}
        onInput={(e: Event) => {
          const target = e.currentTarget
          if (target instanceof HTMLInputElement) {
            dropdown.handleInput(target.value)
          }
        }}
        onKeyDown={dropdown.handleKeyDown}
      />
      <button
        type="button"
        className="fuzzy-dropdown-toggle"
        aria-label="Toggle options list"
        onClick={dropdown.toggle}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d="M4 6l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        ref={dropdown._menuRef}
        className={`fuzzy-dropdown-menu dropdown-menu ${dropdown.isOpen ? '' : 'hidden'}`}
      >
        {dropdown.filteredOptions.length === 0
          ? (
              <div className="dropdown-empty">
                {dropdown.inputValue ? 'No matching results' : 'No options available'}
              </div>
            )
          : (
              <RenderGroupedOptions
                grouped={grouped}
                highlightedIndex={dropdown.highlightedIndex}
                inputValue={dropdown.inputValue}
                onSelect={dropdown.selectOption}
              />
            )}
      </div>
    </div>
  )
}

/**
 * Helper to group filtered options with their counts
 */
function getGroupedOptions(
  filtered: Array<{ option: FuzzyDropdownOption, score: number }>,
): Array<{ group?: string, items: Array<{ option: FuzzyDropdownOption, score: number }> }> {
  const groups = new Map<string, Array<{ option: FuzzyDropdownOption, score: number }>>()
  const ungrouped: Array<{ option: FuzzyDropdownOption, score: number }> = []

  for (const item of filtered) {
    const groupName = item.option.group
    if (groupName) {
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(item)
    }
    else {
      ungrouped.push(item)
    }
  }

  // Build result with ungrouped first, then groups
  const result: Array<{ group?: string, items: Array<{ option: FuzzyDropdownOption, score: number }> }> = []

  // Add ungrouped items first
  if (ungrouped.length > 0) {
    result.push({ items: ungrouped })
  }

  // Add grouped items
  for (const [groupName, items] of groups) {
    result.push({ group: groupName, items })
  }

  return result
}

/**
 * Render grouped options with headers
 */
interface RenderGroupedOptionsProps {
  grouped: Array<{ group?: string, items: Array<{ option: FuzzyDropdownOption, score: number }> }>
  highlightedIndex: number
  inputValue: string
  onSelect: (option: FuzzyDropdownOption) => void
}

function RenderGroupedOptions({ grouped, highlightedIndex, inputValue, onSelect }: RenderGroupedOptionsProps): JSX.Element {
  let globalIndex = 0

  return (
    <>
      {grouped.map(({ group, items }) => (
        <div key={group ?? '_ungrouped'} className="dropdown-group">
          {group && items.length > 1 && (
            <div className="dropdown-group-header" role="presentation">
              {group}
            </div>
          )}
          {items.map(({ option, score }, itemIndex) => {
            const index = globalIndex++
            const isHighlighted = index === highlightedIndex
            const isLastInGroup = itemIndex === items.length - 1
            const groupHasMultipleItems = items.length > 1

            return (
              <div
                key={option.id}
                className={`dropdown-item ${isHighlighted ? 'highlighted' : ''} ${groupHasMultipleItems ? 'dropdown-item-in-group' : ''} ${isLastInGroup && groupHasMultipleItems ? 'dropdown-item-group-end' : ''}`}
                data-value={option.id}
                role="option"
                style={score === -1 && inputValue ? { opacity: '0.5' } : undefined}
                onClick={(e: Event) => {
                  e.stopPropagation()
                  onSelect(option)
                }}
              >
                <span className="dropdown-item-label">{option.label}</span>
                {option.subtitle && option.subtitle !== option.label && (
                  <span className="dropdown-item-subtitle">{option.subtitle}</span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

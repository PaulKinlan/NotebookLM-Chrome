/**
 * ChatInput Component
 *
 * Handles user query input with slash commands and autocomplete.
 * Uses the useChat hook for state management.
 */

import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'
import { escapeHtml } from '../dom-utils.ts'

/**
 * Slash command definition
 */
export interface SlashCommand {
  command: string
  description: string
  usage: string
}

interface ChatInputProps {
  notebookId: string | null
  onQuery: (query: string) => void
  slashCommands: SlashCommand[]
  isGenerating: boolean
}

/**
 * Parse slash command from input
 */
function parseSlashCommand(input: string): { command: string, args: string } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.slice(1).split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1).join(' ')

  return { command, args }
}

/**
 * Calculate fuzzy match score for sorting
 */
function fuzzyMatchScore(text: string, query: string): number {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (!lowerQuery) return 0

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 80

  // Contains query gets medium score
  if (lowerText.includes(lowerQuery)) return 60

  // Fuzzy match based on character sequence
  let queryIndex = 0
  let score = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10
      queryIndex++
    }
  }

  // Bonus for completing the match
  if (queryIndex === lowerQuery.length) {
    score += 20
  }

  return score
}

/**
 * Autocomplete dropdown component
 */
interface AutocompleteProps {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand, submit?: boolean) => void
}

function Autocomplete({ commands, selectedIndex, onSelect }: AutocompleteProps): JSX.Element {
  const handleClick = (command: SlashCommand, index: number) => {
    if (index === selectedIndex) {
      onSelect(command, true)
    }
    else {
      onSelect(command, false)
    }
  }

  return (
    <div className="autocomplete-dropdown">
      {commands.map((cmd, index) => (
        <div
          key={cmd.command}
          className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          onMouseDown={() => handleClick(cmd, index)}
        >
          <span className="autocomplete-command">
            /
            {escapeHtml(cmd.command)}
          </span>
          <span className="autocomplete-description">{escapeHtml(cmd.description)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * ChatInput Component
 */
export function ChatInput({ notebookId, onQuery, slashCommands, isGenerating }: ChatInputProps): JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [ghostText, setGhostText] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteCommands, setAutocompleteCommands] = useState<SlashCommand[]>([])
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0)

  // Reset input when notebook changes
  useEffect(() => {
    setInputValue('')
    setGhostText('')
    setShowAutocomplete(false)
  }, [notebookId])

  /**
   * Handle input changes
   */
  const handleInput = (e: Event) => {
    const target = e.currentTarget
    if (!(target instanceof HTMLInputElement)) return
    const value = target.value
    setInputValue(value)

    // Check for slash commands
    if (value.startsWith('/')) {
      const query = value.slice(1)
      if (query) {
        // Score and sort commands
        const scored = slashCommands.map(cmd => ({
          cmd,
          score: fuzzyMatchScore(cmd.command, query),
        })).filter(item => item.score > 0)

        scored.sort((a, b) => b.score - a.score)

        if (scored.length > 0) {
          setAutocompleteCommands(scored.slice(0, 5).map(item => item.cmd))
          setSelectedAutocompleteIndex(0)
          setShowAutocomplete(true)

          // Set ghost text for best match
          const bestMatch = scored[0].cmd
          if (value === `/${bestMatch.command}` || value === `/${bestMatch.command.slice(0, query.length)}`) {
            setGhostText(bestMatch.command.slice(query.length))
          }
          else {
            setGhostText('')
          }
        }
        else {
          setShowAutocomplete(false)
          setGhostText('')
        }
      }
      else {
        // Show all commands when just "/"
        setAutocompleteCommands(slashCommands.slice(0, 5))
        setSelectedAutocompleteIndex(0)
        setShowAutocomplete(true)
        setGhostText(slashCommands[0]?.command.slice(0) || '')
      }
    }
    else {
      setShowAutocomplete(false)
      setGhostText('')
    }
  }

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showAutocomplete) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedAutocompleteIndex(prev =>
        prev < autocompleteCommands.length - 1 ? prev + 1 : prev,
      )
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedAutocompleteIndex(prev => (prev > 0 ? prev - 1 : 0))
    }
    else if (e.key === 'Tab') {
      e.preventDefault()
      if (autocompleteCommands[selectedAutocompleteIndex]) {
        const cmd = autocompleteCommands[selectedAutocompleteIndex]
        setInputValue(`/${cmd.command} `)
        setShowAutocomplete(false)
        setGhostText('')
      }
    }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (autocompleteCommands[selectedAutocompleteIndex]) {
        const cmd = autocompleteCommands[selectedAutocompleteIndex]
        setInputValue(`/${cmd.command} `)
        setShowAutocomplete(false)
        setGhostText('')
      }
    }
    else if (e.key === 'Escape') {
      setShowAutocomplete(false)
      setGhostText('')
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = (e: Event) => {
    e.preventDefault()

    const trimmed = inputValue.trim()
    if (!trimmed || isGenerating) return

    // Check for slash command
    const parsed = parseSlashCommand(trimmed)
    if (parsed) {
      // Handle slash commands via parent callback
      onQuery(trimmed)
    }
    else {
      // Regular query
      onQuery(trimmed)
    }

    setInputValue('')
    setGhostText('')
    setShowAutocomplete(false)
  }

  /**
   * Handle autocomplete selection
   */
  const handleAutocompleteSelect = (command: SlashCommand, submit = false) => {
    const newValue = `/${command.command} `
    setInputValue(newValue)
    setShowAutocomplete(false)
    setGhostText('')

    if (submit) {
      // Focus the input element
      const inputEl = document.getElementById('query-input')
      if (inputEl instanceof HTMLInputElement) {
        inputEl.focus()
      }
    }
  }

  return (
    <div className="chat-input-container">
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="chat-input-wrapper">
          <input
            type="text"
            id="query-input"
            className="chat-input-field"
            placeholder={isGenerating ? 'Generating...' : 'Ask a question...'}
            value={inputValue}
            disabled={isGenerating}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {ghostText && (
            <span className="chat-input-ghost">{ghostText}</span>
          )}
        </div>
        <button
          type="submit"
          id="query-btn"
          className="btn btn-primary chat-send-btn"
          disabled={isGenerating || !inputValue.trim()}
        >
          {isGenerating ? '...' : 'Send'}
        </button>
      </form>
      {showAutocomplete && autocompleteCommands.length > 0 && (
        <Autocomplete
          commands={autocompleteCommands}
          selectedIndex={selectedAutocompleteIndex}
          onSelect={handleAutocompleteSelect}
        />
      )}
    </div>
  )
}

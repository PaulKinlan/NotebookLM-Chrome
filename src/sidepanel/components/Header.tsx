/**
 * Header component - Top navigation bar with logo, library/settings buttons, notebook selector, and AI model picker
 */

import type { Notebook } from '../../types/index.ts'
import { useModelConfigs } from '../hooks/useModelConfigs'
import { getProviderConfigById } from '../../lib/provider-registry'
import { useState, useRef, useEffect } from 'preact/hooks'

interface HeaderProps {
  onLibraryClick: () => void
  onSettingsClick: () => void
  onNotebookChange: (notebookId: string) => void
  onNewNotebook: () => void
  notebooks: Notebook[]
  currentNotebookId: string | null
}

export function Header(props: HeaderProps) {
  const { onLibraryClick, onSettingsClick, onNotebookChange, onNewNotebook, notebooks, currentNotebookId } = props

  // AI model dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get model configs
  const { modelConfigs, defaultModelConfigId, setDefault, defaultModelConfig } = useModelConfigs()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Get display name for current model
  const currentModelName = defaultModelConfig
    ? defaultModelConfig.name
    : 'No AI Profile'

  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">F</span>
        <h1>FolioLM</h1>
        <button
          id="header-library-btn"
          className="header-icon-btn"
          title="Library"
          onClick={onLibraryClick}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </button>
        <button
          id="header-settings-btn"
          className="header-icon-btn"
          title="Settings"
          onClick={onSettingsClick}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      <div className="header-right">
        <select
          id="notebook-select"
          className="header-notebook-select"
          value={currentNotebookId ?? ''}
          onChange={e => onNotebookChange((e.target as HTMLSelectElement).value)}
        >
          <option value="">Select a folio...</option>
          {notebooks.map(nb => (
            <option key={nb.id} value={nb.id}>
              {nb.name}
            </option>
          ))}
        </select>
        <div className="ai-model-picker" ref={dropdownRef}>
          <button
            id="ai-model-btn"
            className="header-icon-btn"
            title={`AI Model: ${currentModelName}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="8.5" cy="16" r="1.5"></circle>
              <circle cx="15.5" cy="16" r="1.5"></circle>
              <path d="M8.5 11V7a3.5 3.5 0 0 1 7 0v4"></path>
            </svg>
          </button>
          <div id="ai-model-dropdown" className={`ai-model-dropdown ${dropdownOpen ? '' : 'hidden'}`}>
            <div className="ai-model-dropdown-content">
              <div className="ai-model-dropdown-header">Select AI Profile</div>
              <div id="ai-model-list" className="ai-model-list">
                {modelConfigs.length === 0 ? (
                  <div className="ai-model-empty">No profiles available</div>
                ) : (
                  modelConfigs.map(config => {
                    const provider = getProviderConfigById(config.providerId)
                    const isSelected = config.id === defaultModelConfigId
                    return (
                      <button
                        key={config.id}
                        className={`ai-model-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          void setDefault(config.id)
                          setDropdownOpen(false)
                        }}
                      >
                        <div className="ai-model-option-name">{config.name}</div>
                        <div className="ai-model-option-meta">
                          {provider?.displayName ?? config.providerId} • {config.model}
                        </div>
                        {isSelected && (
                          <svg className="ai-model-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        <button
          id="new-notebook-btn"
          className="header-icon-btn"
          title="New Folio"
          onClick={onNewNotebook}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </header>
  )
}

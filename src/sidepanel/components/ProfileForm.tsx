/**
 * ProfileForm Component
 *
 * Form for creating or editing AI provider profiles.
 * Uses the FuzzyDropdown component for provider selection.
 */

import { useState, useEffect, useRef } from '../../jsx-runtime/hooks/index.ts'
import type { ProfileFormState } from '../hooks/useProviderProfiles.ts'
import type { ProviderConfig, SelectableModel } from '../../lib/provider-registry.ts'
import type { FuzzyDropdownOption } from '../hooks/useFuzzyDropdown.ts'
import { FuzzyDropdown } from './FuzzyDropdown.tsx'

export interface ProfileFormProps {
  formState: ProfileFormState
  availableProviders: ProviderConfig[]
  availableModels: SelectableModel[]
  isFetchingModels: boolean
  testStatus: 'idle' | 'testing' | 'success' | 'error'
  testMessage: string
  isNewProfile: boolean
  onChange: (updates: Partial<ProfileFormState>) => void
  onSave: () => Promise<boolean>
  onCancel: () => void
  onTest: () => Promise<boolean>
}

/**
 * Provider dropdown options
 */
function providersToDropdownOptions(providers: ProviderConfig[]): FuzzyDropdownOption[] {
  return providers.map(p => ({
    id: p.id,
    label: p.displayName,
    group: p.group,
  }))
}

/**
 * Check if provider requires API key
 */
function providerRequiresApiKey(provider: ProviderConfig): boolean {
  return provider.features.requiresApiKey !== false
}

/**
 * Check if provider supports model fetching
 */
function providerSupportsFetching(provider: ProviderConfig): boolean {
  return provider.features.supportsModelFetching ?? false
}

/**
 * ProfileForm - Form for creating/editing AI profiles
 */
export function ProfileForm({
  formState,
  availableProviders,
  availableModels,
  isFetchingModels,
  testStatus,
  testMessage,
  isNewProfile,
  onChange,
  onSave,
  onCancel,
  onTest,
}: ProfileFormProps): JSX.Element {
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [modelInputValue, setModelInputValue] = useState(formState.model)

  // Refs for dropdown elements
  const modelDropdownRef = useRef<HTMLElement | null>(null)

  // Get current provider
  const currentProvider = availableProviders.find(p => p.id === formState.providerId)
  const requiresApiKey = currentProvider ? providerRequiresApiKey(currentProvider) : true

  // Sync model input value when formState changes
  useEffect(() => {
    setModelInputValue(formState.model)
  }, [formState.model])

  // Handle provider change
  const handleProviderChange = (option: FuzzyDropdownOption) => {
    onChange({ providerId: option.id })
  }

  // Handle model input
  const handleModelInput = (value: string) => {
    setModelInputValue(value)
    onChange({ model: value })
    setModelDropdownOpen(true)
  }

  // Handle model selection from dropdown
  const handleModelSelect = (option: FuzzyDropdownOption) => {
    setModelInputValue(option.label)
    onChange({ model: option.id })
    setModelDropdownOpen(false)
  }

  // Handle refresh models
  const handleRefreshModels = () => {
    if (currentProvider && providerSupportsFetching(currentProvider)) {
      onChange({}) // Trigger fetch in parent via empty update
    }
  }

  // Handle save
  const handleSaveClick = async () => {
    await onSave()
  }

  // Handle test
  const handleTestClick = async () => {
    await onTest()
  }

  // Temperature display value
  const temperatureDisplay = formState.temperature.toFixed(1)

  // Get test status class
  const getTestStatusClass = () => {
    switch (testStatus) {
      case 'testing':
        return 'testing'
      case 'success':
        return 'success'
      case 'error':
        return 'error'
      default:
        return ''
    }
  }

  // Filter models based on input
  const filteredModels = availableModels.filter(m =>
    m.name.toLowerCase().includes(modelInputValue.toLowerCase())
    || m.id.toLowerCase().includes(modelInputValue.toLowerCase()),
  )

  // Group models by context length (optional grouping)
  const groupedModels = filteredModels

  return (
    <div className="profile-card editing new-profile">
      <div className="profile-form">
        <div className="form-header">
          <h4>{isNewProfile ? 'New AI Profile' : 'Edit AI Profile'}</h4>
        </div>

        <label className="input-label">Profile Name</label>
        <input
          type="text"
          className="form-input profile-name-input"
          placeholder="e.g., GPT-4 Turbo (Work)"
          value={formState.name}
          onInput={(e: InputEvent) => {
            onChange({ name: (e.target as HTMLInputElement).value })
          }}
        />

        <label className="input-label">Provider</label>
        <div className="profile-provider-dropdown">
          <FuzzyDropdown
            options={providersToDropdownOptions(availableProviders)}
            value={formState.providerId}
            onSelect={handleProviderChange}
            placeholder="Select a provider..."
            allowCustom={false}
          />
        </div>

        <div className="api-key-section" style={{ display: requiresApiKey ? '' : 'none' }}>
          <label className="input-label">API Key</label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input profile-api-key-input"
              placeholder="Required for most providers"
              value={formState.apiKey}
              onInput={(e: InputEvent) => {
                onChange({ apiKey: (e.target as HTMLInputElement).value })
              }}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label="Show API key"
              title={showPassword ? 'Hide API key' : 'Show API key'}
              onClick={() => setShowPassword(!showPassword)}
            >
              <svg
                className="eye-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: showPassword ? 'none' : '' }}
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg
                className="eye-off-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: showPassword ? '' : 'none' }}
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              </svg>
            </button>
          </div>
        </div>

        <label className="input-label">Model</label>
        <div className="model-dropdown">
          <input
            type="text"
            className="form-input profile-model-input"
            placeholder="Type to search models..."
            autocomplete="off"
            value={modelInputValue}
            onFocus={() => setModelDropdownOpen(true)}
            onInput={(e: InputEvent) => {
              handleModelInput((e.target as HTMLInputElement).value)
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Escape') {
                setModelDropdownOpen(false)
              }
            }}
          />
          <button
            type="button"
            className="dropdown-toggle"
            aria-label="Toggle model list"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline className="dropdown-chevron-down" points="6 9 12 15 18 9" style={{ display: modelDropdownOpen ? 'none' : '' }} />
              <polyline className="dropdown-chevron-up" points="6 15 12 9 18 15" style={{ display: modelDropdownOpen ? '' : 'none' }} />
            </svg>
          </button>
          {currentProvider && providerSupportsFetching(currentProvider) && (
            <button
              type="button"
              className="model-refresh-btn"
              aria-label="Refresh model list"
              title="Refresh model list"
              onClick={handleRefreshModels}
              disabled={isFetchingModels}
            >
              <svg className="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: isFetchingModels ? 'none' : '' }}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              <svg className="refresh-spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: isFetchingModels ? '' : 'none' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </button>
          )}
          <div
            ref={modelDropdownRef}
            className="dropdown-menu model-dropdown-menu"
            hidden={!modelDropdownOpen}
            style={{ position: 'absolute', zIndex: 1000 }}
          >
            {groupedModels.length === 0
              ? (
                  <div className="dropdown-empty">
                    {isFetchingModels ? 'Loading models...' : modelInputValue ? 'No matching models' : 'No models available'}
                  </div>
                )
              : (
                  groupedModels.map(model => (
                    <div
                      key={model.id}
                      className="dropdown-item"
                      data-value={model.id}
                      role="option"
                      onClick={() => handleModelSelect({
                        id: model.id,
                        label: model.name,
                        subtitle: model.id,
                      })}
                    >
                      <span className="dropdown-item-label">{model.name}</span>
                      <span className="dropdown-item-subtitle">{model.id}</span>
                    </div>
                  ))
                )}
          </div>
        </div>

        <details className="advanced-settings">
          <summary>Advanced Settings</summary>
          <label className="input-label">Temperature</label>
          <div className="range-input-row">
            <input
              type="range"
              className="form-range profile-temperature-input"
              min="0"
              max="2"
              step="0.1"
              value={formState.temperature}
              onInput={(e: InputEvent) => {
                onChange({ temperature: parseFloat((e.target as HTMLInputElement).value) })
              }}
            />
            <span className="profile-temperature-value">{temperatureDisplay}</span>
          </div>
          <p className="setting-hint">Controls randomness. Lower values are more focused, higher values are more creative.</p>

          <label className="input-label">Max Tokens</label>
          <input
            type="number"
            className="form-input profile-max-tokens-input"
            min="100"
            max="128000"
            step="100"
            placeholder="Default"
            value={formState.maxTokens || ''}
            onInput={(e: InputEvent) => {
              const value = (e.target as HTMLInputElement).value
              onChange({ maxTokens: value ? parseInt(value, 10) : undefined })
            }}
          />
          <p className="setting-hint">Maximum length of the response. Leave empty for model default.</p>

          <label className="input-label">Context Compression</label>
          <select
            className="form-select profile-compression-mode-input"
            onChange={(e: InputEvent) => {
              const value = (e.target as HTMLSelectElement).value
              onChange({
                compressionMode: (value === 'two-pass' || value === 'single-pass' ? value : undefined),
              })
            }}
          >
            <option value="two-pass" selected={!formState.compressionMode || formState.compressionMode === 'two-pass'}>
              Smart (Two-Pass) - LLM ranks sources
            </option>
            <option value="single-pass" selected={formState.compressionMode === 'single-pass'}>
              Fast (Single-Pass) - Fixed compression
            </option>
          </select>
          <p className="setting-hint">Smart mode uses AI to intelligently select relevant sources (slower). Fast mode uses a fixed strategy for quicker responses.</p>
        </details>

        <div className="form-actions">
          <button
            className="btn btn-outline profile-cancel-btn"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`btn btn-outline profile-test-btn ${getTestStatusClass()}`}
            type="button"
            title="Test connection with current settings"
            disabled={testStatus === 'testing'}
            onClick={handleTestClick}
          >
            <svg className="test-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: testStatus === 'idle' || testStatus === 'error' ? '' : 'none' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <svg className="testing-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: testStatus === 'testing' ? '' : 'none' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <svg className="success-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: testStatus === 'success' ? '' : 'none' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <svg className="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: testStatus === 'error' ? '' : 'none' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="test-text">{testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Success!' : testStatus === 'error' ? 'Failed' : 'Test'}</span>
          </button>
          <button
            className="btn btn-primary profile-save-btn"
            type="button"
            onClick={handleSaveClick}
          >
            Save Profile
          </button>
        </div>
        {testMessage && testStatus !== 'idle' && (
          <div className={`test-status test-status-${testStatus}`} style={{ display: '' }}>
            {testMessage}
          </div>
        )}
      </div>
    </div>
  )
}

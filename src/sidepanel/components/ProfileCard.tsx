/**
 * ProfileCard Component
 *
 * Displays a single AI profile card with view mode.
 * Edit mode is handled by ProfileForm component.
 */

import type { AIProfile } from '../hooks/useProviderProfiles.ts'
import { maskApiKey } from '../profile-ui-utils.ts'
import { NO_API_KEY_PLACEHOLDER } from '../../lib/model-configs.ts'
import { escapeHtml } from '../dom-utils.ts'

export interface ProfileCardProps {
  profile: AIProfile
  isEditing: boolean
  onEdit: () => void
  onSetDefault: () => void
  onDelete: () => void
  onShowUsageStats: () => void
}

/**
 * ProfileCard - Display a single AI profile
 */
export function ProfileCard({
  profile,
  isEditing,
  onEdit,
  onSetDefault,
  onDelete,
  onShowUsageStats,
}: ProfileCardProps): JSX.Element {
  const { modelConfig, credential, provider } = profile
  const showApiKey = provider.features.requiresApiKey !== false && credential.apiKey !== NO_API_KEY_PLACEHOLDER

  return (
    <div className={`profile-card${modelConfig.isDefault ? ' default-profile' : ''}${isEditing ? ' editing' : ''}`}>
      <div className="profile-header" data-profile-id={modelConfig.id}>
        <div className="profile-name-row">
          <div className="profile-name">
            {escapeHtml(modelConfig.name)}
            {modelConfig.isDefault && <span className="default-badge">Default</span>}
          </div>
        </div>
        <div className="profile-details">
          <span className="profile-provider">{escapeHtml(provider.displayName)}</span>
          <span className="profile-model">{escapeHtml(modelConfig.model)}</span>
          {showApiKey && <span className="profile-api-key">{maskApiKey(credential.apiKey)}</span>}
          {modelConfig.temperature !== undefined && (
            <span className="profile-temp">
              Temp:
              {modelConfig.temperature}
            </span>
          )}
          {modelConfig.maxTokens && (
            <span className="profile-max-tokens">
              Max:
              {modelConfig.maxTokens}
            </span>
          )}
        </div>
      </div>

      <div className="profile-actions">
        <button
          className="profile-btn"
          data-action="edit"
          type="button"
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          Edit
        </button>
        <button
          className="profile-btn"
          disabled={modelConfig.isDefault}
          data-action="set-default"
          type="button"
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            void onSetDefault()
          }}
        >
          {modelConfig.isDefault ? 'Default' : 'Set Default'}
        </button>
        <button
          className="profile-btn stats"
          data-action="stats"
          title="View usage stats"
          type="button"
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            onShowUsageStats()
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="12" width="4" height="9" />
            <rect x="10" y="8" width="4" height="13" />
            <rect x="17" y="4" width="4" height="17" />
          </svg>
        </button>
        <button
          className="profile-btn delete"
          data-action="delete"
          type="button"
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            void onDelete()
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

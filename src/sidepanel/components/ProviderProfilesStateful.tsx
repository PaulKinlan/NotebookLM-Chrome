/**
 * ProviderProfilesStateful Component
 *
 * Manages AI provider profiles display and interactions.
 * Replaces imperative provider-config-ui.ts with hooks-based architecture.
 */

import { useState } from '../../jsx-runtime/hooks/index.ts'
import { useProviderProfiles, type ProfileFormState } from '../hooks/useProviderProfiles.ts'
import { ProfileCard } from './ProfileCard.tsx'
import { ProfileForm } from './ProfileForm.tsx'

export interface ProviderProfilesProps {
  /** Callback when profiles change */
  onProfilesChanged?: () => void
}

/**
 * ProviderProfilesStateful - Main profiles management component
 */
export function ProviderProfilesStateful({ onProfilesChanged }: ProviderProfilesProps): Node {
  const {
    profiles,
    isLoading,
    editingProfileId,
    isNewProfile,
    formState,
    availableProviders,
    availableModels,
    isFetchingModels,
    testStatus,
    testMessage,
    startNewProfile,
    startEditProfile,
    cancelEdit,
    updateFormState,
    saveProfile,
    deleteProfile,
    setDefaultProfile,
    testConnection,
    fetchModels,
  } = useProviderProfiles()

  // Local state for usage stats modal
  const [usageStatsProfile, setUsageStatsProfile] = useState<{ id: string, name: string } | null>(null)

  /**
   * Handle form state updates with proper typing
   */
  const handleFormChange = (updates: Partial<ProfileFormState>) => {
    updateFormState(updates)

    // Fetch models when provider or API key changes
    if ('providerId' in updates || 'apiKey' in updates) {
      const providerId = 'providerId' in updates ? updates.providerId! : formState.providerId
      const apiKey = 'apiKey' in updates ? updates.apiKey! : formState.apiKey
      void fetchModels(providerId, apiKey)
    }
  }

  /**
   * Handle save with callback
   */
  const handleSave = async () => {
    const success = await saveProfile()
    if (success && onProfilesChanged) {
      onProfilesChanged()
    }
    return success
  }

  /**
   * Handle delete with callback
   */
  const handleDelete = async (profileId: string) => {
    const success = await deleteProfile(profileId)
    if (success && onProfilesChanged) {
      onProfilesChanged()
    }
    return success
  }

  /**
   * Handle set default with callback
   */
  const handleSetDefault = async (profileId: string) => {
    const success = await setDefaultProfile(profileId)
    if (success && onProfilesChanged) {
      onProfilesChanged()
    }
    return success
  }

  /**
   * Show usage stats modal
   */
  const handleShowUsageStats = (profileId: string, profileName: string) => {
    setUsageStatsProfile({ id: profileId, name: profileName })
  }

  /**
   * Close usage stats modal
   */
  const handleCloseUsageStats = () => {
    setUsageStatsProfile(null)
  }

  // Determine if we should show the form
  const showForm = isNewProfile || editingProfileId !== null

  return (
    <div className="provider-profiles">
      {isLoading
        ? (
            <div className="profiles-loading">Loading profiles...</div>
          )
        : showForm
          ? (
              <ProfileForm
                formState={formState}
                availableProviders={availableProviders}
                availableModels={availableModels}
                isFetchingModels={isFetchingModels}
                testStatus={testStatus}
                testMessage={testMessage}
                isNewProfile={isNewProfile}
                onChange={handleFormChange}
                onSave={handleSave}
                onCancel={cancelEdit}
                onTest={testConnection}
              />
            )
          : profiles.length === 0
            ? (
                <div className="ai-profiles-empty-state">
                  <p>No AI profiles have been created yet.</p>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={startNewProfile}
                  >
                    Add Profile
                  </button>
                </div>
              )
            : (
                <>
                  <div className="profiles-list">
                    {profiles.map(profile => (
                      <ProfileCard
                        profile={profile}
                        isEditing={false}
                        onEdit={() => startEditProfile(profile.modelConfig.id)}
                        onSetDefault={() => {
                          void handleSetDefault(profile.modelConfig.id)
                        }}
                        onDelete={() => {
                          void handleDelete(profile.modelConfig.id)
                        }}
                        onShowUsageStats={() => handleShowUsageStats(profile.modelConfig.id, profile.modelConfig.name)}
                      />
                    ))}
                  </div>
                </>
              )}

      {/* Usage Stats Modal */}
      {usageStatsProfile && (
        <UsageStatsModal
          profileId={usageStatsProfile.id}
          profileName={usageStatsProfile.name}
          onClose={handleCloseUsageStats}
        />
      )}
    </div>
  )
}

/**
 * UsageStatsModal Component
 * Shows usage statistics for a profile
 */
interface UsageStatsModalProps {
  profileId: string
  profileName: string
  onClose: () => void
}

function UsageStatsModal({ profileName, onClose }: UsageStatsModalProps): Node {
  // TODO: Implement actual usage stats fetching
  const stats = {
    totalTokens: 0,
    totalCost: 0,
    requestCount: 0,
    timeRange: 'All time',
    dataPoints: [],
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal usage-stats-modal" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Usage Statistics</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="usage-profile-name">{profileName}</p>
          <div className="usage-stats-grid">
            <div className="usage-stat-item">
              <span className="usage-stat-label">Total Requests</span>
              <span className="usage-stat-value">{stats.requestCount}</span>
            </div>
            <div className="usage-stat-item">
              <span className="usage-stat-label">Total Tokens</span>
              <span className="usage-stat-value">{stats.totalTokens.toLocaleString()}</span>
            </div>
            <div className="usage-stat-item">
              <span className="usage-stat-label">Total Cost</span>
              <span className="usage-stat-value">
                $
                {stats.totalCost.toFixed(4)}
              </span>
            </div>
          </div>
          {stats.dataPoints.length === 0 && (
            <p className="usage-empty-message">No usage data available yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * useProviderProfiles Hook
 *
 * Manages AI provider profile state and operations.
 * Converts imperative provider-config-ui.ts to hooks-based approach.
 */

import type { Credential, ModelConfig } from '../../types/index.ts'
import {
  getCredentials,
  createCredential,
  findCredentialByApiKey,
} from '../../lib/credentials.ts'
import {
  getModelConfigs,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig,
  setDefaultModelConfig,
  initializeDefaultProfile,
  NO_API_KEY_PLACEHOLDER,
} from '../../lib/model-configs.ts'
import type { ProviderConfig, SelectableModel } from '../../lib/provider-registry.ts'
import {
  getAllProviders,
  getProviderConfigById,
  fetchProviderSelectableModels,
} from '../../lib/provider-registry.ts'
import { testConnectionWithConfig } from '../../lib/ai.ts'
import { useState, useEffect } from '../../jsx-runtime/hooks/index.ts'

/**
 * AI Profile - combined view model (not persisted)
 * Merges ModelConfig + Credential + Provider for UI presentation
 */
export interface AIProfile {
  modelConfig: ModelConfig
  credential: Credential
  provider: ProviderConfig
}

/**
 * Profile form state
 */
export interface ProfileFormState {
  profileId: string | null // null for new profile
  name: string
  providerId: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number | undefined
  compressionMode: 'two-pass' | 'single-pass' | undefined
  isDefault: boolean
}

/**
 * Usage statistics data
 */
export interface UsageStats {
  totalTokens: number
  totalCost: number
  requestCount: number
  timeRange: string
  dataPoints: Array<{ date: string, tokens: number, cost: number }>
}

/**
 * Model cache entry
 */
interface ModelCacheEntry {
  models: SelectableModel[]
  timestamp: number
}

// Module-level model cache (not state, doesn't trigger re-renders)
const modelsCache = new Map<string, ModelCacheEntry>()

/**
 * Hash function for API keys (not for security, just for cache key uniqueness)
 */
function hashApiKey(apiKey: string): string {
  let hash = 0
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Generate a cache key for models based on provider ID and API key
 */
function generateCacheKey(providerId: string, apiKey?: string): string {
  if (!apiKey) {
    return `${providerId}:no-auth`
  }
  return `${providerId}:${hashApiKey(apiKey)}`
}

/**
 * Create default form state
 */
function createDefaultFormState(): ProfileFormState {
  return {
    profileId: null,
    name: '',
    providerId: 'chrome',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: undefined,
    compressionMode: undefined,
    isDefault: false,
  }
}

/**
 * Create form state from existing profile
 */
function createFormStateFromProfile(profile: AIProfile): ProfileFormState {
  return {
    profileId: profile.modelConfig.id,
    name: profile.modelConfig.name,
    providerId: profile.provider.id,
    apiKey: profile.credential.apiKey === NO_API_KEY_PLACEHOLDER ? '' : profile.credential.apiKey,
    model: profile.modelConfig.model,
    temperature: profile.modelConfig.temperature ?? 0.7,
    maxTokens: profile.modelConfig.maxTokens,
    compressionMode: profile.modelConfig.compressionMode,
    isDefault: profile.modelConfig.isDefault ?? false,
  }
}

/**
 * Hook return type
 */
export interface UseProviderProfilesReturn {
  // State
  profiles: AIProfile[]
  isLoading: boolean
  editingProfileId: string | null
  isNewProfile: boolean
  formState: ProfileFormState
  availableProviders: ProviderConfig[]
  availableModels: SelectableModel[]
  isFetchingModels: boolean
  testStatus: 'idle' | 'testing' | 'success' | 'error'
  testMessage: string

  // Actions
  loadProfiles: () => Promise<void>
  startNewProfile: () => void
  startEditProfile: (profileId: string) => void
  cancelEdit: () => void
  updateFormState: (updates: Partial<ProfileFormState>) => void
  saveProfile: () => Promise<boolean>
  deleteProfile: (profileId: string) => Promise<boolean>
  setDefaultProfile: (profileId: string) => Promise<boolean>
  testConnection: () => Promise<boolean>
  fetchModels: (providerId: string, apiKey: string) => Promise<SelectableModel[]>
  showUsageStats: (profileId: string) => UsageStats | null
}

/**
 * useProviderProfiles hook
 */
export function useProviderProfiles(): UseProviderProfilesReturn {
  // State
  const [profiles, setProfiles] = useState<AIProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [isNewProfile, setIsNewProfile] = useState(false)
  const [formState, setFormState] = useState<ProfileFormState>(createDefaultFormState())
  const [availableProviders] = useState<ProviderConfig[]>(getAllProviders())
  const [availableModels, setAvailableModels] = useState<SelectableModel[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  /**
   * Load profiles from storage
   */
  async function loadProfiles(): Promise<void> {
    setIsLoading(true)
    try {
      const credentials = await getCredentials()
      const modelConfigs = await getModelConfigs()

      // Merge into profiles array
      const mergedProfiles = modelConfigs
        .map((config) => {
          const credential = credentials.find(c => c.id === config.credentialId)
          const provider = getProviderConfigById(config.providerId)
          if (!credential || !provider) {
            console.warn(`[useProviderProfiles] Skipping profile ${config.id}: missing credential or provider`)
            return null
          }
          return { modelConfig: config, credential, provider }
        })
        .filter((p): p is AIProfile => p !== null)

      // Sort: default first, then by date
      mergedProfiles.sort((a, b) => {
        if (a.modelConfig.isDefault && !b.modelConfig.isDefault) return -1
        if (!a.modelConfig.isDefault && b.modelConfig.isDefault) return 1
        return b.modelConfig.updatedAt - a.modelConfig.updatedAt
      })

      setProfiles(mergedProfiles)

      // Initialize default Chrome profile if no profiles exist
      if (mergedProfiles.length === 0) {
        await initializeDefaultProfile()
        // Reload after initialization
        const reloadedCredentials = await getCredentials()
        const reloadedConfigs = await getModelConfigs()
        const reloadedProfiles = reloadedConfigs
          .map((config) => {
            const credential = reloadedCredentials.find(c => c.id === config.credentialId)
            const provider = getProviderConfigById(config.providerId)
            if (!credential || !provider) return null
            return { modelConfig: config, credential, provider }
          })
          .filter((p): p is AIProfile => p !== null)
        setProfiles(reloadedProfiles)
      }
    }
    catch (error) {
      console.error('[useProviderProfiles] Failed to load profiles:', error)
    }
    finally {
      setIsLoading(false)
    }
  }

  /**
   * Start creating a new profile
   */
  function startNewProfile(): void {
    setIsNewProfile(true)
    setEditingProfileId(null)
    setFormState(createDefaultFormState())
    setAvailableModels([])
    setTestStatus('idle')
    setTestMessage('')
  }

  /**
   * Start editing an existing profile
   */
  function startEditProfile(profileId: string): void {
    const profile = profiles.find(p => p.modelConfig.id === profileId)
    if (!profile) return

    setEditingProfileId(profileId)
    setIsNewProfile(false)
    setFormState(createFormStateFromProfile(profile))

    // Load cached models for this provider
    const cacheKey = generateCacheKey(profile.provider.id, profile.credential.apiKey)
    const cached = modelsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min TTL
      setAvailableModels(cached.models)
    }
    else {
      setAvailableModels([])
    }

    setTestStatus('idle')
    setTestMessage('')
  }

  /**
   * Cancel editing
   */
  function cancelEdit(): void {
    setEditingProfileId(null)
    setIsNewProfile(false)
    setFormState(createDefaultFormState())
    setAvailableModels([])
    setTestStatus('idle')
    setTestMessage('')
  }

  /**
   * Update form state
   */
  function updateFormState(updates: Partial<ProfileFormState>): void {
    setFormState(prev => ({ ...prev, ...updates }))
  }

  /**
   * Fetch models for a provider
   */
  async function fetchModels(providerId: string, apiKey: string): Promise<SelectableModel[]> {
    const provider = getProviderConfigById(providerId)
    if (!provider?.features.supportsModelFetching) {
      setAvailableModels([])
      return []
    }

    const cacheKey = generateCacheKey(providerId, apiKey)
    const cached = modelsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 300000) {
      setAvailableModels(cached.models)
      return cached.models
    }

    setIsFetchingModels(true)
    try {
      const models = await fetchProviderSelectableModels(providerId, apiKey)
      setAvailableModels(models)
      modelsCache.set(cacheKey, { models, timestamp: Date.now() })
      return models
    }
    catch (error) {
      console.error('[useProviderProfiles] Failed to fetch models:', error)
      setAvailableModels([])
      return []
    }
    finally {
      setIsFetchingModels(false)
    }
  }

  /**
   * Save profile (create or update)
   */
  async function saveProfile(): Promise<boolean> {
    try {
      const { profileId, name, providerId, apiKey, model, temperature, maxTokens, compressionMode } = formState
      const provider = getProviderConfigById(providerId)
      if (!provider) {
        setTestStatus('error')
        setTestMessage('Invalid provider')
        return false
      }

      // Validate API key if required
      if (provider.features.requiresApiKey !== false && !apiKey.trim()) {
        setTestStatus('error')
        setTestMessage('API key is required for this provider')
        return false
      }

      // Validate model
      if (!model.trim()) {
        setTestStatus('error')
        setTestMessage('Model is required')
        return false
      }

      // Find or create credential
      let credential: Credential
      const existingCred = apiKey.trim()
        ? await findCredentialByApiKey(apiKey.trim())
        : null

      if (existingCred) {
        credential = existingCred
      }
      else {
        const credentialName = `${provider.displayName} - ${name || 'Default'}`
        credential = await createCredential({
          name: credentialName,
          apiKey: provider.features.requiresApiKey === false ? NO_API_KEY_PLACEHOLDER : apiKey.trim(),
        })
      }

      if (profileId) {
        // Update existing config
        const config = profiles.find(p => p.modelConfig.id === profileId)?.modelConfig
        if (!config) {
          setTestStatus('error')
          setTestMessage('Profile not found')
          return false
        }

        await updateModelConfig(config.id, {
          name,
          model,
          temperature,
          maxTokens,
          compressionMode,
        })
      }
      else {
        // Create new config
        await createModelConfig({
          credentialId: credential.id,
          providerId,
          name,
          model,
          temperature,
          maxTokens,
          compressionMode,
          isDefault: profiles.length === 0, // First profile is default
        })
      }

      await loadProfiles()
      cancelEdit()
      return true
    }
    catch (error) {
      console.error('[useProviderProfiles] Failed to save profile:', error)
      setTestStatus('error')
      setTestMessage(typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'Failed to save profile')
      return false
    }
  }

  /**
   * Delete profile
   */
  async function deleteProfile(profileId: string): Promise<boolean> {
    if (profiles.length <= 1) {
      return false // Don't allow deleting the last profile
    }

    try {
      await deleteModelConfig(profileId)
      await loadProfiles()
      return true
    }
    catch (error) {
      console.error('[useProviderProfiles] Failed to delete profile:', error)
      return false
    }
  }

  /**
   * Set profile as default
   */
  async function setDefaultProfile(profileId: string): Promise<boolean> {
    try {
      await setDefaultModelConfig(profileId)
      await loadProfiles()
      return true
    }
    catch (error) {
      console.error('[useProviderProfiles] Failed to set default profile:', error)
      return false
    }
  }

  /**
   * Test connection with current form settings
   */
  async function testConnection(): Promise<boolean> {
    const { providerId, apiKey, model } = formState
    const provider = getProviderConfigById(providerId)
    if (!provider) return false

    setTestStatus('testing')
    setTestMessage('Testing connection...')

    try {
      const result = await testConnectionWithConfig(
        providerId,
        provider.features.requiresApiKey === false ? NO_API_KEY_PLACEHOLDER : apiKey,
        model,
      )

      if (!result.success) {
        throw new Error(result.error || 'Connection failed')
      }

      setTestStatus('success')
      setTestMessage('Connection successful!')
      return true
    }
    catch (error) {
      setTestStatus('error')
      setTestMessage(typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'Connection failed')
      return false
    }
  }

  /**
   * Get usage stats for a profile
   * Note: This is a placeholder - actual implementation would query usage data
   */
  function showUsageStats(profileId: string): UsageStats | null {
    const profile = profiles.find(p => p.modelConfig.id === profileId)
    if (!profile) return null

    // TODO: Implement actual usage stats retrieval
    return {
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      timeRange: 'All time',
      dataPoints: [],
    }
  }

  // Load profiles on mount
  useEffect(() => {
    void loadProfiles()
  }, [])

  return {
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
    loadProfiles,
    startNewProfile,
    startEditProfile,
    cancelEdit,
    updateFormState,
    saveProfile,
    deleteProfile,
    setDefaultProfile,
    testConnection,
    fetchModels,
    showUsageStats,
  }
}

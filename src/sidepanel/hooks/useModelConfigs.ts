/**
 * useModelConfigs Hook
 *
 * Manages AI model configurations (profiles) for the application.
 * Provides CRUD operations for model configs and tracks the default config.
 */

import { signal, computed } from '@preact/signals'
import { useCallback, useEffect } from 'preact/hooks'
import type { ModelConfig } from '../../types/index.ts'
import {
  getModelConfigSettings,
  createModelConfig as createModelConfigService,
  updateModelConfig as updateModelConfigService,
  deleteModelConfig as deleteModelConfigService,
  setDefaultModelConfig as setDefaultModelConfigService,
} from '../../lib/model-configs.ts'
import { getAllProviders, type ProviderConfig } from '../../lib/provider-registry.ts'

// Signals for global state
export const modelConfigs = signal<ModelConfig[]>([])
export const defaultModelConfigId = signal<string>('')
export const loadingConfigs = signal<boolean>(false)

// Computed values
export const defaultModelConfig = computed(() =>
  modelConfigs.value.find(c => c.id === defaultModelConfigId.value) ?? null,
)

export const hasModelConfigs = computed(() => modelConfigs.value.length > 0)

export interface UseModelConfigsReturn {
  modelConfigs: ModelConfig[]
  defaultModelConfigId: string
  defaultModelConfig: ModelConfig | null
  loading: boolean
  providers: ProviderConfig[]
  loadConfigs: () => Promise<void>
  createConfig: (config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ModelConfig>
  updateConfig: (id: string, updates: Partial<Omit<ModelConfig, 'id' | 'createdAt'>>) => Promise<void>
  deleteConfig: (id: string) => Promise<void>
  setDefault: (id: string) => Promise<void>
}

export function useModelConfigs(): UseModelConfigsReturn {
  // Get all available providers
  const providers = getAllProviders()

  // Load model configs from storage
  const loadConfigs = useCallback(async () => {
    loadingConfigs.value = true
    try {
      const settings = await getModelConfigSettings()
      modelConfigs.value = settings.modelConfigs
      defaultModelConfigId.value = settings.defaultModelConfigId
    }
    catch (error) {
      console.error('[useModelConfigs] Failed to load configs:', error)
    }
    finally {
      loadingConfigs.value = false
    }
  }, [])

  // Create a new model config
  const createConfig = useCallback(async (
    config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ModelConfig> => {
    const newConfig = await createModelConfigService(config)
    await loadConfigs() // Reload to sync state
    return newConfig
  }, [loadConfigs])

  // Update an existing model config
  const updateConfig = useCallback(async (
    id: string,
    updates: Partial<Omit<ModelConfig, 'id' | 'createdAt'>>,
  ): Promise<void> => {
    await updateModelConfigService(id, updates)
    await loadConfigs() // Reload to sync state
  }, [loadConfigs])

  // Delete a model config
  const deleteConfig = useCallback(async (id: string): Promise<void> => {
    await deleteModelConfigService(id)
    await loadConfigs() // Reload to sync state
  }, [loadConfigs])

  // Set the default model config
  const setDefault = useCallback(async (id: string): Promise<void> => {
    await setDefaultModelConfigService(id)
    await loadConfigs() // Reload to sync state
  }, [loadConfigs])

  // Load configs on mount
  useEffect(() => {
    void loadConfigs()
  }, [loadConfigs])

  return {
    modelConfigs: modelConfigs.value,
    defaultModelConfigId: defaultModelConfigId.value,
    defaultModelConfig: defaultModelConfig.value,
    loading: loadingConfigs.value,
    providers,
    loadConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    setDefault,
  }
}

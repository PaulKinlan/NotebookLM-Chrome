/**
 * Model Configuration Management
 *
 * Manages AI model configurations that reference credentials and registry providers.
 * Each model config belongs to one credential and one registry provider entry.
 */

import type { ModelConfig, ModelConfigSettings, Credential, Notebook } from '../types/index.ts';
import { dbGet, dbPut, dbDelete } from './db.ts';
import { getCredential, createCredential, findCredentialByApiKey } from './credentials.ts';
import { getProviderConfigById, getAllProviders } from './provider-registry.ts';

// Special placeholder for providers that don't require API keys
export const NO_API_KEY_PLACEHOLDER = '__NO_API_KEY__';

const MODEL_CONFIG_SETTINGS_KEY = 'modelConfigSettings';

/**
 * Get all model config settings including configs and default ID
 */
export async function getModelConfigSettings(): Promise<ModelConfigSettings> {
  const result = await dbGet<{ key: string; value: ModelConfigSettings }>(
    'settings',
    MODEL_CONFIG_SETTINGS_KEY
  );

  if (!result) {
    return { modelConfigs: [], defaultModelConfigId: '' };
  }

  return result.value;
}

/**
 * Save model config settings
 */
export async function saveModelConfigSettings(settings: ModelConfigSettings): Promise<void> {
  await dbPut('settings', { key: MODEL_CONFIG_SETTINGS_KEY, value: settings });
}

/**
 * Get all model configurations
 */
export async function getModelConfigs(): Promise<ModelConfig[]> {
  const settings = await getModelConfigSettings();
  return settings.modelConfigs;
}

/**
 * Get a specific model config by ID
 */
export async function getModelConfig(id: string): Promise<ModelConfig | null> {
  const modelConfigs = await getModelConfigs();
  return modelConfigs.find((m) => m.id === id) || null;
}

/**
 * Get the default model config
 */
export async function getDefaultModelConfig(): Promise<ModelConfig | null> {
  const settings = await getModelConfigSettings();
  if (!settings.defaultModelConfigId) {
    return null;
  }
  return getModelConfig(settings.defaultModelConfigId);
}

/**
 * Create a new model config
 */
export async function createModelConfig(
  modelConfig: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ModelConfig> {
  const settings = await getModelConfigSettings();

  const newModelConfig: ModelConfig = {
    ...modelConfig,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // If this is the first model config or marked as default, make it default
  if (settings.modelConfigs.length === 0 || modelConfig.isDefault) {
    // Unmark existing default
    settings.modelConfigs.forEach((m) => (m.isDefault = false));
    newModelConfig.isDefault = true;
    settings.defaultModelConfigId = newModelConfig.id;
  }

  settings.modelConfigs.push(newModelConfig);
  await saveModelConfigSettings(settings);

  return newModelConfig;
}

/**
 * Update an existing model config
 */
export async function updateModelConfig(
  id: string,
  updates: Partial<Omit<ModelConfig, 'id' | 'createdAt'>>
): Promise<void> {
  const settings = await getModelConfigSettings();
  const configIndex = settings.modelConfigs.findIndex((m) => m.id === id);

  if (configIndex === -1) {
    throw new Error(`ModelConfig ${id} not found`);
  }

  const modelConfig = settings.modelConfigs[configIndex];

  // If setting as default, unmark others
  if (updates.isDefault && !modelConfig.isDefault) {
    settings.modelConfigs.forEach((m) => (m.isDefault = false));
    settings.defaultModelConfigId = id;
  }

  // Update the model config
  settings.modelConfigs[configIndex] = {
    ...modelConfig,
    ...updates,
    id, // Ensure ID doesn't change
    createdAt: modelConfig.createdAt, // Preserve creation time
    updatedAt: Date.now(),
  };

  await saveModelConfigSettings(settings);
}

/**
 * Update compression mode for a model config
 */
export async function updateModelConfigCompressionMode(
  modelConfigId: string,
  compressionMode: 'two-pass' | 'single-pass'
): Promise<void> {
  await updateModelConfig(modelConfigId, { compressionMode });
}

/**
 * Delete a model config
 * @throws Error if trying to delete the last model config
 */
export async function deleteModelConfig(id: string): Promise<void> {
  const settings = await getModelConfigSettings();
  const configIndex = settings.modelConfigs.findIndex((m) => m.id === id);

  if (configIndex === -1) {
    throw new Error(`ModelConfig ${id} not found`);
  }

  // If deleting default model config, need to assign new default
  if (settings.defaultModelConfigId === id) {
    const remainingConfigs = settings.modelConfigs.filter((m) => m.id !== id);
    if (remainingConfigs.length === 0) {
      settings.defaultModelConfigId = '';
    } else {
      const newDefault = remainingConfigs[0];
      settings.defaultModelConfigId = newDefault.id;
    }
  }

  settings.modelConfigs = settings.modelConfigs.filter((m) => m.id !== id);
  await saveModelConfigSettings(settings);
}

/**
 * Set a specific model config as the default
 */
export async function setDefaultModelConfig(id: string): Promise<void> {
  await updateModelConfig(id, { isDefault: true });
}

/**
 * Resolved Model Config with Credential and Provider Info
 */
export interface ResolvedModelConfig {
  modelConfig: ModelConfig;
  credential: Credential;
  providerId: string;  // Registry provider entry ID
  baseURL: string;     // Resolved from registry
  providerType: string; // SDK type (anthropic, openai, etc.)
}

/**
 * Resolve the appropriate model config for a notebook
 * Falls back to default model config if notebook model config is not set or invalid
 * Applies optional credential override from notebook
 */
export async function resolveModelConfig(notebook?: Notebook): Promise<ResolvedModelConfig | null> {
  const settings = await getModelConfigSettings();

  if (!settings.defaultModelConfigId) {
    return null;
  }

  // Determine which model config to use
  let modelConfigId = settings.defaultModelConfigId;

  if (notebook?.modelConfigId) {
    const notebookConfig = settings.modelConfigs.find((m) => m.id === notebook.modelConfigId);
    if (notebookConfig) {
      modelConfigId = notebookConfig.id;
    } else {
      console.warn(
        `[ModelConfigs] Notebook model config ${notebook.modelConfigId} not found, falling back to default`
      );
    }
  }

  const modelConfig = settings.modelConfigs.find((m) => m.id === modelConfigId);
  if (!modelConfig) {
    return null;
  }

  // Get credential (with optional override from notebook)
  const credentialId = notebook?.credentialOverrideId || modelConfig.credentialId;
  const credential = await getCredential(credentialId);

  if (!credential) {
    console.warn(
      `[ModelConfigs] Credential ${credentialId} not found for model config ${modelConfig.id}`
    );
    return null;
  }

  // Get provider config from registry
  const providerConfig = getProviderConfigById(modelConfig.providerId);
  if (!providerConfig) {
    console.warn(
      `[ModelConfigs] Provider ${modelConfig.providerId} not found in registry`
    );
    return null;
  }

  return {
    modelConfig,
    credential,
    providerId: modelConfig.providerId,
    baseURL: providerConfig.baseURL || '',
    providerType: providerConfig.id,
  };
}

/**
 * Migrate legacy AISettings to Credential + ModelConfig
 *
 * Reads from 'aiSettings' key (used on main branch) and transforms:
 * - AISettings.apiKeys[provider] → Credential for each provider with a key
 * - AISettings.provider + AISettings.model → default ModelConfig
 *
 * Returns true if migration occurred, false otherwise
 */
export async function migrateLegacyAISettings(): Promise<boolean> {
  const LEGACY_AI_SETTINGS_KEY = 'aiSettings';

  try {
    const result = await dbGet<{ key: string; value: unknown }>('settings', LEGACY_AI_SETTINGS_KEY);

    if (!result) {
      return false;
    }

    const data = result.value;

    // Check if it looks like AISettings
    if (
      typeof data !== 'object' ||
      data === null ||
      !('provider' in data) ||
      !('model' in data) ||
      !('apiKeys' in data) ||
      typeof (data as { apiKeys: unknown }).apiKeys !== 'object'
    ) {
      return false;
    }

    const aiSettings = data as {
      provider: string;
      model: string;
      apiKeys: Record<string, string>;
      temperature?: number;
      maxTokens?: number;
    };

    console.log('[ModelConfigs] Migrating AISettings to Credential + ModelConfig...');

    // Get the provider registry to verify the provider exists
    const providers = getAllProviders();
    const providerConfig = providers.find((p: { id: string }) => p.id === aiSettings.provider);

    if (!providerConfig) {
      console.warn('[ModelConfigs] Provider', aiSettings.provider, 'not found in registry, skipping migration');
      return false;
    }

    // Create credentials for each API key
    const credentialIds = new Map<string, string>(); // Maps provider type → credential ID

    for (const [providerType, apiKey] of Object.entries(aiSettings.apiKeys)) {
      if (!apiKey) continue;

      // Check if credential with this API key already exists (deduplication)
      const existing = await findCredentialByApiKey(apiKey);

      if (existing) {
        credentialIds.set(providerType, existing.id);
        console.log('[ModelConfigs] Reusing existing credential for', providerType);
      } else {
        // Create new credential (name includes provider type for identification)
        const credential = await createCredential({
          name: `Migrated ${providerType}`,
          apiKey,
        });
        credentialIds.set(providerType, credential.id);
        console.log('[ModelConfigs] Created credential for', providerType);
      }
    }

    // Create default model config
    const selectedCredentialId = credentialIds.get(aiSettings.provider);
    if (!selectedCredentialId) {
      console.warn('[ModelConfigs] No credential found for selected provider', aiSettings.provider);
      return false;
    }

    // Check if a model config already exists
    const existingConfigs = await getModelConfigs();
    if (existingConfigs.length === 0) {
      // Create default model config
      await createModelConfig({
        name: `${aiSettings.provider} - ${aiSettings.model}`,
        credentialId: selectedCredentialId,
        providerId: aiSettings.provider,
        model: aiSettings.model,
        temperature: aiSettings.temperature,
        maxTokens: aiSettings.maxTokens,
        isDefault: true,
      });
      console.log('[ModelConfigs] Created default model config');
    }

    // Clean up legacy settings
    await dbDelete('settings', LEGACY_AI_SETTINGS_KEY);
    console.log('[ModelConfigs] Cleaned up legacy aiSettings');

    return true;
  } catch (error) {
    console.error('[ModelConfigs] Migration failed:', error);
    return false;
  }
}

/**
 * Initialize default Chrome Built-in profile if no profiles exist
 *
 * This is called on first install to provide a working AI profile out of the box.
 * Returns true if a default profile was created, false otherwise.
 */
export async function initializeDefaultProfile(): Promise<boolean> {
  try {
    const existingConfigs = await getModelConfigs();

    // Only create default if no profiles exist
    if (existingConfigs.length > 0) {
      return false;
    }

    console.log('[ModelConfigs] No profiles found, creating default Chrome Built-in profile...');

    // Create a placeholder credential for Chrome Built-in (no API key needed)
    let credentialId: string;
    const existingCredential = await findCredentialByApiKey(NO_API_KEY_PLACEHOLDER);

    if (existingCredential) {
      credentialId = existingCredential.id;
    } else {
      const credential = await createCredential({
        name: 'Chrome Built-in',
        apiKey: NO_API_KEY_PLACEHOLDER,
      });
      credentialId = credential.id;
    }

    // Create the default Chrome Built-in model config
    await createModelConfig({
      name: 'Chrome Built-in',
      credentialId,
      providerId: 'chrome',
      model: 'chrome-built-in',
      isDefault: true,
    });

    console.log('[ModelConfigs] Created default Chrome Built-in profile');
    return true;
  } catch (error) {
    console.error('[ModelConfigs] Failed to initialize default profile:', error);
    return false;
  }
}

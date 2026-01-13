/**
 * Unit tests for settings module
 *
 * Tests the AI settings management functions including:
 * - getAISettings: Retrieves settings with defaults
 * - saveAISettings: Persists settings to storage
 * - getApiKey/setApiKey: API key management
 * - setProvider/setModel: Provider and model configuration
 * - setTemperature/setMaxTokens/setBaseURL: Optional settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Global mock storage that will be cleared in beforeEach
// Use a global variable that vitest can see across module boundaries
declare global {
  var __mockSettingsStorage: Record<string, unknown>
}
globalThis.__mockSettingsStorage = globalThis.__mockSettingsStorage ?? {}

// Helper to clear the mock storage
const clearMockStorage = () => {
  globalThis.__mockSettingsStorage = {}
}

// Type guard to check if value is of type T
function isType<T>(value: unknown): value is T {
  return value !== undefined
}

// Mock the storage module before importing settings
vi.mock('./storage.ts', () => ({
  storage: {
    getSetting: vi.fn(<T>(key: string): Promise<T | null> => {
      const value = globalThis.__mockSettingsStorage[key]
      return Promise.resolve(isType<T>(value) ? value : null)
    }),
    setSetting: vi.fn(<T>(key: string, value: T): Promise<void> => {
      globalThis.__mockSettingsStorage[key] = value
      return Promise.resolve(undefined)
    }),
  },
}))

// Type for the settings module
type SettingsModule = typeof import('./settings.ts')

describe('settings', () => {
  // Re-import the module fresh for each test to ensure mock is applied
  let settings: SettingsModule

  beforeEach(async () => {
    // Clear the mock storage data before each test
    clearMockStorage()
    vi.clearAllMocks()

    // Reset modules to ensure fresh imports with mocks applied
    vi.resetModules()

    // Re-import the settings module
    // eslint-disable-next-line foliolm/no-dynamic-import -- Intentional: reload module with fresh mocks
    settings = await import('./settings.ts')
  })

  describe('getAISettings', () => {
    it('returns default settings when no settings exist', async () => {
      const result = await settings.getAISettings()

      expect(result).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250514',
        apiKeys: {},
        contextMode: 'classic',
      })
    })

    it('returns saved settings when they exist', async () => {
      const customSettings = {
        provider: 'openai' as const,
        model: 'gpt-4',
        apiKeys: { openai: 'test-key' },
        temperature: 0.7,
      }

      await settings.saveAISettings(customSettings)
      const result = await settings.getAISettings()

      expect(result).toEqual(customSettings)
    })
  })

  describe('saveAISettings', () => {
    it('persists settings to storage', async () => {
      const aiSettings = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus',
        apiKeys: { anthropic: 'sk-test-key' },
      }

      await settings.saveAISettings(aiSettings)
      const retrieved = await settings.getAISettings()

      expect(retrieved).toEqual(aiSettings)
    })

    it('overwrites existing settings', async () => {
      const initialSettings = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus',
        apiKeys: {},
      }

      const updatedSettings = {
        provider: 'openai' as const,
        model: 'gpt-4-turbo',
        apiKeys: { openai: 'new-key' },
      }

      await settings.saveAISettings(initialSettings)
      await settings.saveAISettings(updatedSettings)
      const retrieved = await settings.getAISettings()

      expect(retrieved).toEqual(updatedSettings)
    })

    it('persists optional fields', async () => {
      const aiSettings = {
        provider: 'openai' as const,
        model: 'gpt-4',
        apiKeys: {},
        temperature: 0.5,
        maxTokens: 1000,
        baseURL: 'https://custom-api.example.com',
      }

      await settings.saveAISettings(aiSettings)
      const retrieved = await settings.getAISettings()

      expect(retrieved.temperature).toBe(0.5)
      expect(retrieved.maxTokens).toBe(1000)
      expect(retrieved.baseURL).toBe('https://custom-api.example.com')
    })
  })

  describe('getApiKey', () => {
    it('returns undefined for non-existent provider key', async () => {
      const key = await settings.getApiKey('anthropic')

      expect(key).toBeUndefined()
    })

    it('returns stored API key for provider', async () => {
      await settings.saveAISettings({
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKeys: { anthropic: 'sk-test-123' },
      })

      const key = await settings.getApiKey('anthropic')

      expect(key).toBe('sk-test-123')
    })

    it('returns correct key when multiple providers have keys', async () => {
      await settings.saveAISettings({
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKeys: {
          anthropic: 'anthropic-key',
          openai: 'openai-key',
          google: 'google-key',
        },
      })

      expect(await settings.getApiKey('anthropic')).toBe('anthropic-key')
      expect(await settings.getApiKey('openai')).toBe('openai-key')
      expect(await settings.getApiKey('google')).toBe('google-key')
    })
  })

  describe('setApiKey', () => {
    it('adds API key to empty apiKeys object', async () => {
      await settings.setApiKey('anthropic', 'new-api-key')

      const result = await settings.getAISettings()
      expect(result.apiKeys.anthropic).toBe('new-api-key')
    })

    it('updates existing API key', async () => {
      await settings.setApiKey('anthropic', 'old-key')
      await settings.setApiKey('anthropic', 'new-key')

      const result = await settings.getAISettings()
      expect(result.apiKeys.anthropic).toBe('new-key')
    })

    it('preserves other provider keys when setting a new one', async () => {
      await settings.setApiKey('anthropic', 'anthropic-key')
      await settings.setApiKey('openai', 'openai-key')

      const result = await settings.getAISettings()
      expect(result.apiKeys.anthropic).toBe('anthropic-key')
      expect(result.apiKeys.openai).toBe('openai-key')
    })

    it('preserves other settings when setting API key', async () => {
      await settings.saveAISettings({
        provider: 'openai',
        model: 'gpt-4',
        apiKeys: {},
        temperature: 0.8,
      })

      await settings.setApiKey('openai', 'test-key')

      const result = await settings.getAISettings()
      expect(result.provider).toBe('openai')
      expect(result.model).toBe('gpt-4')
      expect(result.temperature).toBe(0.8)
    })
  })

  describe('setProvider', () => {
    it('sets provider on default settings', async () => {
      await settings.setProvider('openai')

      const result = await settings.getAISettings()
      expect(result.provider).toBe('openai')
    })

    it('updates existing provider', async () => {
      await settings.saveAISettings({
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKeys: {},
      })

      await settings.setProvider('google')

      const result = await settings.getAISettings()
      expect(result.provider).toBe('google')
    })

    it('preserves other settings when changing provider', async () => {
      await settings.saveAISettings({
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKeys: { anthropic: 'test-key' },
        temperature: 0.7,
        maxTokens: 2000,
      })

      await settings.setProvider('openai')

      const result = await settings.getAISettings()
      expect(result.model).toBe('claude-3-opus')
      expect(result.apiKeys.anthropic).toBe('test-key')
      expect(result.temperature).toBe(0.7)
      expect(result.maxTokens).toBe(2000)
    })
  })

  describe('setModel', () => {
    it('sets model on default settings', async () => {
      await settings.setModel('gpt-4-turbo')

      const result = await settings.getAISettings()
      expect(result.model).toBe('gpt-4-turbo')
    })

    it('updates existing model', async () => {
      await settings.saveAISettings({
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKeys: {},
      })

      await settings.setModel('claude-3-5-sonnet')

      const result = await settings.getAISettings()
      expect(result.model).toBe('claude-3-5-sonnet')
    })

    it('preserves other settings when changing model', async () => {
      await settings.saveAISettings({
        provider: 'openai',
        model: 'gpt-4',
        apiKeys: { openai: 'key' },
        temperature: 0.5,
      })

      await settings.setModel('gpt-4-turbo')

      const result = await settings.getAISettings()
      expect(result.provider).toBe('openai')
      expect(result.apiKeys.openai).toBe('key')
      expect(result.temperature).toBe(0.5)
    })
  })

  describe('setTemperature', () => {
    it('sets temperature on default settings', async () => {
      await settings.setTemperature(0.5)

      const result = await settings.getAISettings()
      expect(result.temperature).toBe(0.5)
    })

    it('updates existing temperature', async () => {
      await settings.setTemperature(0.3)
      await settings.setTemperature(0.9)

      const result = await settings.getAISettings()
      expect(result.temperature).toBe(0.9)
    })

    it('sets temperature to 0', async () => {
      await settings.setTemperature(0)

      const result = await settings.getAISettings()
      expect(result.temperature).toBe(0)
    })

    it('sets temperature to 1', async () => {
      await settings.setTemperature(1)

      const result = await settings.getAISettings()
      expect(result.temperature).toBe(1)
    })

    it('preserves other settings when changing temperature', async () => {
      await settings.saveAISettings({
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKeys: { anthropic: 'key' },
      })

      await settings.setTemperature(0.7)

      const result = await settings.getAISettings()
      expect(result.provider).toBe('anthropic')
      expect(result.model).toBe('claude-3-opus')
      expect(result.apiKeys.anthropic).toBe('key')
    })
  })

  describe('setMaxTokens', () => {
    it('sets maxTokens on default settings', async () => {
      await settings.setMaxTokens(1000)

      const result = await settings.getAISettings()
      expect(result.maxTokens).toBe(1000)
    })

    it('updates existing maxTokens', async () => {
      await settings.setMaxTokens(500)
      await settings.setMaxTokens(2000)

      const result = await settings.getAISettings()
      expect(result.maxTokens).toBe(2000)
    })

    it('sets maxTokens to undefined to clear it', async () => {
      await settings.setMaxTokens(1000)
      await settings.setMaxTokens(undefined)

      const result = await settings.getAISettings()
      expect(result.maxTokens).toBeUndefined()
    })

    it('preserves other settings when changing maxTokens', async () => {
      await settings.saveAISettings({
        provider: 'openai',
        model: 'gpt-4',
        apiKeys: {},
        temperature: 0.6,
      })

      await settings.setMaxTokens(4096)

      const result = await settings.getAISettings()
      expect(result.provider).toBe('openai')
      expect(result.model).toBe('gpt-4')
      expect(result.temperature).toBe(0.6)
    })
  })

  describe('setBaseURL', () => {
    it('sets baseURL on default settings', async () => {
      await settings.setBaseURL('https://api.custom.com')

      const result = await settings.getAISettings()
      expect(result.baseURL).toBe('https://api.custom.com')
    })

    it('updates existing baseURL', async () => {
      await settings.setBaseURL('https://old-api.com')
      await settings.setBaseURL('https://new-api.com')

      const result = await settings.getAISettings()
      expect(result.baseURL).toBe('https://new-api.com')
    })

    it('sets baseURL to undefined to clear it', async () => {
      await settings.setBaseURL('https://api.example.com')
      await settings.setBaseURL(undefined)

      const result = await settings.getAISettings()
      expect(result.baseURL).toBeUndefined()
    })

    it('preserves other settings when changing baseURL', async () => {
      await settings.saveAISettings({
        provider: 'openai',
        model: 'gpt-4',
        apiKeys: { openai: 'key' },
        temperature: 0.5,
        maxTokens: 1000,
      })

      await settings.setBaseURL('https://custom.example.com/v1')

      const result = await settings.getAISettings()
      expect(result.provider).toBe('openai')
      expect(result.model).toBe('gpt-4')
      expect(result.apiKeys.openai).toBe('key')
      expect(result.temperature).toBe(0.5)
      expect(result.maxTokens).toBe(1000)
    })
  })

  describe('integration scenarios', () => {
    it('handles complete settings workflow', async () => {
      // Start with defaults
      let result = await settings.getAISettings()
      expect(result.provider).toBe('anthropic')

      // Configure for OpenAI
      await settings.setProvider('openai')
      await settings.setModel('gpt-4-turbo')
      await settings.setApiKey('openai', 'sk-openai-key')
      await settings.setTemperature(0.7)
      await settings.setMaxTokens(4096)

      result = await settings.getAISettings()
      expect(result).toEqual({
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKeys: { openai: 'sk-openai-key' },
        temperature: 0.7,
        maxTokens: 4096,
        contextMode: 'classic',
      })

      // Switch to Anthropic
      await settings.setProvider('anthropic')
      await settings.setModel('claude-3-opus')
      await settings.setApiKey('anthropic', 'sk-anthropic-key')

      result = await settings.getAISettings()
      expect(result.provider).toBe('anthropic')
      expect(result.model).toBe('claude-3-opus')
      // Both API keys should be preserved
      expect(result.apiKeys.openai).toBe('sk-openai-key')
      expect(result.apiKeys.anthropic).toBe('sk-anthropic-key')
    })

    it('maintains settings consistency across multiple operations', async () => {
      // Set up initial state
      await settings.saveAISettings({
        provider: 'google',
        model: 'gemini-pro',
        apiKeys: { google: 'google-key' },
      })

      // Perform multiple sequential updates
      await settings.setTemperature(0.3)
      await settings.setMaxTokens(2000)
      await settings.setBaseURL('https://custom.googleapis.com')
      await settings.setApiKey('anthropic', 'anthropic-key')
      await settings.setProvider('anthropic')
      await settings.setModel('claude-3-5-sonnet')

      const result = await settings.getAISettings()

      // All updates should be reflected
      expect(result.provider).toBe('anthropic')
      expect(result.model).toBe('claude-3-5-sonnet')
      expect(result.temperature).toBe(0.3)
      expect(result.maxTokens).toBe(2000)
      expect(result.baseURL).toBe('https://custom.googleapis.com')
      expect(result.apiKeys.google).toBe('google-key')
      expect(result.apiKeys.anthropic).toBe('anthropic-key')
    })
  })
})

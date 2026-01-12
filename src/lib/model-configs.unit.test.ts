/**
 * Tests for model-configs module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getModelConfigs, createModelConfig, deleteModelConfig } from './model-configs'

describe('model-configs', () => {
  beforeEach(() => {
    // Reset chrome.storage mock before each test
    // @ts-expect-error - Internal test helper
    (globalThis as { chrome?: { storage: { local: { _setData: (data: unknown) => void } } } }).chrome?.storage.local._setData({})
  })

  describe('getModelConfigs', () => {
    it('returns empty array when no configs exist', async () => {
      const configs = await getModelConfigs()
      expect(configs).toEqual([])
    })
  })

  describe('createModelConfig', () => {
    it('creates a new model config with generated ID', async () => {
      const config = await createModelConfig({
        name: 'Test Config',
        credentialId: 'cred-123',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        isDefault: false,
      })

      expect(config.id).toBeDefined()
      expect(config.name).toBe('Test Config')
      expect(config.credentialId).toBe('cred-123')
      expect(config.providerId).toBe('anthropic')
      expect(config.model).toBe('claude-3-5-sonnet')
      expect(config.createdAt).toBeDefined()
      expect(config.updatedAt).toBeDefined()
    })

    it('sets first config as default automatically', async () => {
      const config = await createModelConfig({
        name: 'First Config',
        credentialId: 'cred-123',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        isDefault: false,
      })

      expect(config.isDefault).toBe(true)
    })
  })

  describe('deleteModelConfig', () => {
    it('throws error when deleting non-existent config', async () => {
      await expect(deleteModelConfig('non-existent-id')).rejects.toThrow(
        'ModelConfig non-existent-id not found',
      )
    })

    it('deletes an existing model config', async () => {
      const config = await createModelConfig({
        name: 'To Delete',
        credentialId: 'cred-123',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        isDefault: false,
      })

      await deleteModelConfig(config.id)

      const configs = await getModelConfigs()
      expect(configs).toHaveLength(0)
    })
  })
})

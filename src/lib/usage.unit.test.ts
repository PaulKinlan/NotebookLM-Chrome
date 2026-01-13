/**
 * Tests for usage tracking module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getUsageRecords,
  saveUsageRecord,
  trackUsage,
  deleteUsageRecordsForProfile,
  clearAllUsageRecords,
  getUsageStats,
  formatTokenCount,
  formatCost,
  getTimeRangeLabel,
} from './usage'

describe('usage', () => {
  beforeEach(() => {
    // Reset chrome.storage mock before each test
    // @ts-expect-error - Internal test helper
    (globalThis as { chrome?: { storage: { local: { _setData: (data: unknown) => void } } } }).chrome?.storage.local._setData({})
  })

  describe('getUsageRecords', () => {
    it('returns empty array when no records exist', async () => {
      const records = await getUsageRecords()
      expect(records).toEqual([])
    })
  })

  describe('saveUsageRecord', () => {
    it('creates a new usage record with generated ID', async () => {
      const record = await saveUsageRecord({
        modelConfigId: 'config-123',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        timestamp: Date.now(),
        operation: 'chat',
      })

      expect(record.id).toBeDefined()
      expect(record.modelConfigId).toBe('config-123')
      expect(record.providerId).toBe('anthropic')
      expect(record.model).toBe('claude-3-5-sonnet')
      expect(record.inputTokens).toBe(100)
      expect(record.outputTokens).toBe(50)
      expect(record.totalTokens).toBe(150)
      expect(record.operation).toBe('chat')
    })

    it('stores record in chrome.storage.local', async () => {
      await saveUsageRecord({
        modelConfigId: 'config-123',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        timestamp: Date.now(),
        operation: 'chat',
      })

      const records = await getUsageRecords()
      expect(records).toHaveLength(1)
    })
  })

  describe('trackUsage', () => {
    it('creates and saves a usage record', async () => {
      const record = await trackUsage({
        modelConfigId: 'config-456',
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'transform',
      })

      expect(record.modelConfigId).toBe('config-456')
      expect(record.totalTokens).toBe(300)
      expect(record.operation).toBe('transform')
      expect(record.timestamp).toBeDefined()
    })
  })

  describe('deleteUsageRecordsForProfile', () => {
    it('deletes only records for specified profile', async () => {
      await trackUsage({
        modelConfigId: 'profile-1',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      })

      await trackUsage({
        modelConfigId: 'profile-2',
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'chat',
      })

      await deleteUsageRecordsForProfile('profile-1')

      const records = await getUsageRecords()
      expect(records).toHaveLength(1)
      expect(records[0].modelConfigId).toBe('profile-2')
    })
  })

  describe('clearAllUsageRecords', () => {
    it('removes all usage records', async () => {
      await trackUsage({
        modelConfigId: 'profile-1',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 50,
        operation: 'chat',
      })

      await trackUsage({
        modelConfigId: 'profile-2',
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 100,
        operation: 'chat',
      })

      await clearAllUsageRecords()

      const records = await getUsageRecords()
      expect(records).toHaveLength(0)
    })
  })

  describe('getUsageStats', () => {
    it('returns empty stats when no records exist', async () => {
      const stats = await getUsageStats('profile-1', 'week')

      expect(stats.totalInputTokens).toBe(0)
      expect(stats.totalOutputTokens).toBe(0)
      expect(stats.totalTokens).toBe(0)
      expect(stats.requestCount).toBe(0)
    })

    it('returns correct statistics for records within time range', async () => {
      const now = Date.now()

      // Record within last week
      await saveUsageRecord({
        modelConfigId: 'profile-1',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        timestamp: now - 1000 * 60 * 60, // 1 hour ago
        operation: 'chat',
      })

      const stats = await getUsageStats('profile-1', 'week')

      expect(stats.totalInputTokens).toBe(100)
      expect(stats.totalOutputTokens).toBe(50)
      expect(stats.totalTokens).toBe(150)
      expect(stats.requestCount).toBe(1)
    })

    it('filters by profile ID', async () => {
      const now = Date.now()

      await saveUsageRecord({
        modelConfigId: 'profile-1',
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        timestamp: now,
        operation: 'chat',
      })

      await saveUsageRecord({
        modelConfigId: 'profile-2',
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        timestamp: now,
        operation: 'chat',
      })

      const stats = await getUsageStats('profile-1', 'week')

      expect(stats.totalTokens).toBe(150)
      expect(stats.requestCount).toBe(1)
    })
  })

  // getUsageDataPoints test is skipped as it involves complex date iteration
  // and is better tested via integration tests

  describe('formatTokenCount', () => {
    it('formats millions correctly', () => {
      expect(formatTokenCount(1500000)).toBe('1.50M')
    })

    it('formats thousands correctly', () => {
      expect(formatTokenCount(1500)).toBe('1.5K')
    })

    it('formats small numbers as-is', () => {
      expect(formatTokenCount(150)).toBe('150')
    })
  })

  describe('formatCost', () => {
    it('formats zero correctly', () => {
      expect(formatCost(0)).toBe('$0.00')
    })

    it('formats very small costs with precision', () => {
      expect(formatCost(0.0015)).toBe('$0.0015')
    })

    it('formats small costs with 3 decimals', () => {
      expect(formatCost(0.15)).toBe('$0.150')
    })

    it('formats larger costs with 2 decimals', () => {
      expect(formatCost(5.25)).toBe('$5.25')
    })
  })

  describe('getTimeRangeLabel', () => {
    it('returns correct labels', () => {
      expect(getTimeRangeLabel('day')).toBe('Last 24 Hours')
      expect(getTimeRangeLabel('week')).toBe('Last 7 Days')
      expect(getTimeRangeLabel('month')).toBe('Last 30 Days')
      expect(getTimeRangeLabel('quarter')).toBe('Last 90 Days')
      expect(getTimeRangeLabel('year')).toBe('Last Year')
    })
  })
})

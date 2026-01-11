/**
 * Usage Tracking Storage Utilities
 *
 * Tracks API usage (tokens, cost) per AI profile for analytics and cost monitoring.
 * Usage records are stored in chrome.storage.local for persistence.
 */

import type { UsageRecord, UsageStats, UsageDataPoint, UsageTimeRange } from '../types/index.ts';
import { calculateTokenCost } from './provider-registry.ts';

// Storage key for usage records
const USAGE_STORAGE_KEY = 'usageRecords';

// Maximum number of records to keep (rolling window)
const MAX_USAGE_RECORDS = 10000;

/**
 * Type guard to check if a value is an array of UsageRecord
 */
function isUsageRecordArray(value: unknown): value is UsageRecord[] {
  if (!Array.isArray(value)) return false;

  // Check if all items have required UsageRecord properties
  return value.every(item =>
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'modelConfigId' in item &&
    'providerId' in item &&
    'model' in item &&
    'inputTokens' in item &&
    'outputTokens' in item &&
    'timestamp' in item
  );
}

// ============================================================================
// Record Management
// ============================================================================

/**
 * Get all usage records from storage
 */
export async function getUsageRecords(): Promise<UsageRecord[]> {
  const result = await chrome.storage.local.get([USAGE_STORAGE_KEY]);
  const value = result[USAGE_STORAGE_KEY];

  if (value === undefined) return [];
  if (isUsageRecordArray(value)) return value;

  // If format is invalid, return empty array
  return [];
}

/**
 * Save a new usage record
 */
export async function saveUsageRecord(
  record: Omit<UsageRecord, 'id' | 'cost'>
): Promise<UsageRecord> {
  const records = await getUsageRecords();

  // Calculate cost if pricing is available
  const cost = calculateTokenCost(
    record.providerId,
    record.model,
    record.inputTokens,
    record.outputTokens
  ) ?? undefined;

  const newRecord: UsageRecord = {
    ...record,
    id: crypto.randomUUID(),
    cost,
  };

  // Add new record and trim if needed
  records.push(newRecord);
  if (records.length > MAX_USAGE_RECORDS) {
    // Remove oldest records
    records.splice(0, records.length - MAX_USAGE_RECORDS);
  }

  await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: records });

  return newRecord;
}

/**
 * Create and save a usage record from API response data
 */
export async function trackUsage(params: {
  modelConfigId: string;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  operation: UsageRecord['operation'];
}): Promise<UsageRecord> {
  return saveUsageRecord({
    modelConfigId: params.modelConfigId,
    providerId: params.providerId,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: params.inputTokens + params.outputTokens,
    timestamp: Date.now(),
    operation: params.operation,
  });
}

/**
 * Delete all usage records for a specific model config
 */
export async function deleteUsageRecordsForProfile(modelConfigId: string): Promise<void> {
  const records = await getUsageRecords();
  const filtered = records.filter((r) => r.modelConfigId !== modelConfigId);

  await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: filtered });
}

/**
 * Clear all usage records
 */
export async function clearAllUsageRecords(): Promise<void> {
  await chrome.storage.local.remove([USAGE_STORAGE_KEY]);
}

// ============================================================================
// Statistics and Aggregation
// ============================================================================

/**
 * Get the start timestamp for a given time range
 */
function getTimeRangeStart(range: UsageTimeRange): number {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (range) {
    case 'day':
      return now - msPerDay;
    case 'week':
      return now - 7 * msPerDay;
    case 'month':
      return now - 30 * msPerDay;
    case 'quarter':
      return now - 90 * msPerDay;
    case 'year':
      return now - 365 * msPerDay;
    default:
      return now - 7 * msPerDay; // Default to week
  }
}

/**
 * Get usage statistics for a specific model config within a time range
 */
export async function getUsageStats(
  modelConfigId: string,
  timeRange: UsageTimeRange
): Promise<UsageStats> {
  const records = await getUsageRecords();
  const startTime = getTimeRangeStart(timeRange);

  const filteredRecords = records.filter(
    (r) => r.modelConfigId === modelConfigId && r.timestamp >= startTime
  );

  const stats: UsageStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    requestCount: filteredRecords.length,
    records: filteredRecords,
  };

  for (const record of filteredRecords) {
    stats.totalInputTokens += record.inputTokens;
    stats.totalOutputTokens += record.outputTokens;
    stats.totalTokens += record.totalTokens;
    stats.totalCost += record.cost ?? 0;
  }

  return stats;
}

/**
 * Get usage data points grouped by day for charting
 */
export async function getUsageDataPoints(
  modelConfigId: string,
  timeRange: UsageTimeRange
): Promise<UsageDataPoint[]> {
  const records = await getUsageRecords();
  const startTime = getTimeRangeStart(timeRange);

  const filteredRecords = records.filter(
    (r) => r.modelConfigId === modelConfigId && r.timestamp >= startTime
  );

  // Group records by date
  const groupedByDate = new Map<string, UsageDataPoint>();

  for (const record of filteredRecords) {
    const date = new Date(record.timestamp).toISOString().split('T')[0];

    if (!groupedByDate.has(date)) {
      groupedByDate.set(date, {
        date,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        requestCount: 0,
      });
    }

    const dataPoint = groupedByDate.get(date);
    if (dataPoint) {
      dataPoint.inputTokens += record.inputTokens;
      dataPoint.outputTokens += record.outputTokens;
      dataPoint.totalTokens += record.totalTokens;
      dataPoint.cost += record.cost ?? 0;
      dataPoint.requestCount += 1;
    }
  }

  // Fill in missing dates with zero values
  const dataPoints: UsageDataPoint[] = [];
  const now = new Date();
  const start = new Date(startTime);

  // Iterate through each day in the range
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const existing = groupedByDate.get(dateStr);

    if (existing) {
      dataPoints.push(existing);
    } else {
      dataPoints.push({
        date: dateStr,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        requestCount: 0,
      });
    }
  }

  return dataPoints;
}

/**
 * Get total usage across all profiles within a time range
 */
export async function getTotalUsageStats(timeRange: UsageTimeRange): Promise<UsageStats> {
  const records = await getUsageRecords();
  const startTime = getTimeRangeStart(timeRange);

  const filteredRecords = records.filter((r) => r.timestamp >= startTime);

  const stats: UsageStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    requestCount: filteredRecords.length,
    records: filteredRecords,
  };

  for (const record of filteredRecords) {
    stats.totalInputTokens += record.inputTokens;
    stats.totalOutputTokens += record.outputTokens;
    stats.totalTokens += record.totalTokens;
    stats.totalCost += record.cost ?? 0;
  }

  return stats;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Format cost for display in USD
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return '$0.00';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get friendly label for time range
 */
export function getTimeRangeLabel(range: UsageTimeRange): string {
  switch (range) {
    case 'day':
      return 'Last 24 Hours';
    case 'week':
      return 'Last 7 Days';
    case 'month':
      return 'Last 30 Days';
    case 'quarter':
      return 'Last 90 Days';
    case 'year':
      return 'Last Year';
    default:
      return 'Last 7 Days';
  }
}

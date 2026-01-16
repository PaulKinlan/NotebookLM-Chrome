/**
 * UsageStatsModal Component
 *
 * Displays usage statistics for an AI profile including:
 * - Total tokens, input/output tokens, estimated cost, and request count
 * - A bar chart showing usage over time
 * - Time range selector (day, week, month, quarter, year)
 */

import { useState, useEffect, useRef } from 'preact/hooks'
import type { UsageTimeRange, UsageStats, UsageDataPoint } from '../../types/index.ts'
import {
  getUsageStats,
  getUsageDataPoints,
  formatTokenCount,
  formatCost,
  getTimeRangeLabel,
} from '../../lib/usage.ts'

interface UsageStatsModalProps {
  isOpen: boolean
  profileId: string
  profileName: string
  onClose: () => void
}

const TIME_RANGES: UsageTimeRange[] = ['day', 'week', 'month', 'quarter', 'year']

export function UsageStatsModal(props: UsageStatsModalProps) {
  const { isOpen, profileId, profileName, onClose } = props
  const [timeRange, setTimeRange] = useState<UsageTimeRange>('week')
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [dataPoints, setDataPoints] = useState<UsageDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load usage stats when modal opens or time range changes
  useEffect(() => {
    if (!isOpen || !profileId) return

    const loadStats = async () => {
      setIsLoading(true)
      try {
        const [usageStats, usageDataPoints] = await Promise.all([
          getUsageStats(profileId, timeRange),
          getUsageDataPoints(profileId, timeRange),
        ])
        setStats(usageStats)
        setDataPoints(usageDataPoints)
      }
      catch (error) {
        console.error('Failed to load usage stats:', error)
      }
      finally {
        setIsLoading(false)
      }
    }

    void loadStats()
  }, [isOpen, profileId, timeRange])

  // Render chart when data points change
  useEffect(() => {
    if (!canvasRef.current || dataPoints.length === 0) return
    renderChart(canvasRef.current, dataPoints)
  }, [dataPoints])

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="usage-stats-modal" style={{ display: 'flex' }} onClick={onClose}>
      <div className="usage-stats-content" onClick={e => e.stopPropagation()}>
        <div className="usage-stats-header">
          <h3 className="usage-stats-title">{`Usage Stats: ${profileName}`}</h3>
          <button className="usage-stats-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="usage-stats-time-range">
          {TIME_RANGES.map(range => (
            <button
              key={range}
              className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {isLoading
          ? (
              <div className="usage-stats-loading" style={{ textAlign: 'center', padding: '40px' }}>
                <span className="loading-spinner"></span>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Loading usage data...</p>
              </div>
            )
          : (
              <>
                <div className="usage-stats-summary">
                  <div className="usage-stat-card">
                    <span className="usage-stat-label">Total Tokens</span>
                    <span className="usage-stat-value">{formatTokenCount(stats?.totalTokens ?? 0)}</span>
                  </div>
                  <div className="usage-stat-card">
                    <span className="usage-stat-label">Input Tokens</span>
                    <span className="usage-stat-value">{formatTokenCount(stats?.totalInputTokens ?? 0)}</span>
                  </div>
                  <div className="usage-stat-card">
                    <span className="usage-stat-label">Output Tokens</span>
                    <span className="usage-stat-value">{formatTokenCount(stats?.totalOutputTokens ?? 0)}</span>
                  </div>
                  <div className="usage-stat-card">
                    <span className="usage-stat-label">Estimated Cost</span>
                    <span className="usage-stat-value">{formatCost(stats?.totalCost ?? 0)}</span>
                  </div>
                  <div className="usage-stat-card">
                    <span className="usage-stat-label">API Requests</span>
                    <span className="usage-stat-value">{stats?.requestCount ?? 0}</span>
                  </div>
                </div>

                <div className="usage-chart-container">
                  <canvas ref={canvasRef} id="usage-chart" width="500" height="200"></canvas>
                </div>

                <div className="usage-stats-footer">
                  <span className="usage-stats-period">{getTimeRangeLabel(timeRange)}</span>
                </div>
              </>
            )}
      </div>
    </div>
  )
}

/**
 * Render usage chart using Canvas API
 */
function renderChart(canvas: HTMLCanvasElement, dataPoints: UsageDataPoint[]): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Handle high DPI displays
  const dpr = globalThis.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, rect.height)

  // Get computed styles for theming
  const computedStyle = globalThis.getComputedStyle(document.documentElement)
  const textColor = computedStyle.getPropertyValue('--text-secondary').trim() || '#888'
  const gridColor = computedStyle.getPropertyValue('--border-color').trim() || '#333'
  const accentColor = computedStyle.getPropertyValue('--accent-primary').trim() || '#3b82f6'

  if (dataPoints.length === 0) {
    ctx.fillStyle = textColor
    ctx.font = '14px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No usage data available', rect.width / 2, rect.height / 2)
    return
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = rect.width - padding.left - padding.right
  const chartHeight = rect.height - padding.top - padding.bottom

  // Find max values for scaling
  const maxTokens = Math.max(...dataPoints.map(d => d.totalTokens), 1)

  // Draw grid lines
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 0.5
  const gridLines = 4
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(rect.width - padding.right, y)
    ctx.stroke()

    // Y-axis labels
    const value = maxTokens - (maxTokens / gridLines) * i
    ctx.fillStyle = textColor
    ctx.font = '10px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(formatTokenCount(value), padding.left - 8, y + 3)
  }

  // Draw bars
  const barWidth = Math.max(4, (chartWidth / dataPoints.length) * 0.7)
  const barGap = (chartWidth - barWidth * dataPoints.length) / (dataPoints.length + 1)

  dataPoints.forEach((point, i) => {
    const x = padding.left + barGap + i * (barWidth + barGap)
    const barHeight = (point.totalTokens / maxTokens) * chartHeight
    const y = padding.top + chartHeight - barHeight

    // Draw bar
    ctx.fillStyle = accentColor
    ctx.fillRect(x, y, barWidth, barHeight)

    // X-axis labels (show fewer labels if too crowded)
    if (dataPoints.length <= 14 || i % Math.ceil(dataPoints.length / 14) === 0) {
      const dateLabel = formatDateLabel(point.date)
      ctx.fillStyle = textColor
      ctx.font = '9px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.save()
      ctx.translate(x + barWidth / 2, rect.height - 8)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(dateLabel, 0, 0)
      ctx.restore()
    }
  })
}

/**
 * Format date for chart labels
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

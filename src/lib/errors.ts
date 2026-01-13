/**
 * Error Handling Utilities
 *
 * Provides better error categorization, user-friendly messages,
 * and retry logic for AI operations.
 */

export type ErrorCategory
  = | 'auth' // API key issues
    | 'network' // Connection problems
    | 'rate_limit' // Rate limiting
    | 'model' // Model not available
    | 'content' // Content too long, etc.
    | 'config' // Configuration issues
    | 'unknown' // Unclassified errors

export interface ClassifiedError {
  category: ErrorCategory
  userMessage: string
  technicalMessage: string
  recoverable: boolean
  suggestedAction?: string
}

/**
 * Common error patterns for classification
 */
const ERROR_PATTERNS: Array<{
  patterns: RegExp[]
  category: ErrorCategory
  userMessage: string
  recoverable: boolean
  suggestedAction?: string
}> = [
  {
    patterns: [
      /api.?key/i,
      /authentication/i,
      /unauthorized/i,
      /401/,
      /invalid.*key/i,
      /invalid.*token/i,
    ],
    category: 'auth',
    userMessage: 'API key is invalid or missing',
    recoverable: false,
    suggestedAction: 'Check your API key in Settings',
  },
  {
    patterns: [
      /rate.?limit/i,
      /too.?many.?requests/i,
      /429/,
      /quota/i,
      /exceeded/i,
    ],
    category: 'rate_limit',
    userMessage: 'Too many requests. Please wait a moment.',
    recoverable: true,
    suggestedAction: 'Wait a few seconds and try again',
  },
  {
    patterns: [
      /network/i,
      /connection/i,
      /offline/i,
      /enotfound/i,
      /etimedout/i,
      /fetch.*failed/i,
      /network.*error/i,
    ],
    category: 'network',
    userMessage: 'Connection error. Check your internet.',
    recoverable: true,
    suggestedAction: 'Check your internet connection and try again',
  },
  {
    patterns: [
      /model.*not.*found/i,
      /model.*not.*available/i,
      /invalid.*model/i,
      /unknown.*model/i,
    ],
    category: 'model',
    userMessage: 'The selected AI model is not available',
    recoverable: false,
    suggestedAction: 'Try a different model in Settings',
  },
  {
    patterns: [
      /context.*length/i,
      /too.*long/i,
      /maximum.*token/i,
      /content.*large/i,
      /payload.*large/i,
    ],
    category: 'content',
    userMessage: 'Content is too long for the AI model',
    recoverable: false,
    suggestedAction: 'Try removing some sources or using shorter content',
  },
  {
    patterns: [
      /no.*model.*configured/i,
      /no.*ai.*configured/i,
      /please.*configure/i,
      /not.*configured/i,
    ],
    category: 'config',
    userMessage: 'AI is not configured',
    recoverable: false,
    suggestedAction: 'Add an AI profile in Settings',
  },
]

/**
 * Classify an error and provide user-friendly information
 */
export function classifyError(error: unknown): ClassifiedError {
  const technicalMessage = error instanceof Error ? error.message : String(error)

  // Check against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.patterns.some(p => p.test(technicalMessage))) {
      return {
        category: pattern.category,
        userMessage: pattern.userMessage,
        technicalMessage,
        recoverable: pattern.recoverable,
        suggestedAction: pattern.suggestedAction,
      }
    }
  }

  // Check HTTP status codes in the message
  const statusMatch = technicalMessage.match(/\b(4\d{2}|5\d{2})\b/)
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10)
    if (status === 401 || status === 403) {
      return {
        category: 'auth',
        userMessage: 'Authentication failed',
        technicalMessage,
        recoverable: false,
        suggestedAction: 'Check your API key in Settings',
      }
    }
    if (status === 429) {
      return {
        category: 'rate_limit',
        userMessage: 'Rate limited. Please wait.',
        technicalMessage,
        recoverable: true,
        suggestedAction: 'Wait a moment and try again',
      }
    }
    if (status >= 500) {
      return {
        category: 'network',
        userMessage: 'Server error. Try again later.',
        technicalMessage,
        recoverable: true,
        suggestedAction: 'Wait a moment and try again',
      }
    }
  }

  // Default to unknown
  return {
    category: 'unknown',
    userMessage: 'An unexpected error occurred',
    technicalMessage,
    recoverable: true,
    suggestedAction: 'Please try again',
  }
}

/**
 * Format an error for display to the user
 */
export function formatErrorForUser(error: unknown): string {
  const classified = classifyError(error)
  let message = classified.userMessage

  if (classified.suggestedAction) {
    message += `. ${classified.suggestedAction}.`
  }

  return message
}

/**
 * Options for retry logic
 */
export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> & { onRetry?: RetryOptions['onRetry'] } = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    const classified = classifyError(error)
    return classified.recoverable
  },
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with automatic retry for recoverable errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown
  let delay = opts.initialDelayMs

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt < opts.maxAttempts && opts.shouldRetry(error, attempt)) {
        // Notify about retry
        if (opts.onRetry) {
          opts.onRetry(error, attempt, delay)
        }

        // Wait before retrying
        await sleep(delay)

        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs)
      }
      else {
        // No more retries
        break
      }
    }
  }

  // All retries exhausted
  throw lastError
}

/**
 * Check if an error is recoverable (worth retrying)
 */
export function isRecoverableError(error: unknown): boolean {
  return classifyError(error).recoverable
}

/**
 * Get a suggested action for an error
 */
export function getErrorSuggestion(error: unknown): string | undefined {
  return classifyError(error).suggestedAction
}

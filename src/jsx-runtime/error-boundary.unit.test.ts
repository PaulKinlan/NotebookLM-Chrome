/**
 * Tests for Error Boundary functionality
 */

import { describe, it, expect } from 'vitest'

describe('Error Boundary', () => {
  it('should provide captureError helper function', async () => {
    const { captureError } = await import('./component.ts')

    expect(captureError).toBeDefined()
    expect(typeof captureError).toBe('function')
  })

  it('should provide findNearestErrorBoundary helper function', async () => {
    const { findNearestErrorBoundary } = await import('./component.ts')

    expect(findNearestErrorBoundary).toBeDefined()
    expect(typeof findNearestErrorBoundary).toBe('function')
  })

  it('should provide resetErrorState helper function', async () => {
    const { resetErrorState } = await import('./component.ts')

    expect(resetErrorState).toBeDefined()
    expect(typeof resetErrorState).toBe('function')
  })
})

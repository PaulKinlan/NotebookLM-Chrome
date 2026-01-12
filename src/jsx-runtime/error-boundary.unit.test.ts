/**
 * Tests for Error Boundary functionality
 */

import { describe, it, expect } from 'vitest'
import { captureError, findNearestErrorBoundary, resetErrorState } from './component.ts'

describe('Error Boundary', () => {
  it('should provide captureError helper function', () => {
    expect(captureError).toBeDefined()
    expect(typeof captureError).toBe('function')
  })

  it('should provide findNearestErrorBoundary helper function', () => {
    expect(findNearestErrorBoundary).toBeDefined()
    expect(typeof findNearestErrorBoundary).toBe('function')
  })

  it('should provide resetErrorState helper function', () => {
    expect(resetErrorState).toBeDefined()
    expect(typeof resetErrorState).toBe('function')
  })
})

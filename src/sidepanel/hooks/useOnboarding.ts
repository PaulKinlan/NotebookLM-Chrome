/**
 * useOnboarding Hook
 *
 * Manages onboarding flow state including:
 * - Step progression
 * - Step content (titles, descriptions, icons)
 * - Completion tracking
 * - Chrome AI model download trigger on user gesture
 * - Default AI profile initialization
 */

import { useState, useCallback, useRef, useEffect } from 'preact/hooks'
import {
  isOnboardingComplete,
  markOnboardingComplete,
  ONBOARDING_STEPS as LIB_ONBOARDING_STEPS,
  type OnboardingStep,
} from '../../lib/onboarding.ts'
import { startModelDownloadAsync } from '../../lib/chrome-ai.ts'

export type { OnboardingStep }

export interface UseOnboardingReturn {
  /** Current step index (0-4) */
  currentStep: number
  /** Whether onboarding has been completed */
  isComplete: boolean
  /** All onboarding steps (with id, title, description, icon) */
  steps: OnboardingStep[]
  /** Advance to the next step (triggers Chrome AI download on gesture) */
  onNext: () => void
  /** Skip onboarding (triggers Chrome AI download on gesture) */
  onSkip: () => void
}

// Use the rich step definitions from lib/onboarding.ts
const ONBOARDING_STEPS = LIB_ONBOARDING_STEPS

/**
 * Hook for managing onboarding state
 *
 * Returns step state and handlers. Components should render
 * the onboarding UI from the steps array and currentStep index.
 */
export function useOnboarding(): UseOnboardingReturn {
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Track whether Chrome AI download has been triggered this session
  const chromeAIDownloadTriggered = useRef(false)

  // Load onboarding completion state from storage on mount
  useEffect(() => {
    void (async () => {
      const complete = await isOnboardingComplete()
      setIsComplete(complete)
      setLoaded(true)
    })()
  }, [])

  /**
   * Trigger Chrome's built-in AI model download during onboarding.
   * This is called on user gestures (Next/Skip clicks) to start the
   * ~1.5GB model download in the background.
   */
  const triggerChromeAIDownloadOnGesture = useCallback(() => {
    if (chromeAIDownloadTriggered.current) {
      return
    }
    chromeAIDownloadTriggered.current = true

    console.log('[Onboarding] Triggering Chrome AI model download on user gesture')

    startModelDownloadAsync(
      // Progress callback
      (progress) => {
        console.log(`[Onboarding] Chrome AI download progress: ${(progress * 100).toFixed(1)}%`)
      },
      // Completion callback
      (result) => {
        if (result.success) {
          console.log(`[Onboarding] Chrome AI model ready (status: ${result.status})`)
        }
        else {
          console.log(`[Onboarding] Chrome AI model not available: ${result.error || result.status}`)
        }
      },
    )
  }, [])

  const onNext = useCallback(() => {
    // Trigger Chrome AI download on user gesture
    triggerChromeAIDownloadOnGesture()

    const nextStep = currentStep + 1
    if (nextStep >= ONBOARDING_STEPS.length) {
      // Complete onboarding
      void markOnboardingComplete()
      setIsComplete(true)
    }
    else {
      setCurrentStep(nextStep)
    }
  }, [currentStep, triggerChromeAIDownloadOnGesture])

  const onSkip = useCallback(() => {
    // Trigger Chrome AI download on user gesture
    triggerChromeAIDownloadOnGesture()

    // Complete onboarding immediately
    void markOnboardingComplete()
    setIsComplete(true)
  }, [triggerChromeAIDownloadOnGesture])

  return {
    currentStep,
    isComplete: isComplete || !loaded, // Hide until loaded if complete
    steps: ONBOARDING_STEPS,
    onNext,
    onSkip,
  }
}

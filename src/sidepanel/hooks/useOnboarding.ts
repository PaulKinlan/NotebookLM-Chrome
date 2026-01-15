/**
 * useOnboarding Hook
 *
 * Manages onboarding flow state including:
 * - Step progression
 * - Step content (titles, descriptions)
 * - Completion tracking
 * - Chrome AI model download trigger on user gesture
 */

import { useState, useCallback, useRef, useEffect } from 'preact/hooks'
import { isOnboardingComplete, markOnboardingComplete } from '../../lib/onboarding.ts'
import { startModelDownloadAsync } from '../../lib/chrome-ai.ts'

export interface OnboardingStep {
  title: string
  description: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to FolioLM',
    description: 'Collect web content from tabs, bookmarks, and history. Query and transform your sources using AI.',
  },
  {
    title: 'Add Your First Source',
    description: 'Click "Add Current Tab" to capture the active page. You can also import from tabs, bookmarks, or history.',
  },
  {
    title: 'Ask Questions',
    description: 'Type a question in the chat box to query your sources. Get intelligent answers powered by AI.',
  },
  {
    title: 'Transform Content',
    description: 'Create podcasts, quizzes, summaries, and more from your sources using AI transformations.',
  },
  {
    title: 'Ready to Explore!',
    description: 'You\'re all set! Start collecting sources and exploring what AI can do with your content.',
  },
]

export interface UseOnboardingReturn {
  /** Current step index (0-4) */
  currentStep: number
  /** Whether onboarding has been completed */
  isComplete: boolean
  /** All onboarding steps */
  steps: OnboardingStep[]
  /** Advance to the next step (triggers Chrome AI download on gesture) */
  onNext: () => void
  /** Skip onboarding (triggers Chrome AI download on gesture) */
  onSkip: () => void
}

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

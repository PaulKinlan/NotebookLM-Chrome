import { useOnboarding } from '../hooks/useOnboarding'

interface OnboardingProps {
  hidden: boolean
}

/**
 * Onboarding component
 *
 * Displays the onboarding flow with step content, navigation dots,
 * icons, and next/skip buttons. Uses the useOnboarding hook to manage state.
 *
 * The onboarding includes 5 steps:
 * 1. Welcome - Introduction to FolioLM
 * 2. Collect Sources - How to add content
 * 3. Ask Questions - Using the chat feature
 * 4. Transform Content - Creating podcasts, quizzes, etc.
 * 5. Set Up AI - Configure AI provider (Chrome Built-in default)
 */
export function Onboarding(props: OnboardingProps) {
  const { hidden } = props
  const { currentStep, isComplete, steps, onNext, onSkip } = useOnboarding()

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  // Hide if complete or manually hidden
  const shouldHide = hidden || isComplete

  return (
    <div id="onboarding-overlay" className={`onboarding-overlay ${shouldHide ? 'hidden' : ''}`}>
      <div className="onboarding-content">
        <div className="onboarding-step" id="onboarding-step">
          {/* Render the SVG icon for the current step */}
          <div
            className="onboarding-icon"
            id="onboarding-icon"
            dangerouslySetInnerHTML={{ __html: step.icon }}
          />
          <h2 id="onboarding-title">{step.title}</h2>
          <p id="onboarding-description">{step.description}</p>
        </div>
        <div className="onboarding-progress">
          <div className="onboarding-dots" id="onboarding-dots">
            {steps.map((s, index) => (
              <div
                key={s.id}
                className={`onboarding-dot${index === currentStep ? ' active' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="onboarding-actions">
          <button id="onboarding-skip" className="btn btn-outline" onClick={onSkip}>
            Skip
          </button>
          <button id="onboarding-next" className="btn btn-primary" onClick={onNext}>
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

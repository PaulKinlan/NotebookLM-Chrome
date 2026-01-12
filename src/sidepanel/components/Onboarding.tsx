interface OnboardingProps {
  hidden: boolean
  onSkip?: () => void
  onNext?: () => void
}

export function Onboarding(props: OnboardingProps) {
  const { hidden } = props
  return (
    <div id="onboarding-overlay" className={`onboarding-overlay ${hidden ? 'hidden' : ''}`}>
      <div className="onboarding-content">
        <div className="onboarding-step" id="onboarding-step">
          <div className="onboarding-icon" id="onboarding-icon"></div>
          <h2 id="onboarding-title">Welcome</h2>
          <p id="onboarding-description">Description</p>
        </div>
        <div className="onboarding-progress">
          <div className="onboarding-dots" id="onboarding-dots"></div>
        </div>
        <div className="onboarding-actions">
          <button id="onboarding-skip" className="btn btn-outline">Skip</button>
          <button id="onboarding-next" className="btn btn-primary">Next</button>
        </div>
      </div>
    </div>
  )
}

import styles from './Onboarding.module.css'

interface OnboardingProps {
  hidden: boolean
  onSkip?: () => void
  onNext?: () => void
}

export function Onboarding(props: OnboardingProps) {
  const { hidden } = props
  return (
    <div id="onboarding-overlay" className={`${styles.overlay} ${hidden ? styles.hidden : ''}`}>
      <div className={styles.content}>
        <div className={styles.step} id="onboarding-step">
          <div className={styles.icon} id="onboarding-icon"></div>
          <h2 id="onboarding-title" className={styles.title}>Welcome</h2>
          <p id="onboarding-description" className={styles.description}>Description</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.dots} id="onboarding-dots"></div>
        </div>
        <div className={styles.actions}>
          <button id="onboarding-skip" className="btn btn-outline">Skip</button>
          <button id="onboarding-next" className="btn btn-primary">Next</button>
        </div>
      </div>
    </div>
  )
}

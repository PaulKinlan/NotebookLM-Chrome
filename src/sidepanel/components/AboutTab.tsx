import { navigateToTab } from '../store'

interface AboutTabProps {
  active: boolean
}

export function AboutTab(props: AboutTabProps) {
  const { active } = props

  return (
    <section id="tab-about" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>About</h2>

      <div className="settings-group">
        <h3 className="section-title">FolioLM</h3>
        <p className="setting-hint">
          Your AI research companion. Collect sources from tabs, bookmarks, and history, then query and transform that content.
        </p>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Contact</h3>
        <p className="about-contact-item">
          <svg className="about-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <a href="mailto:paul@aifoc.us">paul@aifoc.us</a>
        </p>
      </div>

      <div className="settings-group">
        <h3 className="section-title">Support</h3>
        <p className="about-contact-item">
          <svg className="about-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          <a href="https://github.com/PaulKinlan/NotebookLM-Chrome/issues" target="_blank" rel="noopener noreferrer">
            Report issues on GitHub
          </a>
        </p>
        <p className="setting-hint">
          Found a bug or have a feature request? Open an issue on our GitHub repository.
        </p>
      </div>

      <div className="settings-group">
        <button
          className="btn btn-small btn-outline"
          onClick={() => navigateToTab('settings')}
        >
          Back to Settings
        </button>
      </div>
    </section>
  )
}

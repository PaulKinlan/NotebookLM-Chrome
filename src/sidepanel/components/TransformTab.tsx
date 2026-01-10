import { Fragment } from 'jsx-runtime/jsx-runtime';

interface TransformTabProps {
  active: boolean;
  onTransform: (type: string) => void;
}

const transformTypes = [
  { id: 'podcast', title: 'Podcast Script', desc: 'Generate a 2-person conversation' },
  { id: 'quiz', title: 'Study Quiz', desc: 'Test your knowledge' },
  { id: 'takeaways', title: 'Key Takeaways', desc: 'Extract main points' },
  { id: 'email', title: 'Email Summary', desc: 'Professional summary to share' },
  { id: 'slidedeck', title: 'Slide Deck', desc: 'Presentation outline' },
  { id: 'report', title: 'Report', desc: 'Formal document' },
  { id: 'datatable', title: 'Data Table', desc: 'Organize facts into tables' },
  { id: 'mindmap', title: 'Mind Map', desc: 'Concept hierarchy' },
  { id: 'flashcards', title: 'Flashcards', desc: 'Q&A study cards' },
  { id: 'timeline', title: 'Timeline', desc: 'Chronological events' },
  { id: 'glossary', title: 'Glossary', desc: 'Key terms & definitions' },
  { id: 'comparison', title: 'Comparison', desc: 'Side-by-side analysis' },
  { id: 'faq', title: 'FAQ', desc: 'Common questions' },
  { id: 'actionitems', title: 'Action Items', desc: 'Tasks & to-dos' },
  { id: 'executivebrief', title: 'Executive Brief', desc: 'One-page summary' },
  { id: 'studyguide', title: 'Study Guide', desc: 'Comprehensive review' },
  { id: 'proscons', title: 'Pros & Cons', desc: 'Balanced analysis' },
  { id: 'citations', title: 'Citation List', desc: 'Formatted references' },
  { id: 'outline', title: 'Outline', desc: 'Document structure' },
];

export function TransformTab(props: TransformTabProps) {
  const { active, onTransform } = props;

  return (
    <section id="tab-transform" className={`tab-content ${active ? 'active' : ''}`}>
      <h2>Transform</h2>
      <p className="helper-text">Transform your sources into different formats.</p>

      <div className="transform-grid">
        {transformTypes.map((transform) => (
          <button
            key={transform.id}
            className="transform-card"
            id={`transform-${transform.id}`}
            onClick={() => onTransform(transform.id)}
          >
            <div className={`transform-icon ${transform.id}-icon`}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <TransformIcon id={transform.id} />
              </svg>
            </div>
            <div className="transform-info">
              <span className="transform-title">{transform.title}</span>
              <span className="transform-desc">{transform.desc}</span>
            </div>
          </button>
        ))}
      </div>

      <div id="transform-history" className="transform-history"></div>
    </section>
  );
}

function TransformIcon({ id }: { id: string }) {
  const icons: Record<string, any> = {
    podcast: (
      <Fragment>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </Fragment>
    ),
    quiz: (
      <Fragment>
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </Fragment>
    ),
    takeaways: (
      <Fragment>
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </Fragment>
    ),
    email: (
      <Fragment>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </Fragment>
    ),
    slidedeck: (
      <Fragment>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </Fragment>
    ),
    report: (
      <Fragment>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </Fragment>
    ),
    datatable: (
      <Fragment>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </Fragment>
    ),
    mindmap: (
      <Fragment>
        <circle cx="12" cy="12" r="3"></circle>
        <circle cx="4" cy="6" r="2"></circle>
        <circle cx="20" cy="6" r="2"></circle>
        <circle cx="4" cy="18" r="2"></circle>
        <circle cx="20" cy="18" r="2"></circle>
        <line x1="9.5" y1="10" x2="5.5" y2="7.5"></line>
        <line x1="14.5" y1="10" x2="18.5" y2="7.5"></line>
        <line x1="9.5" y1="14" x2="5.5" y2="16.5"></line>
        <line x1="14.5" y1="14" x2="18.5" y2="16.5"></line>
      </Fragment>
    ),
    flashcards: (
      <Fragment>
        <rect x="2" y="4" width="16" height="12" rx="2"></rect>
        <rect x="6" y="8" width="16" height="12" rx="2"></rect>
      </Fragment>
    ),
    timeline: (
      <Fragment>
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <circle cx="12" cy="6" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="18" r="2"></circle>
        <line x1="14" y1="6" x2="20" y2="6"></line>
        <line x1="4" y1="12" x2="10" y2="12"></line>
        <line x1="14" y1="18" x2="20" y2="18"></line>
      </Fragment>
    ),
    glossary: (
      <Fragment>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        <line x1="8" y1="6" x2="16" y2="6"></line>
        <line x1="8" y1="10" x2="14" y2="10"></line>
        <line x1="8" y1="14" x2="12" y2="14"></line>
      </Fragment>
    ),
    comparison: (
      <Fragment>
        <rect x="3" y="3" width="8" height="18" rx="1"></rect>
        <rect x="13" y="3" width="8" height="18" rx="1"></rect>
        <line x1="7" y1="8" x2="7" y2="8.01"></line>
        <line x1="7" y1="12" x2="7" y2="12.01"></line>
        <line x1="7" y1="16" x2="7" y2="16.01"></line>
        <line x1="17" y1="8" x2="17" y2="8.01"></line>
        <line x1="17" y1="12" x2="17" y2="12.01"></line>
        <line x1="17" y1="16" x2="17" y2="16.01"></line>
      </Fragment>
    ),
    faq: (
      <Fragment>
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </Fragment>
    ),
    actionitems: (
      <Fragment>
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </Fragment>
    ),
    executivebrief: (
      <Fragment>
        <rect x="2" y="3" width="20" height="18" rx="2"></rect>
        <line x1="6" y1="8" x2="18" y2="8"></line>
        <line x1="6" y1="12" x2="18" y2="12"></line>
        <line x1="6" y1="16" x2="12" y2="16"></line>
      </Fragment>
    ),
    studyguide: (
      <Fragment>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </Fragment>
    ),
    proscons: (
      <Fragment>
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <line x1="5" y1="6" x2="9" y2="6"></line>
        <line x1="5" y1="10" x2="9" y2="10"></line>
        <line x1="5" y1="14" x2="9" y2="14"></line>
        <line x1="15" y1="6" x2="19" y2="6"></line>
        <line x1="15" y1="10" x2="19" y2="10"></line>
        <line x1="15" y1="14" x2="19" y2="14"></line>
      </Fragment>
    ),
    citations: (
      <Fragment>
        <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
        <path d="M6 9v12"></path>
        <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
        <path d="M18 9v12"></path>
      </Fragment>
    ),
    outline: (
      <Fragment>
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </Fragment>
    ),
  };

  return icons[id] || null;
}

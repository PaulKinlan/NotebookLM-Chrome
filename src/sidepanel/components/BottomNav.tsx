/**
 * BottomNav component - Bottom navigation bar with Add, Chat, and Transform tabs
 */

type TabName = 'add' | 'chat' | 'transform' | 'library' | 'settings'

interface BottomNavProps {
  activeTab: TabName
  onTabClick: (tab: TabName) => void
}

export function BottomNav(props: BottomNavProps) {
  const { activeTab, onTabClick } = props

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activeTab === 'add' ? 'active' : ''}`}
        data-tab="add"
        onClick={() => onTabClick('add')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <span>Add</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
        data-tab="chat"
        onClick={() => onTabClick('chat')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Chat</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'transform' ? 'active' : ''}`}
        data-tab="transform"
        onClick={() => onTabClick('transform')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        <span>Transform</span>
      </button>
    </nav>
  )
}

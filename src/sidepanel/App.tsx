// ============================================================================
// App Root Component
// ============================================================================

// Import all components
import { Header } from './components/Header'
import { AddTab } from './components/AddTab'
import { ChatTab } from './components/ChatTab'
import { TransformTab } from './components/TransformTab'
import { LibraryTab } from './components/LibraryTab'
import { SettingsTab } from './components/SettingsTab'
import { BottomNav } from './components/BottomNav'
import { Fab } from './components/Fab'
import { PickerModal, NotebookDialog, ConfirmDialog } from './components/Modals'
import { Notification } from './components/Notification'
import { Onboarding } from './components/Onboarding'

// ============================================================================
// Types
// ============================================================================

type TabName = 'add' | 'chat' | 'transform' | 'library' | 'settings'
type PermissionType = 'tabs' | 'tabGroups' | 'bookmarks' | 'history'

type BusinessHandlers = typeof import('./index')['handlers']

interface AppProps {
  activeTab: TabName
  fabHidden: boolean
  onboardingHidden: boolean
  businessHandlers: BusinessHandlers | null
}

interface AppHandlers {
  handleTabClick: (tab: TabName) => void
  handleHeaderLibraryClick: () => void
  handleHeaderSettingsClick: () => void
  handleFabClick: () => void
  handleTransform: (type: string) => void
}

// ============================================================================
// Handlers (will be connected to business logic later)
// ============================================================================

function createHandlers(state: { activeTab: TabName }, businessHandlers: BusinessHandlers | null): AppHandlers {
  function updateTabVisibility(): void {
    const navItems = document.querySelectorAll('.nav-item')
    const tabContents = document.querySelectorAll('.tab-content')

    navItems.forEach((item) => {
      const tabName = item.getAttribute('data-tab')
      if (tabName === state.activeTab) {
        item.classList.add('active')
      }
      else {
        item.classList.remove('active')
      }
    })

    tabContents.forEach((content) => {
      const tabId = content.id
      if (tabId === `tab-${state.activeTab}`) {
        content.classList.add('active')
      }
      else {
        content.classList.remove('active')
      }
    })
  }

  return {
    handleTabClick: (tab: TabName) => {
      state.activeTab = tab
      updateTabVisibility()
      businessHandlers?.switchTab(tab)
    },

    handleHeaderLibraryClick: () => {
      state.activeTab = 'library'
      updateTabVisibility()
    },

    handleHeaderSettingsClick: () => {
      state.activeTab = 'settings'
      updateTabVisibility()
    },

    handleFabClick: () => {
      state.activeTab = 'add'
      updateTabVisibility()
    },

    handleTransform: (type: string) => {
      void businessHandlers?.handleTransform(type as unknown as 'podcast' | 'quiz' | 'takeaways' | 'email' | 'slidedeck' | 'report' | 'datatable' | 'mindmap' | 'flashcards' | 'timeline' | 'glossary' | 'comparison' | 'faq' | 'actionitems' | 'executivebrief' | 'studyguide' | 'proscons' | 'citations' | 'outline')
    },
  }
}

// ============================================================================
// App Component
// ============================================================================

export function App(props: AppProps = {
  activeTab: 'add',
  fabHidden: true,
  onboardingHidden: true,
  businessHandlers: null,
}): Node {
  const { activeTab, fabHidden, onboardingHidden, businessHandlers } = props

  const state = { activeTab }
  const handlers = createHandlers(state, businessHandlers)

  // Initialize tab visibility
  requestAnimationFrame(() => {
    const navItems = document.querySelectorAll('.nav-item')
    const tabContents = document.querySelectorAll('.tab-content')

    navItems.forEach((item) => {
      const tabName = item.getAttribute('data-tab')
      if (tabName === activeTab) {
        item.classList.add('active')
      }
      else {
        item.classList.remove('active')
      }
    })

    tabContents.forEach((content) => {
      const tabId = content.id
      if (tabId === `tab-${activeTab}`) {
        content.classList.add('active')
      }
      else {
        content.classList.remove('active')
      }
    })
  })

  return (
    <>
      <Header
        onLibraryClick={handlers.handleHeaderLibraryClick}
        onSettingsClick={handlers.handleHeaderSettingsClick}
        onNotebookChange={() => { void businessHandlers?.handleNotebookChange() }}
        onNewNotebook={() => { void businessHandlers?.handleNewNotebook() }}
      />

      <main className="content">
        <AddTab
          active={activeTab === 'add'}
          onAddCurrentTab={() => { void businessHandlers?.handleAddCurrentTab() }}
          onImportTabs={() => { void businessHandlers?.handleImportTabs() }}
          onImportTabGroups={() => { void businessHandlers?.handleImportTabGroups() }}
          onImportBookmarks={() => { void businessHandlers?.handleImportBookmarks() }}
          onImportHistory={() => { void businessHandlers?.handleImportHistory() }}
        />

        <ChatTab
          active={activeTab === 'chat'}
          onQuery={() => { void businessHandlers?.handleQuery() }}
          onClearChat={() => { void businessHandlers?.handleClearChat() }}
          onRegenerateSummary={() => { void businessHandlers?.handleRegenerateSummary() }}
          onAddCurrentTab={() => { void businessHandlers?.handleAddCurrentTab() }}
        />

        <TransformTab active={activeTab === 'transform'} onTransform={handlers.handleTransform} />

        <LibraryTab active={activeTab === 'library'} />

        <SettingsTab
          active={activeTab === 'settings'}
          onPermissionToggle={(permission: PermissionType) => { void businessHandlers?.handlePermissionToggle(permission) }}
          onClearAllData={() => { void businessHandlers?.handleClearAllData() }}
        />
      </main>

      <BottomNav activeTab={activeTab} onTabClick={handlers.handleTabClick} />

      <Fab hidden={fabHidden} onClick={handlers.handleFabClick} />

      <PickerModal />
      <NotebookDialog />
      <ConfirmDialog />
      <Notification />
      <Onboarding hidden={onboardingHidden} />
    </>
  )
}

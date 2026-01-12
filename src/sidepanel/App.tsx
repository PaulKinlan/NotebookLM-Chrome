// ============================================================================
// App Root Component
// ============================================================================

// Import all components
import { useState, useEffect } from '../jsx-runtime/hooks/index.ts'
import { HeaderStateful } from './components/Header'
import { AddTabStateful } from './components/AddTabStateful'
import { ChatTabStateful } from './components/ChatTabStateful'
import { TransformTabStateful } from './components/TransformTabStateful'
import { LibraryTabStateful } from './components/LibraryTabStateful'
import { SettingsTabStateful } from './components/SettingsTabStateful'
import { BottomNav } from './components/BottomNav'
import { Fab } from './components/Fab'
import { PickerModal, NotebookDialog, ConfirmDialog } from './components/Modals'
import { NotificationStateful } from './components/NotificationStateful'
import { Onboarding } from './components/Onboarding'
import { useDialog } from './hooks/useDialog.ts'

// ============================================================================
// Types
// ============================================================================

type TabName = 'add' | 'chat' | 'transform' | 'library' | 'settings'

interface AppProps {
  activeTab: TabName
  fabHidden: boolean
  onboardingHidden: boolean
}

// ============================================================================
// App Component
// ============================================================================

export function App(props: AppProps = {
  activeTab: 'add',
  fabHidden: true,
  onboardingHidden: true,
}): Node {
  const { activeTab: initialTab, fabHidden, onboardingHidden } = props

  // Use useState for tab management instead of imperative DOM manipulation
  const [activeTab, setActiveTab] = useState<TabName>(initialTab)

  // Use useDialog hook for dialog state management
  const {
    confirmDialog,
    notebookDialog,
    showConfirm,
    showNotebook,
    _handleConfirm,
    _handleConfirmCancel,
    _handleNotebookConfirm,
    _handleNotebookCancel,
    _setNotebookInput,
  } = useDialog()

  // Expose dialog functions globally for backward compatibility with controllers.ts
  useEffect(() => {
    ;(window as { showConfirm?: typeof showConfirm }).showConfirm = showConfirm
    ;(window as { showNotebookDialog?: typeof showNotebook }).showNotebookDialog = showNotebook
  }, [showConfirm, showNotebook])

  // Apply active class to nav items and tab contents via CSS-based rendering
  // The stateful components handle their own visibility based on the `active` prop
  useEffect(() => {
    // Update data-tab attributes for navigation highlighting
    const navItems = document.querySelectorAll('.nav-item')
    navItems.forEach((item) => {
      const tabName = item.getAttribute('data-tab')
      if (tabName === activeTab) {
        item.classList.add('active')
      }
      else {
        item.classList.remove('active')
      }
    })
  }, [activeTab])

  const handleTabClick = (tab: TabName) => {
    setActiveTab(tab)
  }

  const handleFabClick = () => {
    setActiveTab('add')
  }

  return (
    <>
      <HeaderStateful />

      <main className="content">
        <AddTabStateful active={activeTab === 'add'} />

        <ChatTabStateful active={activeTab === 'chat'} />

        <TransformTabStateful active={activeTab === 'transform'} />

        <LibraryTabStateful active={activeTab === 'library'} />

        <SettingsTabStateful active={activeTab === 'settings'} />
      </main>

      <BottomNav activeTab={activeTab} onTabClick={handleTabClick} />

      <Fab hidden={fabHidden} onClick={handleFabClick} />

      <PickerModal />
      <NotebookDialog
        visible={notebookDialog.visible}
        title={notebookDialog.title}
        placeholder={notebookDialog.placeholder}
        confirmText={notebookDialog.confirmText}
        inputValue={notebookDialog.inputValue}
        onConfirm={_handleNotebookConfirm}
        onCancel={_handleNotebookCancel}
        onInput={_setNotebookInput}
      />
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={_handleConfirm}
        onCancel={_handleConfirmCancel}
      />
      <NotificationStateful />
      <Onboarding hidden={onboardingHidden} />
    </>
  )
}

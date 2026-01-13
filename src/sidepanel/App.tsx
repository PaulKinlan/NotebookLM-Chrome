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
import { useNotification } from './hooks/useNotification.ts'

// ============================================================================
// Types
// ============================================================================

type TabName = 'add' | 'chat' | 'transform' | 'library' | 'settings'

export interface AppCallbacks {
  showNotebook: (options?: { title?: string, placeholder?: string, confirmText?: string }) => Promise<string | null>
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
}

interface AppProps {
  activeTab: TabName
  fabHidden: boolean
  onboardingHidden: boolean
  onProvideCallbacks?: (callbacks: AppCallbacks) => void
}

// ============================================================================
// App Component
// ============================================================================

export function App(props: AppProps = {
  activeTab: 'add',
  fabHidden: true,
  onboardingHidden: true,
}): JSX.Element { // eslint-disable-line no-undef
  const { activeTab: initialTab, fabHidden, onboardingHidden, onProvideCallbacks } = props

  // Use useState for tab management instead of imperative DOM manipulation
  const [activeTab, setActiveTab] = useState<TabName>(initialTab)

  // Use useDialog hook for dialog state management
  const {
    confirmDialog,
    notebookDialog,
    showNotebook,
    _handleConfirm,
    _handleConfirmCancel,
    _handleNotebookConfirm,
    _handleNotebookCancel,
    _setNotebookInput,
  } = useDialog()

  // Use useNotification hook for notification state
  const { showNotification } = useNotification()

  // Provide callbacks to main.tsx via the onProvideCallbacks prop
  // This allows main.tsx to trigger dialogs/notifications without global state
  useEffect(() => {
    if (onProvideCallbacks) {
      onProvideCallbacks({ showNotebook, showNotification })
    }
  }, [showNotebook, showNotification, onProvideCallbacks])

  const handleTabClick = (tab: TabName) => {
    setActiveTab(tab)
  }

  const handleFabClick = () => {
    setActiveTab('add')
  }

  return (
    <>
      <HeaderStateful showNotebook={showNotebook} />

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

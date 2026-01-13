// ============================================================================
// App Root Component
// ============================================================================

// Import all components
import { useState, useEffect, useRef } from '../jsx-runtime/hooks/index.ts'
import { HeaderStateful } from './components/Header'
import { AddTabStateful } from './components/AddTabStateful'
import { ChatTabStateful } from './components/ChatTabStateful'
import { TransformTabStateful } from './components/TransformTabStateful'
import { LibraryTabStateful } from './components/LibraryTabStateful'
import { SettingsTabStateful } from './components/SettingsTabStateful'
import { BottomNav } from './components/BottomNav'
import { Fab } from './components/Fab'
import { NotebookDialog, ConfirmDialog } from './components/Modals'
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
}) {
  const { activeTab: initialTab, fabHidden, onboardingHidden, onProvideCallbacks } = props

  console.log('[App] Component function called, initialTab:', initialTab)

  // Use useState for tab management instead of imperative DOM manipulation
  const [activeTab, setActiveTab] = useState<TabName>(initialTab)

  console.log('[App] After useState, activeTab:', activeTab)

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

  // Store callbacks in refs to avoid triggering useEffect on every render
  const showNotebookRef = useRef(showNotebook)
  const showNotificationRef = useRef(showNotification)

  // Keep refs in sync (but only when the functions actually change)
  showNotebookRef.current = showNotebook
  showNotificationRef.current = showNotification

  // Provide callbacks to main.tsx via the onProvideCallbacks prop
  // This allows main.tsx to trigger dialogs/notifications without global state
  useEffect(() => {
    console.log('[App] useEffect running, calling onProvideCallbacks')
    if (onProvideCallbacks) {
      onProvideCallbacks({
        showNotebook: (...args) => showNotebookRef.current(...args),
        showNotification: (...args) => showNotificationRef.current(...args),
      })
    }
  }, [onProvideCallbacks])

  const handleTabClick = (tab: TabName) => {
    console.log('[App] handleTabClick called with tab:', tab, 'current activeTab:', activeTab)
    setActiveTab(tab)
    console.log('[App] setActiveTab called, waiting for re-render...')
  }

  const handleFabClick = () => {
    setActiveTab('add')
  }

  return (
    <>
      <HeaderStateful showNotebook={showNotebook} onTabChange={handleTabClick} />

      <main className="content">
        <AddTabStateful active={activeTab === 'add'} onTabChange={handleTabClick} />

        <ChatTabStateful active={activeTab === 'chat'} />

        <TransformTabStateful active={activeTab === 'transform'} />

        <LibraryTabStateful active={activeTab === 'library'} onTabChange={handleTabClick} />

        <SettingsTabStateful active={activeTab === 'settings'} />
      </main>

      <BottomNav activeTab={activeTab} onTabClick={handleTabClick} />

      <Fab hidden={fabHidden} onClick={handleFabClick} />

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

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
import { PickerModal } from './components/Modals'
import { NotebookDialog } from './components/Modals'
import { ConfirmDialog } from './components/Modals'
import { Notification } from './components/Notification'
import { Onboarding } from './components/Onboarding'
import {
  addCurrentTab as addCurrentTabService,
  getTabs,
  importTabs,
  getTabGroups,
  importTabGroups,
  getBookmarks,
  importBookmarks,
  getHistory,
  importHistory,
} from './services/sources'
import { clearAllData as clearAllStorage, saveSummary } from '../lib/storage'
import { generateSummary } from '../lib/ai'
import { checkPermissions, requestPermission as requestPerm } from '../lib/permissions'

// Import signals from store
import {
  activeTab,
  currentNotebookId,
  notebooks,
  sources,
  summaryContent,
  showSummary,
  showNotification,
  notebookDialog,
  confirmDialog,
} from './store'
import type { TabName } from './store'

// Import hooks that still exist (not yet migrated)
import {
  useDialog,
  useNotebook,
  useSources,
  useChat,
  useToolPermissions,
  useTransform,
} from './hooks'
import { useEffect } from 'preact/hooks'

// ============================================================================
// Types
// ============================================================================

interface AppProps {
  initialTab: TabName
  fabHidden: boolean
  onboardingHidden: boolean
}

// ============================================================================
// App Component
// ============================================================================

export function App(props: AppProps) {
  const { initialTab, fabHidden, onboardingHidden } = props

  // Initialize active tab from props
  useEffect(() => {
    activeTab.value = initialTab
  }, [initialTab])

  // Dialog hooks
  const {
    openCreateNotebookDialog,
    showConfirmDialog,
    closeNotebookDialog,
    closeConfirmDialog,
    triggerConfirm,
  } = useDialog()

  // Notebook hooks (keep for now, will be refactored)
  const { selectNotebook, createNotebook } = useNotebook()
  const { removeSource } = useSources(currentNotebookId.value)

  // Chat hooks
  const { query, clearChat, setSources: setChatSources } = useChat(currentNotebookId.value)

  // Feature hooks
  const { loadConfig: loadToolConfig } = useToolPermissions()
  const { transform } = useTransform()

  // Initialize tool permissions on mount
  useEffect(() => {
    void loadToolConfig()
  }, [loadToolConfig])

  // Sync sources to chat hook when they change
  useEffect(() => {
    setChatSources(sources.value)
  }, [sources.value, setChatSources])

  // Handle tab switching
  const handleTabClick = (tab: TabName) => {
    activeTab.value = tab
  }

  // Handle source removal
  const handleRemoveSource = async (sourceId: string) => {
    if (currentNotebookId.value) {
      await removeSource(sourceId)
    }
  }

  // Handle notebook operations
  const handleNotebookChange = async (notebookId: string) => {
    if (notebookId) {
      await selectNotebook(notebookId)
    }
  }

  const handleNewNotebook = () => {
    openCreateNotebookDialog()
  }

  // Handle source operations
  const handleAddCurrentTab = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    try {
      const source = await addCurrentTabService()
      if (source) {
        showNotification(`Added "${source.title}" to notebook`)
      }
      else {
        showNotification('Failed to add current tab')
      }
    }
    catch (error) {
      console.error('Failed to add current tab:', error)
      showNotification('Failed to add current tab')
    }
  }

  const handleImportTabs = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    // Check permission
    const perms = await checkPermissions()
    if (!perms.tabs) {
      const granted = await requestPerm('tabs')
      if (!granted) {
        showNotification('Tabs permission is required to import tabs')
        return
      }
    }

    try {
      const tabs = await getTabs()
      if (tabs.length === 0) {
        showNotification('No tabs found to import')
        return
      }

      const importedSources = await importTabs(tabs.map(t => t.id))
      showNotification(`Imported ${importedSources.length} tabs`)
    }
    catch (error) {
      console.error('Failed to import tabs:', error)
      showNotification('Failed to import tabs')
    }
  }

  const handleImportTabGroups = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    // Check permission
    const perms = await checkPermissions()
    if (!perms.tabGroups) {
      const granted = await requestPerm('tabGroups')
      if (!granted) {
        showNotification('Tab groups permission is required')
        return
      }
    }

    try {
      const groups = await getTabGroups()
      if (groups.length === 0) {
        showNotification('No tab groups found')
        return
      }

      const importedSources = await importTabGroups(groups.map(g => g.id))
      showNotification(`Imported ${importedSources.length} sources from tab groups`)
    }
    catch (error) {
      console.error('Failed to import tab groups:', error)
      showNotification('Failed to import tab groups')
    }
  }

  const handleImportBookmarks = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    // Check permission
    const perms = await checkPermissions()
    if (!perms.bookmarks) {
      const granted = await requestPerm('bookmarks')
      if (!granted) {
        showNotification('Bookmarks permission is required')
        return
      }
    }

    try {
      const bookmarks = await getBookmarks()
      if (bookmarks.length === 0) {
        showNotification('No bookmarks found')
        return
      }

      const importedSources = await importBookmarks(bookmarks.map(b => b.id))
      showNotification(`Imported ${importedSources.length} bookmarks`)
    }
    catch (error) {
      console.error('Failed to import bookmarks:', error)
      showNotification('Failed to import bookmarks')
    }
  }

  const handleImportHistory = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    // Check permission
    const perms = await checkPermissions()
    if (!perms.history) {
      const granted = await requestPerm('history')
      if (!granted) {
        showNotification('History permission is required')
        return
      }
    }

    try {
      const historyItems = await getHistory(100)
      if (historyItems.length === 0) {
        showNotification('No history found')
        return
      }

      const importedSources = await importHistory(historyItems.map(h => h.id))
      showNotification(`Imported ${importedSources.length} history items`)
    }
    catch (error) {
      console.error('Failed to import history:', error)
      showNotification('Failed to import history')
    }
  }

  // Handle chat operations
  const handleQuery = (question: string) => {
    void query(question)
  }

  const handleClearChat = () => {
    void clearChat()
  }

  const handleRegenerateSummary = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    if (sources.value.length === 0) {
      showNotification('Add some sources first to generate a summary')
      return
    }

    try {
      const content = await generateSummary(sources.value)
      await saveSummary({
        id: crypto.randomUUID(),
        notebookId: currentNotebookId.value,
        sourceIds: sources.value.map(s => s.id),
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // Update signal state
      summaryContent.value = content
      showSummary.value = true

      showNotification('Summary regenerated successfully')
    }
    catch (error) {
      console.error('Failed to regenerate summary:', error)
      showNotification('Failed to regenerate summary')
    }
  }

  // Handle transform
  const handleTransform = (type: string) => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }
    void transform(type as unknown as 'podcast' | 'quiz' | 'takeaways' | 'email' | 'slidedeck' | 'report' | 'datatable' | 'mindmap' | 'flashcards' | 'timeline' | 'glossary' | 'comparison' | 'faq' | 'actionitems' | 'executivebrief' | 'studyguide' | 'proscons' | 'citations' | 'outline', sources.value, currentNotebookId.value)
  }

  const handleClearAllData = () => {
    showConfirmDialog(
      'Clear All Data',
      'This will permanently delete all notebooks, sources, chat history, and AI profiles. This action cannot be undone.',
      () => {
        void (async () => {
          try {
            await clearAllStorage()
            await chrome.storage.local.clear()
            location.reload()
          }
          catch (error) {
            console.error('Failed to clear all data:', error)
            showNotification('Failed to clear all data. Please try again.')
          }
        })()
      },
    )
  }

  return (
    <>
      <Header
        onLibraryClick={() => { activeTab.value = 'library' }}
        onSettingsClick={() => { activeTab.value = 'settings' }}
        onNotebookChange={notebookId => void handleNotebookChange(notebookId)}
        onNewNotebook={handleNewNotebook}
        notebooks={notebooks.value}
        currentNotebookId={currentNotebookId.value}
      />

      <main className="content">
        <AddTab
          active={activeTab.value === 'add'}
          sources={sources.value}
          onAddCurrentTab={() => void handleAddCurrentTab()}
          onImportTabs={() => void handleImportTabs()}
          onImportTabGroups={() => void handleImportTabGroups()}
          onImportBookmarks={() => void handleImportBookmarks()}
          onImportHistory={() => void handleImportHistory()}
          onRemoveSource={id => void handleRemoveSource(id)}
        />

        <ChatTab
          active={activeTab.value === 'chat'}
          sources={sources.value}
          onQuery={handleQuery}
          onClearChat={handleClearChat}
          onRegenerateSummary={() => void handleRegenerateSummary()}
          onAddCurrentTab={() => void handleAddCurrentTab()}
          onRemoveSource={id => void handleRemoveSource(id)}
          summaryContent={summaryContent.value}
          showSummary={showSummary.value}
        />

        <TransformTab active={activeTab.value === 'transform'} onTransform={handleTransform} />

        <LibraryTab active={activeTab.value === 'library'} />

        <SettingsTab
          active={activeTab.value === 'settings'}
          onClearAllData={() => void handleClearAllData()}
        />
      </main>

      <BottomNav activeTab={activeTab.value} onTabClick={handleTabClick} />

      <Fab hidden={fabHidden} onClick={() => { activeTab.value = 'add' }} />

      <PickerModal />
      <NotebookDialog
        isOpen={notebookDialog.value.isOpen}
        mode={notebookDialog.value.mode}
        initialName={notebookDialog.value.initialName}
        onClose={closeNotebookDialog}
        onCreateNotebook={createNotebook}
      />
      <ConfirmDialog
        isOpen={confirmDialog.value?.isOpen ?? false}
        title={confirmDialog.value?.title ?? null}
        message={confirmDialog.value?.message ?? null}
        onConfirm={triggerConfirm}
        onClose={closeConfirmDialog}
      />
      <Notification />
      <Onboarding hidden={onboardingHidden} />
    </>
  )
}

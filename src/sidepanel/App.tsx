// ============================================================================
// App Root Component
// ============================================================================

// Type guard for refresh sources response
interface RefreshSourcesResponse {
  success: boolean
  refreshedCount: number
}

function isRefreshSourcesResponse(value: unknown): value is RefreshSourcesResponse {
  return (
    typeof value === 'object'
    && value !== null
    && 'success' in value
    && typeof (value as RefreshSourcesResponse).success === 'boolean'
    && 'refreshedCount' in value
    && typeof (value as RefreshSourcesResponse).refreshedCount === 'number'
  )
}

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
  importTabs,
  addSourceFromUrl,
} from './services/sources'
import { clearAllData as clearAllStorage } from '../lib/storage'
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
  usePickerModal,
  useOverview,
} from './hooks'
import { useEffect, useState, useCallback } from 'preact/hooks'

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
  const { selectNotebook, createNotebook, deleteNotebook } = useNotebook()
  const { removeSource } = useSources(currentNotebookId.value)

  // Chat hooks
  const { query, clearChat, setSources: setChatSources } = useChat(currentNotebookId.value)

  // Feature hooks
  const { loadConfig: loadToolConfig } = useToolPermissions()
  const { transform } = useTransform(currentNotebookId.value)

  // Picker modal hook
  const {
    isOpen: pickerIsOpen,
    pickerType,
    filteredItems: pickerItems,
    isLoading: pickerLoading,
    searchQuery: pickerSearchQuery,
    openPicker,
    closePicker,
    setSearchQuery: setPickerSearchQuery,
    toggleItem: togglePickerItem,
    selectAll: selectAllPickerItems,
    deselectAll: deselectAllPickerItems,
    addSelected: addSelectedPickerItems,
  } = usePickerModal()

  // Overview hook - loads and caches notebook summary
  const { regenerateOverview } = useOverview(currentNotebookId.value, sources.value)

  // State for highlighted (multi-selected) tabs in Chrome
  const [highlightedTabCount, setHighlightedTabCount] = useState(0)

  // Check for highlighted tabs on mount and when tab becomes active
  const checkHighlightedTabs = useCallback(async () => {
    try {
      const tabs = await chrome.tabs.query({ highlighted: true, currentWindow: true })
      // Subtract 1 because the sidepanel's tab might be highlighted too
      const count = tabs.filter(t => t.url && !t.url.startsWith('chrome://')).length
      setHighlightedTabCount(count > 1 ? count : 0)
    }
    catch {
      setHighlightedTabCount(0)
    }
  }, [])

  // Initialize tool permissions on mount
  useEffect(() => {
    void loadToolConfig()
  }, [loadToolConfig])

  // Check highlighted tabs on mount and periodically
  useEffect(() => {
    void checkHighlightedTabs()

    // Also check when the window gains focus
    const handleFocus = () => void checkHighlightedTabs()
    window.addEventListener('focus', handleFocus)

    // Check periodically when on Add tab
    const interval = setInterval(() => {
      if (activeTab.value === 'add') {
        void checkHighlightedTabs()
      }
    }, 2000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [checkHighlightedTabs])

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

  // Handle adding highlighted (multi-selected) tabs
  const handleAddHighlightedTabs = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    try {
      const tabs = await chrome.tabs.query({ highlighted: true, currentWindow: true })
      const validTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && t.id)

      if (validTabs.length === 0) {
        showNotification('No valid tabs selected')
        return
      }

      const importedSources = await importTabs(validTabs.map(t => String(t.id)))
      showNotification(`Added ${importedSources.length} tabs`)
      setHighlightedTabCount(0)
    }
    catch (error) {
      console.error('Failed to add highlighted tabs:', error)
      showNotification('Failed to add selected tabs')
    }
  }

  const handleOpenTabsPicker = async () => {
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

    await openPicker('tabs')
  }

  const handleOpenTabGroupsPicker = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    // Check permissions
    const perms = await checkPermissions()
    if (!perms.tabs) {
      const granted = await requestPerm('tabs')
      if (!granted) {
        showNotification('Tabs permission is required')
        return
      }
    }
    if (!perms.tabGroups) {
      const granted = await requestPerm('tabGroups')
      if (!granted) {
        showNotification('Tab groups permission is required')
        return
      }
    }

    await openPicker('tabGroups')
  }

  const handleOpenBookmarksPicker = async () => {
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

    await openPicker('bookmarks')
  }

  const handleOpenHistoryPicker = async () => {
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

    await openPicker('history')
  }

  // Handle adding selected items from picker
  const handleAddPickerItems = async () => {
    const count = await addSelectedPickerItems()
    if (count > 0) {
      showNotification(`Added ${count} items`)
    }
  }

  // Get picker title based on type
  const getPickerTitle = () => {
    switch (pickerType) {
      case 'tabs': return 'Select Tabs'
      case 'tabGroups': return 'Select Tab Groups'
      case 'bookmarks': return 'Select Bookmarks'
      case 'history': return 'Select from History'
      default: return 'Select Items'
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
      await regenerateOverview()
      showNotification('Overview regenerated successfully')
    }
    catch (error) {
      console.error('Failed to regenerate overview:', error)
      showNotification('Failed to regenerate overview')
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
          highlightedTabCount={highlightedTabCount}
          onAddCurrentTab={() => void handleAddCurrentTab()}
          onAddHighlightedTabs={() => void handleAddHighlightedTabs()}
          onImportTabs={() => void handleOpenTabsPicker()}
          onImportTabGroups={() => void handleOpenTabGroupsPicker()}
          onImportBookmarks={() => void handleOpenBookmarksPicker()}
          onImportHistory={() => void handleOpenHistoryPicker()}
          onRemoveSource={id => void handleRemoveSource(id)}
        />

        <ChatTab
          active={activeTab.value === 'chat'}
          sources={sources.value}
          onQuery={handleQuery}
          onClearChat={handleClearChat}
          onRegenerateSummary={() => void handleRegenerateSummary()}
          onAddCurrentTab={() => void handleAddCurrentTab()}
          onManageSources={() => { activeTab.value = 'add' }}
          onRefreshSources={() => {
            void (async () => {
              if (!currentNotebookId.value) {
                showNotification('Please select a notebook first')
                return
              }
              showNotification('Refreshing sources...')
              try {
                const result: unknown = await chrome.runtime.sendMessage({
                  type: 'REFRESH_ALL_SOURCES',
                  payload: { notebookId: currentNotebookId.value },
                })
                if (isRefreshSourcesResponse(result) && result.success) {
                  if (result.refreshedCount > 0) {
                    showNotification(`Refreshed ${result.refreshedCount} source${result.refreshedCount > 1 ? 's' : ''}`)
                  }
                  else {
                    showNotification('No sources to refresh')
                  }
                }
                else {
                  showNotification('Failed to refresh sources')
                }
              }
              catch (error) {
                console.error('Failed to refresh sources:', error)
                showNotification('Failed to refresh sources')
              }
            })()
          }}
          onRemoveSource={id => void handleRemoveSource(id)}
          onAddSuggestedLink={(url: string, title: string) => {
            void (async () => {
              if (!currentNotebookId.value) {
                showNotification('Please select a notebook first')
                return
              }
              try {
                const source = await addSourceFromUrl(url, title)
                if (source) {
                  showNotification(`Added "${title}" to notebook`)
                }
                else {
                  showNotification('Failed to add link')
                }
              }
              catch (error) {
                console.error('Failed to add suggested link:', error)
                showNotification('Failed to add link')
              }
            })()
          }}
          summaryContent={summaryContent.value}
          showSummary={showSummary.value}
        />

        <TransformTab active={activeTab.value === 'transform'} onTransform={handleTransform} notebookId={currentNotebookId.value} />

        <LibraryTab
          active={activeTab.value === 'library'}
          onSelectNotebook={notebookId => void handleNotebookChange(notebookId)}
          onCreateNotebook={handleNewNotebook}
          onEditNotebook={(notebook) => {
            notebookDialog.value = {
              isOpen: true,
              mode: 'edit',
              initialName: notebook.name,
            }
          }}
          onDeleteNotebook={(notebookId) => {
            showConfirmDialog(
              'Delete Notebook',
              'Are you sure you want to delete this notebook? This will also delete all sources in the notebook.',
              () => {
                void deleteNotebook(notebookId)
              },
            )
          }}
        />

        <SettingsTab
          active={activeTab.value === 'settings'}
          onClearAllData={() => void handleClearAllData()}
        />
      </main>

      <BottomNav activeTab={activeTab.value} onTabClick={handleTabClick} />

      <Fab hidden={fabHidden} onClick={() => { activeTab.value = 'add' }} />

      <PickerModal
        isOpen={pickerIsOpen}
        title={getPickerTitle()}
        items={pickerItems}
        isLoading={pickerLoading}
        searchQuery={pickerSearchQuery}
        selectedCount={pickerItems.filter(i => i.selected).length}
        onClose={closePicker}
        onSearchChange={setPickerSearchQuery}
        onToggleItem={togglePickerItem}
        onSelectAll={selectAllPickerItems}
        onDeselectAll={deselectAllPickerItems}
        onAddSelected={() => void handleAddPickerItems()}
      />
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

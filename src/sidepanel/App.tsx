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
import { PickerModal, NotebookDialog, ConfirmDialog, AddNoteDialog, ImagePickerModal } from './components/Modals'
import { Notification } from './components/Notification'
import { Onboarding } from './components/Onboarding'
import { DropZone } from './components/DropZone'
import {
  addCurrentTab as addCurrentTabService,
  importTabs,
  addSourceFromUrl,
  addTextSource,
  addNote as addNoteService,
  getImagesFromCurrentPage,
  importImages,
} from './services/sources'
import type { ImageInfo } from './services/sources'
import { clearAllData as clearAllStorage } from '../lib/storage'
import { checkPermissions, requestPermission as requestPerm } from '../lib/permissions'

// Import signals from store
import {
  activeTab,
  navigateToTab,
  currentNotebookId,
  notebooks,
  sources,
  summaryContent,
  showSummary,
  showNotification,
  notebookDialog,
  confirmDialog,
  pendingContextMenuAction,
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
  fabHidden: boolean
  onboardingHidden: boolean
}

// ============================================================================
// App Component
// ============================================================================

export function App(props: AppProps) {
  const { fabHidden, onboardingHidden } = props

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

  // State for refresh button loading indicators
  const [isRefreshingSources, setIsRefreshingSources] = useState(false)
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false)

  // State for note dialog
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)

  // State for image picker
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false)
  const [imagePickerLoading, setImagePickerLoading] = useState(false)
  const [pageImages, setPageImages] = useState<Array<ImageInfo & { selected: boolean }>>([])
  const selectedImageCount = pageImages.filter(img => img.selected).length

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

  // Handle tab switching with view transitions
  const handleTabClick = (tab: TabName) => {
    navigateToTab(tab)
  }

  // Handle source removal
  const handleRemoveSource = async (sourceId: string) => {
    if (currentNotebookId.value) {
      await removeSource(sourceId)
    }
  }

  // Handle clearing all sources
  const handleClearAllSources = () => {
    if (!currentNotebookId.value || sources.value.length === 0) {
      return
    }

    showConfirmDialog(
      'Clear All Sources',
      `Are you sure you want to remove all ${sources.value.length} sources from this notebook?`,
      () => {
        void (async () => {
          // Remove all sources one by one
          for (const source of sources.value) {
            await removeSource(source.id)
          }
          showNotification('All sources cleared')
        })()
      },
    )
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

  /**
   * Handle notebook creation with optional pending context menu action.
   * If there's a pending action (from context menu), execute it after creating the notebook.
   * The extraction happens in the background - dialog closes immediately.
   */
  const handleCreateNotebookWithPendingAction = async (name: string): Promise<void> => {
    // Create the notebook first
    const notebook = await createNotebook(name)

    // Check if there's a pending action to execute
    const pendingAction = pendingContextMenuAction.value
    if (pendingAction) {
      // Clear the pending action first
      pendingContextMenuAction.value = null

      // Execute the pending action in the background (don't await)
      // This allows the dialog to close immediately while sources are added
      void (async () => {
        try {
          switch (pendingAction.type) {
            case 'ADD_PAGE': {
              const tab = await chrome.tabs.get(pendingAction.tabId)
              if (tab.url) {
                await chrome.runtime.sendMessage({
                  type: 'EXTRACT_FROM_URL',
                  payload: { url: tab.url, notebookId: notebook.id },
                })
              }
              break
            }
            case 'ADD_LINK': {
              await chrome.runtime.sendMessage({
                type: 'EXTRACT_FROM_URL',
                payload: { url: pendingAction.linkUrl, notebookId: notebook.id },
              })
              break
            }
            case 'ADD_SELECTION_LINKS': {
              // Process links in parallel in the background
              const results = await Promise.allSettled(
                pendingAction.links.map(linkUrl =>
                  chrome.runtime.sendMessage({
                    type: 'EXTRACT_FROM_URL',
                    payload: { url: linkUrl, notebookId: notebook.id },
                  }),
                ),
              )
              const failures = results.filter(r => r.status === 'rejected')
              if (failures.length > 0) {
                console.warn(`Failed to extract ${failures.length} of ${pendingAction.links.length} links`)
              }
              break
            }
          }
        }
        catch (error) {
          console.error('Failed to execute pending action:', error)
          showNotification('Failed to add sources to notebook')
        }
      })()
    }
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

  // Handle note dialog
  const handleOpenNoteDialog = () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }
    setIsNoteDialogOpen(true)
  }

  const handleAddNote = async (title: string, content: string) => {
    try {
      const source = await addNoteService(title, content)
      if (source) {
        showNotification(`Added note "${source.title}"`)
      }
      else {
        showNotification('Failed to add note')
      }
    }
    catch (error) {
      console.error('Failed to add note:', error)
      showNotification('Failed to add note')
    }
  }

  // Handle image picker
  const handleOpenImagePicker = async () => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    setIsImagePickerOpen(true)
    setImagePickerLoading(true)

    try {
      const images = await getImagesFromCurrentPage()
      setPageImages(images.map(img => ({ ...img, selected: false })))
    }
    catch (error) {
      console.error('Failed to get images from page:', error)
      showNotification('Failed to scan page for images')
      setPageImages([])
    }
    finally {
      setImagePickerLoading(false)
    }
  }

  const handleToggleImage = (src: string) => {
    setPageImages(prev =>
      prev.map(img =>
        img.src === src ? { ...img, selected: !img.selected } : img,
      ),
    )
  }

  const handleSelectAllImages = () => {
    setPageImages(prev => prev.map(img => ({ ...img, selected: true })))
  }

  const handleDeselectAllImages = () => {
    setPageImages(prev => prev.map(img => ({ ...img, selected: false })))
  }

  const handleAddSelectedImages = async () => {
    const selectedImages = pageImages.filter(img => img.selected)
    if (selectedImages.length === 0) return

    try {
      const sources = await importImages(selectedImages)
      if (sources.length > 0) {
        showNotification(`Added ${sources.length} image${sources.length !== 1 ? 's' : ''}`)
      }
      setIsImagePickerOpen(false)
      setPageImages([])
    }
    catch (error) {
      console.error('Failed to add images:', error)
      showNotification('Failed to add images')
    }
  }

  const handleCloseImagePicker = () => {
    setIsImagePickerOpen(false)
    setPageImages([])
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

    setIsRegeneratingSummary(true)
    try {
      await regenerateOverview()
      showNotification('Overview regenerated successfully')
    }
    catch (error) {
      console.error('Failed to regenerate overview:', error)
      showNotification('Failed to regenerate overview')
    }
    finally {
      setIsRegeneratingSummary(false)
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

  // Handle dropped links from drag-and-drop
  const handleDropLinks = async (links: Array<{ url: string, title: string }>) => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    try {
      // Process all links in parallel - each completes independently
      const results = await Promise.allSettled(
        links.map(link => addSourceFromUrl(link.url, link.title)),
      )

      const addedCount = results.filter(
        r => r.status === 'fulfilled' && r.value !== null,
      ).length

      if (addedCount > 0) {
        showNotification(`Added ${addedCount} link${addedCount > 1 ? 's' : ''} to notebook`)
      }
      else {
        showNotification('Failed to add links')
      }
    }
    catch (error) {
      console.error('Failed to add dropped links:', error)
      showNotification('Failed to add links')
    }
  }

  // Handle dropped text from drag-and-drop
  const handleDropText = async (text: string) => {
    if (!currentNotebookId.value) {
      showNotification('Please select a notebook first')
      return
    }

    try {
      const source = await addTextSource(text)
      if (source) {
        showNotification(`Added text to notebook`)
      }
      else {
        showNotification('Failed to add text')
      }
    }
    catch (error) {
      console.error('Failed to add dropped text:', error)
      showNotification('Failed to add text')
    }
  }

  return (
    <>
      <Header
        onLibraryClick={() => { navigateToTab('library') }}
        onSettingsClick={() => { navigateToTab('settings') }}
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
          onAddNote={handleOpenNoteDialog}
          onAddImages={() => void handleOpenImagePicker()}
          onRemoveSource={id => void handleRemoveSource(id)}
        />

        <ChatTab
          active={activeTab.value === 'chat'}
          sources={sources.value}
          onQuery={handleQuery}
          onClearChat={handleClearChat}
          onRegenerateSummary={() => void handleRegenerateSummary()}
          onAddCurrentTab={() => void handleAddCurrentTab()}
          onRefreshSources={() => {
            void (async () => {
              if (!currentNotebookId.value) {
                showNotification('Please select a notebook first')
                return
              }
              setIsRefreshingSources(true)
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
              finally {
                setIsRefreshingSources(false)
              }
            })()
          }}
          isRefreshingSources={isRefreshingSources}
          isRegeneratingSummary={isRegeneratingSummary}
          onRemoveSource={id => void handleRemoveSource(id)}
          onClearAllSources={handleClearAllSources}
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

      <Fab hidden={fabHidden} onClick={() => { navigateToTab('add') }} />

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
        onCreateNotebook={handleCreateNotebookWithPendingAction}
      />
      <ConfirmDialog
        isOpen={confirmDialog.value?.isOpen ?? false}
        title={confirmDialog.value?.title ?? null}
        message={confirmDialog.value?.message ?? null}
        onConfirm={triggerConfirm}
        onClose={closeConfirmDialog}
      />
      <AddNoteDialog
        isOpen={isNoteDialogOpen}
        onClose={() => setIsNoteDialogOpen(false)}
        onAddNote={handleAddNote}
      />
      <ImagePickerModal
        isOpen={isImagePickerOpen}
        images={pageImages}
        isLoading={imagePickerLoading}
        selectedCount={selectedImageCount}
        onClose={handleCloseImagePicker}
        onToggleImage={handleToggleImage}
        onSelectAll={handleSelectAllImages}
        onDeselectAll={handleDeselectAllImages}
        onAddSelected={() => void handleAddSelectedImages()}
      />
      <Notification />
      <Onboarding hidden={onboardingHidden} />
      <DropZone
        onDropLinks={links => void handleDropLinks(links)}
        onDropText={text => void handleDropText(text)}
        disabled={!currentNotebookId.value}
      />
    </>
  )
}

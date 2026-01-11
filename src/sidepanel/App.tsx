import { Header } from './components/Header';
import { AddTab } from './components/AddTab';
import { ChatTab } from './components/ChatTab';
import { TransformTab } from './components/TransformTab';
import { LibraryTab } from './components/LibraryTab';
import { SettingsTab } from './components/SettingsTab';
import { BottomNav } from './components/BottomNav';
import { Fab } from './components/Fab';
import { PickerModal, NotebookDialog, ConfirmDialog } from './components/Modals';
import { Notification } from './components/Notification';
import { Onboarding } from './components/Onboarding';

type PermissionType = 'tabs' | 'tabGroups' | 'bookmarks' | 'history';

interface AppProps {
  activeTab: string;
  fabHidden: boolean;
  onboardingHidden: boolean;
  onTabClick: (tab: string) => void;
  onHeaderLibraryClick: () => void;
  onHeaderSettingsClick: () => void;
  onNotebookChange: (id: string) => void;
  onNewNotebook: () => void;
  onAddCurrentTab: () => void;
  onImportTabs: () => void;
  onImportTabGroups: () => void;
  onImportBookmarks: () => void;
  onImportHistory: () => void;
  onQuery: () => void;
  onClearChat: () => void;
  onRegenerateSummary: () => void;
  onTransform: (type: string) => void;
  onPermissionToggle: (permission: PermissionType) => void;
  onClearAllData: () => void;
  onFabClick: () => void;
}

export function App(props: AppProps) {
  const {
    activeTab,
    fabHidden,
    onboardingHidden,
    onTabClick,
    onHeaderLibraryClick,
    onHeaderSettingsClick,
    onNotebookChange,
    onNewNotebook,
    onAddCurrentTab,
    onImportTabs,
    onImportTabGroups,
    onImportBookmarks,
    onImportHistory,
    onQuery,
    onClearChat,
    onRegenerateSummary,
    onTransform,
    onPermissionToggle,
    onClearAllData,
    onFabClick,
  } = props;

  return (
    <>
      <Header
        onLibraryClick={onHeaderLibraryClick}
        onSettingsClick={onHeaderSettingsClick}
        onNotebookChange={onNotebookChange}
        onNewNotebook={onNewNotebook}
      />

      <main className="content">
        <AddTab
          active={activeTab === 'add'}
          onAddCurrentTab={onAddCurrentTab}
          onImportTabs={onImportTabs}
          onImportTabGroups={onImportTabGroups}
          onImportBookmarks={onImportBookmarks}
          onImportHistory={onImportHistory}
        />

        <ChatTab
          active={activeTab === 'chat'}
          onQuery={onQuery}
          onClearChat={onClearChat}
          onRegenerateSummary={onRegenerateSummary}
          onAddCurrentTab={onAddCurrentTab}
        />

        <TransformTab active={activeTab === 'transform'} onTransform={onTransform} />

        <LibraryTab active={activeTab === 'library'} />

        <SettingsTab
          active={activeTab === 'settings'}
          onPermissionToggle={onPermissionToggle}
          onClearAllData={onClearAllData}
        />
      </main>

      <BottomNav activeTab={activeTab} onTabClick={onTabClick} />

      <Fab hidden={fabHidden} onClick={onFabClick} />

      <PickerModal />

      <NotebookDialog />

      <ConfirmDialog />

      <Notification />

      <Onboarding hidden={onboardingHidden} />
    </>
  );
}

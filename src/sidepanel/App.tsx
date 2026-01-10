import { Header } from './components/Header';
import { AddTab } from './components/AddTab';
import { ChatTab } from './components/ChatTab';
import { TransformTab } from './components/TransformTab';
import { LibraryTab } from './components/LibraryTab';
import { SettingsTab } from './components/SettingsTab';
import { BottomNav } from './components/BottomNav';
import { Fab } from './components/Fab';
import { PickerModal } from './components/Modals';
import { NotebookDialog } from './components/Modals';
import { ConfirmDialog } from './components/Modals';
import { Notification } from './components/Notification';
import { Onboarding } from './components/Onboarding';

type TransformType =
  | "podcast"
  | "quiz"
  | "takeaways"
  | "email"
  | "slidedeck"
  | "report"
  | "datatable"
  | "mindmap"
  | "flashcards"
  | "timeline"
  | "glossary"
  | "comparison"
  | "faq"
  | "actionitems"
  | "executivebrief"
  | "studyguide"
  | "proscons"
  | "citations"
  | "outline";

type PermissionType = "tabs" | "tabGroups" | "bookmarks" | "history";

interface AppProps {
  activeTab: string;
  fabHidden: boolean;
  onTabClick: (tab: string) => void;
  // Event handlers passed through
  onHeaderLibraryClick: () => void;
  onHeaderSettingsClick: () => void;
  onNotebookChange: (id: string) => void;
  onAIConfigChange: () => void;
  onNewNotebook: () => void;
  onAddCurrentTab: () => void;
  onImportTabs: () => void;
  onImportTabGroups: () => void;
  onImportBookmarks: () => void;
  onImportHistory: () => void;
  onQuery: () => void;
  onClearChat: () => void;
  onRegenerateSummary: () => void;
  onTransform: (type: TransformType) => void;
  onPermissionToggle: (permission: PermissionType) => void;
  onClearAllData: () => void;
  onFabClick: () => void;
  onPickerClose: () => void;
  onPickerAdd: () => void;
  onNotebookDialogCancel: () => void;
  onNotebookDialogConfirm: () => void;
  onConfirmDialogCancel: () => void;
  onConfirmDialogConfirm: () => void;
  onOnboardingSkip: () => void;
  onOnboardingNext: () => void;
}

export function App(props: AppProps) {
  const {
    activeTab,
    fabHidden,
    onTabClick,
    onHeaderLibraryClick,
    onHeaderSettingsClick,
    onNotebookChange,
    onAIConfigChange,
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
    onPickerClose,
    onPickerAdd,
    onNotebookDialogCancel,
    onNotebookDialogConfirm,
    onConfirmDialogCancel,
    onConfirmDialogConfirm,
    onOnboardingSkip,
    onOnboardingNext,
  } = props;

  return (
    <>
      <Header
        onLibraryClick={onHeaderLibraryClick}
        onSettingsClick={onHeaderSettingsClick}
        onNotebookChange={onNotebookChange}
        onAIConfigChange={onAIConfigChange}
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

      <PickerModal onClose={onPickerClose} onAdd={onPickerAdd} />

      <NotebookDialog
        onCancel={onNotebookDialogCancel}
        onConfirm={onNotebookDialogConfirm}
      />

      <ConfirmDialog
        onCancel={onConfirmDialogCancel}
        onConfirm={onConfirmDialogConfirm}
      />

      <Notification />

      <Onboarding onSkip={onOnboardingSkip} onNext={onOnboardingNext} />
    </>
  );
}

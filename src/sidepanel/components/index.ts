/**
 * Components Barrel Export
 *
 * Exports all React-like components for the sidepanel.
 */

// Stateful Components (hooks-based)
export { AddTabStateful } from './AddTabStateful.tsx'
export { ChatTabStateful } from './ChatTabStateful.tsx'
export { HeaderStateful } from './Header.tsx'
export { LibraryTabStateful } from './LibraryTabStateful.tsx'
export { SettingsTabStateful } from './SettingsTabStateful.tsx'
export { NotificationStateful } from './NotificationStateful.tsx'
export { TransformTabStateful } from './TransformTabStateful.tsx'

// Presentational Components
export { SourcesList } from './SourcesList.tsx'
export { ChatMessages } from './ChatMessages.tsx'
export { ChatInput } from './ChatInput.tsx'
export { FuzzyDropdown } from './FuzzyDropdown.tsx'
export type { FuzzyDropdownProps } from './FuzzyDropdown.tsx'

// Provider Profile Components
export { ProviderProfilesStateful } from './ProviderProfilesStateful.tsx'
export { ProfileCard } from './ProfileCard.tsx'
export { ProfileForm } from './ProfileForm.tsx'
export type { ProviderProfilesProps } from './ProviderProfilesStateful.tsx'
export type { ProfileCardProps } from './ProfileCard.tsx'
export type { ProfileFormProps } from './ProfileForm.tsx'

// Dialog Components
export { PickerModal, NotebookDialog, ConfirmDialog } from './Modals.tsx'
export type { NotebookDialogProps, ConfirmDialogProps } from './Modals.tsx'

// Legacy PickerModal (from PickerModal.tsx - may be deprecated)
export { PickerModal as PickerModalLegacy } from './PickerModal.tsx'
export type { PickerModalProps } from './PickerModal.tsx'

// Types
export type { SlashCommand } from './ChatInput.tsx'

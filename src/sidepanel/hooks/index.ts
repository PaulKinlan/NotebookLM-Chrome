/**
 * Custom Hooks for Side Panel Components
 *
 * These hooks encapsulate state management and business logic
 * to reduce coupling with controllers.ts.
 *
 * @module hooks
 */

export { useNotebook } from './useNotebook.ts'
export { usePermissions } from './usePermissions.ts'
export { useSources } from './useSources.ts'
export { useChat } from './useChat.ts'
export { useChatHistory } from './useChatHistory.ts'
export { usePickerModal } from './usePickerModal.ts'
export { useNavigation, type TabName } from './useNavigation.ts'
export { useNotification } from './useNotification.ts'
export { useDialog, type ConfirmDialogState, type NotebookDialogState } from './useDialog.ts'
export { useToolPermissions, type ToolPermissionItem } from './useToolPermissions.ts'
export { useTransform, type TransformType, type TransformResult } from './useTransform.ts'
export { useFuzzyDropdown, type FuzzyDropdownOption, type UseFuzzyDropdownOptions, type UseFuzzyDropdownReturn } from './useFuzzyDropdown.ts'

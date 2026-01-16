/**
 * Sidepanel Hooks
 *
 * Custom Preact hooks for managing sidepanel state and business logic.
 * These hooks replace the controllers.ts imperative pattern.
 */

export { useDialog } from './useDialog'
export { useNotebook } from './useNotebook'
export { useSources } from './useSources'
export { useChat } from './useChat'
export { usePermissions, type PermissionType } from './usePermissions'
export { useToolPermissions } from './useToolPermissions'
export { useTransform } from './useTransform'
export { usePickerModal } from './usePickerModal'
export { useOnboarding } from './useOnboarding'
export { useModelConfigs } from './useModelConfigs'
export { useSuggestedLinks } from './useSuggestedLinks'
export { useOverview } from './useOverview'
export { useFuzzyDropdown, type FuzzyDropdownOption, type UseFuzzyDropdownOptions, type UseFuzzyDropdownReturn } from './useFuzzyDropdown'
export { useProviderProfiles, type AIProfile, type ProfileFormState, type UseProviderProfilesReturn } from './useProviderProfiles'

// NOTE: useNavigation and useNotification have been replaced by signals
// Import from store instead:
// import { activeTab, showNotification } from '../store'

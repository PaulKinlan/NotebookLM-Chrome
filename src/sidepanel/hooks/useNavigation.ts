/**
 * useNavigation Hook
 *
 * Provides tab navigation functionality for components.
 * Allows switching between library, chat, transform, and add tabs.
 */

import { getCurrentComponent } from '../../jsx-runtime/component.ts'

// Valid tab names in the side panel
export type TabName = 'library' | 'chat' | 'transform' | 'add' | 'settings'

/**
 * useNavigation hook
 *
 * Returns a function to switch tabs.
 * Tab state is now managed by the parent App component using useState.
 * Components can accept an onTabChange callback prop to notify parents.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { switchTab } = useNavigation()
 *   return (
 *     <button onClick={() => switchTab('library')}>Go to Library</button>
 *   )
 * }
 * ```
 */
export function useNavigation(): { switchTab: (tabName: TabName) => void } {
  const component = getCurrentComponent()

  // Track that this component uses navigation
  // This enables better debugging and potential future optimizations
  if (component) {
    if (!component.context.has('usesNavigation')) {
      component.context.set('usesNavigation', true)
    }
  }

  const switchTab = (): void => {
    // Tab switching is now handled by parent components via props
    // This hook is kept for type safety and future extensibility
    console.warn('Navigation: Tab switching should be handled via onTabChange callback from parent component')
  }

  return { switchTab }
}

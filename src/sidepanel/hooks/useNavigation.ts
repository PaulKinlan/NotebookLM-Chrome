/**
 * useNavigation Hook
 *
 * Provides tab navigation functionality for components.
 * Allows switching between library, chat, transform, and add tabs.
 */

// Valid tab names in the side panel
export type TabName = 'library' | 'chat' | 'transform' | 'add' | 'settings'

/**
 * useNavigation hook
 *
 * Returns a function to switch tabs.
 * Tab state is now managed by the parent App component using useState.
 * Components should accept an onTabChange callback prop to notify parents.
 *
 * @example
 * ```tsx
 * function MyComponent({ onTabChange }: { onTabChange: (tab: TabName) => void }) {
 *   return (
 *     <button onClick={() => onTabChange('library')}>Go to Library</button>
 *   )
 * }
 * ```
 */
export function useNavigation(): { switchTab: (tabName: TabName) => void } {
  const switchTab = (): void => {
    // Tab switching is now handled by parent components via props
    // This hook is kept for type safety and API consistency
    console.warn('Navigation: Tab switching should be handled via onTabChange callback from parent component')
  }

  return { switchTab }
}

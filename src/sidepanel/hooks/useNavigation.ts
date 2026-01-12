/**
 * useNavigation Hook
 *
 * Provides tab navigation functionality for components.
 * Allows switching between library, chat, transform, and add tabs.
 */

import { getCurrentComponent } from '../../jsx-runtime/component.ts'

// Valid tab names in the side panel
export type TabName = 'library' | 'chat' | 'transform' | 'add' | 'settings'

// Reference to the global switchTab function from controllers.ts
let switchTabFn: ((tabName: TabName) => void) | null = null

/**
 * Initialize the navigation hook with the switchTab function.
 * Called by controllers.ts on initialization.
 */
export function initNavigation(switchTab: (tabName: TabName) => void): void {
  switchTabFn = switchTab
}

/**
 * useNavigation hook
 *
 * Returns a function to switch tabs.
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

  const switchTab = (tabName: TabName): void => {
    if (!switchTabFn) {
      console.warn('Navigation not initialized. Call initNavigation() first.')
      return
    }
    switchTabFn(tabName)
  }

  return { switchTab }
}

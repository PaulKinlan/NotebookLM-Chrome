// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component with business logic handlers

import { render } from 'preact'
import { App } from './App'
import { handlers, initControllers } from './index'
import { initTheme } from './hooks/useTheme.tsx'

// ============================================================================
// Render
// ============================================================================

const appContainer = document.getElementById('app')
if (!appContainer) {
  throw new Error('App container #app not found')
}

// Initialize theme BEFORE rendering to prevent flash of wrong theme
// This is async but we don't await it - the CSS media queries provide
// a reasonable default until storage is read
void initTheme()

// Render with handlers connected
render(
  <App
    activeTab="add"
    fabHidden={true}
    onboardingHidden={true}
    businessHandlers={handlers}
  />,
  appContainer,
)

// Initialize controllers AFTER DOM is rendered
// This ensures event listeners can find their target elements
void initControllers()

console.log('FolioLM sidepanel initialized')

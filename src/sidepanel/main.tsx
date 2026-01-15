// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component with business logic handlers

import { render } from 'preact'
import { App } from './App'
import { initChromeBridge } from './chrome-bridge'
import { initTheme } from './hooks/useTheme.tsx'
import { initBroadcastListeners } from './lib/broadcast'

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

// Render App without businessHandlers (now using hooks internally)
render(
  <App
    initialTab="add"
    fabHidden={true}
    onboardingHidden={false}
  />,
  appContainer,
)

// Initialize Chrome bridge AFTER DOM is rendered
// TODO: Wire up callbacks for context menu integration
initChromeBridge({})

// Initialize BroadcastChannel listeners for cross-context sync
initBroadcastListeners()

console.log('FolioLM sidepanel initialized')

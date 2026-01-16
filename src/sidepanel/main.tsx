// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component with business logic handlers

import { render } from 'preact'
import { App } from './App'
import { initChromeBridge } from './chrome-bridge'
import { initTheme } from './hooks/useTheme.tsx'
import { initBroadcastListeners } from './lib/broadcast'
import { migrateLegacyAISettings, initializeDefaultProfile } from '../lib/model-configs.ts'

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

// Initialize AI profiles (migrate legacy settings and/or create default profile)
// This runs async in the background - the app can render while this completes
void (async () => {
  try {
    // First, try to migrate any legacy AI settings from previous versions
    const migrated = await migrateLegacyAISettings()
    if (migrated) {
      console.log('[Init] Migrated legacy AI settings to new profile format')
    }

    // Then, ensure a default profile exists (creates Chrome Built-in if none)
    const created = await initializeDefaultProfile()
    if (created) {
      console.log('[Init] Created default Chrome Built-in AI profile')
    }
  }
  catch (error) {
    console.error('[Init] Failed to initialize AI profiles:', error)
  }
})()

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

// ============================================================================
// Main Entry Point
// ============================================================================
// Renders App component with business logic handlers

import { App } from './App';
import { handlers } from './index';

// ============================================================================
// Render
// ============================================================================

const appContainer = document.getElementById('app');
if (!appContainer) {
  throw new Error('App container #app not found');
}

// Render with handlers connected
const appElement = App({
  activeTab: 'add',
  fabHidden: true,
  onboardingHidden: true,
  businessHandlers: handlers,
});
appContainer.appendChild(appElement);

console.log('FolioLM sidepanel initialized');

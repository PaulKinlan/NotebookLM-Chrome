/**
 * Browser API Wrapper
 *
 * Centralizes browser extension API access using webextension-polyfill.
 * This provides cross-browser compatibility for Chrome, Firefox, Edge, and Safari.
 *
 * Usage:
 *   import browser from './lib/browser';
 *   await browser.tabs.query({ active: true });
 *
 * For gradual migration, you can also import as 'chrome':
 *   import { chrome } from './lib/browser';
 */

import browserPkg from 'webextension-polyfill';

// Re-export as default
export default browserPkg;

// Re-export as named export for backward compatibility during migration
// This allows: import { chrome } from './lib/browser'
export const chrome = browserPkg;

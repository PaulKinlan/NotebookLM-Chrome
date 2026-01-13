/**
 * Theme module for vanilla JS/DOM (no React)
 * Manages theme state and provides utilities for theme selection UI
 */

import type { ThemePreference, ResolvedTheme } from '../../types/index.ts'
import {
  getThemePreference,
  setThemePreference as saveThemePreference,
  resolveTheme,
  applyTheme,
  onSystemThemeChange,
} from '../../lib/theme.ts'

// Module-level state
let currentPreference: ThemePreference = 'system'
let currentResolvedTheme: ResolvedTheme = 'dark'
let initialized = false
const listeners: Set<(preference: ThemePreference, resolved: ResolvedTheme) => void> = new Set()
const initCallbacks: Set<(preference: ThemePreference) => void> = new Set()

/**
 * Initialize the theme system
 * Call this once when the app starts
 */
export async function initTheme(): Promise<void> {
  if (initialized) return

  currentPreference = await getThemePreference()
  currentResolvedTheme = resolveTheme(currentPreference)

  // Apply theme to DOM
  if (currentPreference === 'system') {
    applyTheme(null) // Let CSS media queries handle it
  }
  else {
    applyTheme(currentPreference)
  }

  // Listen for system theme changes
  onSystemThemeChange((isDark) => {
    if (currentPreference === 'system') {
      currentResolvedTheme = isDark ? 'dark' : 'light'
      notifyListeners()
    }
  })

  initialized = true

  // Notify any components waiting for initialization
  initCallbacks.forEach(callback => callback(currentPreference))
  initCallbacks.clear()
}

/**
 * Check if the theme system is initialized
 */
export function isInitialized(): boolean {
  return initialized
}

/**
 * Register a callback to be called when theme initialization completes
 * If already initialized, the callback is called immediately
 * @returns Cleanup function
 */
export function onThemeInitialized(callback: (preference: ThemePreference) => void): () => void {
  if (initialized) {
    // Already initialized, call immediately
    callback(currentPreference)
    return () => {} // No-op cleanup
  }
  initCallbacks.add(callback)
  return () => initCallbacks.delete(callback)
}

/**
 * Get current theme preference
 */
export function getPreference(): ThemePreference {
  return currentPreference
}

/**
 * Get current resolved theme
 */
export function getResolvedTheme(): ResolvedTheme {
  return currentResolvedTheme
}

/**
 * Set theme preference
 */
export async function setPreference(preference: ThemePreference): Promise<void> {
  currentPreference = preference
  currentResolvedTheme = resolveTheme(preference)

  // Apply to DOM
  if (preference === 'system') {
    applyTheme(null)
  }
  else {
    applyTheme(preference)
  }

  // Save to storage
  await saveThemePreference(preference)

  // Notify listeners
  notifyListeners()
}

/**
 * Subscribe to theme changes
 * @returns Cleanup function
 */
export function onThemeChange(callback: (preference: ThemePreference, resolved: ResolvedTheme) => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function notifyListeners(): void {
  listeners.forEach(listener => listener(currentPreference, currentResolvedTheme))
}

// Note: These exports are kept for API compatibility but are no longer React components
// The SettingsTab will use the module functions directly

/**
 * Hook-like interface for components (but works with vanilla JS)
 */
export function useTheme() {
  return {
    preference: currentPreference,
    resolvedTheme: currentResolvedTheme,
    setPreference,
    isLoading: !initialized,
  }
}

// Placeholder ThemeProvider - no-op for vanilla JS
export function ThemeProvider({ children }: { children: Node }): Node {
  return children
}

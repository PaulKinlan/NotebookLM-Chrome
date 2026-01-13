import type { ThemePreference, ResolvedTheme, UISettings } from '../types/index.ts'
import { storage } from './storage.ts'

const UI_SETTINGS_KEY = 'uiSettings'

const DEFAULT_UI_SETTINGS: UISettings = {
  themePreference: 'system',
}

/**
 * Get UI settings from storage
 */
export async function getUISettings(): Promise<UISettings> {
  const settings = await storage.getSetting<UISettings>(UI_SETTINGS_KEY)
  return settings ?? DEFAULT_UI_SETTINGS
}

/**
 * Save UI settings to storage
 */
export async function saveUISettings(settings: UISettings): Promise<void> {
  await storage.setSetting(UI_SETTINGS_KEY, settings)
}

/**
 * Get the current theme preference
 */
export async function getThemePreference(): Promise<ThemePreference> {
  const settings = await getUISettings()
  return settings.themePreference
}

/**
 * Set the theme preference
 */
export async function setThemePreference(preference: ThemePreference): Promise<void> {
  const settings = await getUISettings()
  settings.themePreference = preference
  await saveUISettings(settings)
}

/**
 * Get the resolved theme based on preference and system settings
 * @param preference - The user's theme preference
 * @returns The resolved theme ('light' or 'dark')
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    // Use matchMedia to check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }
  return preference
}

/**
 * Apply the theme to the document
 * @param theme - The resolved theme to apply
 */
export function applyTheme(theme: ResolvedTheme | null): void {
  const root = document.documentElement

  if (theme === null) {
    // Remove data-theme attribute to use system preference via CSS media queries
    root.removeAttribute('data-theme')
  }
  else {
    root.setAttribute('data-theme', theme)
  }
}

/**
 * Initialize the theme based on stored preference
 * Call this on app startup
 */
export async function initializeTheme(): Promise<ResolvedTheme> {
  const preference = await getThemePreference()

  if (preference === 'system') {
    // For system preference, don't set data-theme - let CSS handle it
    applyTheme(null)
    return resolveTheme('system')
  }
  // For explicit preference, set the data-theme attribute
  applyTheme(preference)
  return preference
}

/**
 * Subscribe to system theme changes
 * @param callback - Function to call when system theme changes
 * @returns Cleanup function to remove the listener
 */
export function onSystemThemeChange(callback: (isDark: boolean) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches)
  }

  mediaQuery.addEventListener('change', handler)

  return () => {
    mediaQuery.removeEventListener('change', handler)
  }
}

/**
 * Onboarding System
 *
 * Provides a first-time user experience to help new users get started.
 */

import { storage } from './storage.ts';

const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';
const ONBOARDING_VERSION = 1; // Increment to re-show onboarding after major updates

export interface OnboardingState {
  complete: boolean;
  version: number;
  completedAt?: number;
}

/**
 * Check if onboarding has been completed
 */
export async function isOnboardingComplete(): Promise<boolean> {
  const state = await storage.getSetting<OnboardingState>(ONBOARDING_COMPLETE_KEY);
  return state?.complete === true && state?.version === ONBOARDING_VERSION;
}

/**
 * Mark onboarding as complete
 */
export async function markOnboardingComplete(): Promise<void> {
  const state: OnboardingState = {
    complete: true,
    version: ONBOARDING_VERSION,
    completedAt: Date.now(),
  };
  await storage.setSetting(ONBOARDING_COMPLETE_KEY, state);
}

/**
 * Reset onboarding (for testing or re-onboarding)
 */
export async function resetOnboarding(): Promise<void> {
  await storage.setSetting(ONBOARDING_COMPLETE_KEY, null);
}

/**
 * Onboarding step definitions
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FolioLM',
    description: 'Collect web content from tabs, bookmarks, and history. Query and transform your sources using AI.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>`,
  },
  {
    id: 'collect',
    title: 'Collect Sources',
    description: 'Add pages from open tabs, bookmarks, or browsing history. Content is extracted and stored locally.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>`,
  },
  {
    id: 'query',
    title: 'Ask Questions',
    description: 'Chat with your sources using AI. Get answers with citations that link back to the original content.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>`,
  },
  {
    id: 'transform',
    title: 'Transform Content',
    description: 'Generate podcasts, quizzes, summaries, and more from your collected sources.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 17 12 22 22 17"></polyline>
      <polyline points="2 12 12 17 22 12"></polyline>
    </svg>`,
  },
  {
    id: 'setup',
    title: 'Set Up AI',
    description: 'Choose an AI provider. Use Chrome Built-in AI for free local processing, or add your own API key.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>`,
  },
];

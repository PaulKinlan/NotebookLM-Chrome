/**
 * Onboarding Configuration
 *
 * Simple flag to control new user behavior.
 * Changes here affect how the empty state behaves.
 */

export type OnboardingMode = 'auto' | 'guided';

/**
 * ONBOARDING_MODE flag:
 *
 * 'auto': Pre-select Chrome Built-in provider in empty state (default)
 * 'guided': Same as auto - onboarding is implicit from application state
 *
 * Both modes rely on the existing empty state UI flow.
 * The difference can be extended here if needed (e.g., different defaults).
 */
export const ONBOARDING_MODE: OnboardingMode = 'auto';

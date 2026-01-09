/**
 * Onboarding Configuration
 *
 * Simple flag to control new user behavior.
 * Changes here affect how the empty state behaves.
 */

export type OnboardingMode = 'auto';

/**
 * ONBOARDING_MODE flag:
 *
 * 'auto': Pre-select Chrome Built-in provider in empty state (default).
 *
 * Additional modes should only be added when they are implemented with
 * distinct behavior. Currently, onboarding is implicit from application
 * state and relies on the existing empty state UI flow.
 */
export const ONBOARDING_MODE: OnboardingMode = 'auto';

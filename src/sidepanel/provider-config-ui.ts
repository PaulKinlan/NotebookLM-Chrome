/**
 * AI Profiles UI Management
 *
 * Unified "AI Profiles" UI that combines Credentials + ModelConfigs into single cards.
 * Data model remains separate (Credential + ModelConfig) but is presented as one profile.
 *
 * Smart credential reuse: When saving a profile, if the API key matches an existing
 * credential, that credential is reused instead of creating a duplicate.
 */

import type { Credential, ModelConfig, UsageTimeRange } from '../types/index.ts';
import {
  getCredentials,
  createCredential,
  findCredentialByApiKey,
} from '../lib/credentials.ts';
import {
  getModelConfigs,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig,
  setDefaultModelConfig,
  initializeDefaultProfile,
  NO_API_KEY_PLACEHOLDER,
} from '../lib/model-configs.ts';
import type { ProviderConfig, ModelOption, SelectableModel } from '../lib/provider-registry.ts';
import {
  getAllProviders,
  getProviderConfigById,
  fetchProviderSelectableModels,
} from '../lib/provider-registry.ts';
import { FuzzyDropdown, providersToDropdownOptions } from './dropdown.ts';
import { testConnectionWithConfig } from '../lib/ai.ts';
import {
  getUsageStats,
  getUsageDataPoints,
  formatTokenCount,
  formatCost,
  getTimeRangeLabel,
} from '../lib/usage.ts';

/**
 * AI Profile - combined view model (not persisted)
 * Merges ModelConfig + Credential + Provider for UI presentation
 */
interface AIProfile {
  modelConfig: ModelConfig;
  credential: Credential;
  provider: ProviderConfig;
}

// Custom event for notifying when AI profiles change
export const AI_PROFILES_CHANGED_EVENT = 'ai-profiles-changed';

/**
 * Dispatch event to notify that AI profiles have changed
 */
function notifyProfilesChanged(): void {
  window.dispatchEvent(new CustomEvent(AI_PROFILES_CHANGED_EVENT));
}

// State
let profiles: AIProfile[] = [];
let editingProfileId: string | null = null;
let isNewProfile = false;

// Model cache keyed by provider ID and API key hash
// Format: "providerId:apiKeyHash" or "providerId:no-auth" for providers that don't require API key
const modelsCache = new Map<string, SelectableModel[]>();
let currentCacheKey: string | null = null;
let selectedProviderIdForNew: string | null = null;
let isFetchingModels: boolean = false;

// Provider dropdown instances
let providerDropdowns = new Map<HTMLElement, FuzzyDropdown>();

/**
 * Generate a simple hash for an API key (not for security, just for cache key uniqueness)
 */
function hashApiKey(apiKey: string): string {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Generate a cache key for models based on provider ID and API key
 */
function generateCacheKey(providerId: string, apiKey?: string): string {
  // For providers that don't require API key or when no API key is provided
  if (!apiKey) {
    return `${providerId}:no-auth`;
  }
  return `${providerId}:${hashApiKey(apiKey)}`;
}

/**
 * Get cached models for a provider/API key combination
 */
function getCachedModels(providerId: string, apiKey?: string): SelectableModel[] {
  const key = generateCacheKey(providerId, apiKey);
  return modelsCache.get(key) || [];
}

/**
 * Cache models for a provider/API key combination
 */
function setCachedModels(providerId: string, models: SelectableModel[], apiKey?: string): void {
  const key = generateCacheKey(providerId, apiKey);
  modelsCache.set(key, models);
  currentCacheKey = key;
}

// Model dropdown state
let dropdownOpen = false;
let highlightedIndex = -1;
let currentDropdownMenu: HTMLElement | null = null;
let currentModelInput: HTMLInputElement | null = null;
let currentModelDropdown: HTMLElement | null = null;

// Global click handler to close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (dropdownOpen && currentModelDropdown && !currentModelDropdown.contains(e.target as Node)) {
    toggleModelDropdown(false);
  }
});

// Elements
let elements: {
  profilesList: HTMLElement;
  addProfileBtn: HTMLButtonElement;
  notebookSettingsGroup: HTMLElement;
  notebookModelSelect: HTMLSelectElement;
};

/**
 * Initialize configuration UI
 */
export async function initProviderConfigUI(): Promise<void> {
  console.log('[ConfigUI] Initializing AI Profiles UI');

  const profilesListEl = document.getElementById('profiles-list');
  const addProfileBtnEl = document.getElementById('add-profile-btn');
  const notebookSettingsGroupEl = document.getElementById('notebook-settings-group');
  const notebookModelSelectEl = document.getElementById('notebook-model-select');

  if (!profilesListEl || !addProfileBtnEl || !notebookSettingsGroupEl || !notebookModelSelectEl) {
    console.error('[ConfigUI] Required elements not found');
    return;
  }

  elements = {
    profilesList: profilesListEl,
    addProfileBtn: addProfileBtnEl as HTMLButtonElement,
    notebookSettingsGroup: notebookSettingsGroupEl,
    notebookModelSelect: notebookModelSelectEl as HTMLSelectElement,
  };

  elements.addProfileBtn.addEventListener('click', handleAddProfile);

  // Initialize default Chrome Built-in profile if no profiles exist
  await initializeDefaultProfile();

  await loadData();

  console.log('[ConfigUI] Initialization complete');
}

/**
 * Load and merge credentials + model configs into profiles
 */
async function loadData(): Promise<void> {
  try {
    const credentials = await getCredentials();
    const modelConfigs = await getModelConfigs();

    // Merge into profiles array
    profiles = modelConfigs
      .map((config) => {
        const credential = credentials.find((c) => c.id === config.credentialId);
        const provider = getProviderConfigById(config.providerId);
        if (!credential || !provider) {
          console.warn(`[ConfigUI] Skipping profile ${config.id}: missing credential or provider`);
          return null;
        }
        return { modelConfig: config, credential, provider };
      })
      .filter((p): p is AIProfile => p !== null);

    // Sort: default first, then by date
    profiles.sort((a, b) => {
      if (a.modelConfig.isDefault && !b.modelConfig.isDefault) return -1;
      if (!a.modelConfig.isDefault && b.modelConfig.isDefault) return 1;
      return b.modelConfig.updatedAt - a.modelConfig.updatedAt;
    });

    renderProfilesList();
    updateNotebookModelDropdown();

    // Hide add button when showing new profile form (no profiles exist)
    if (profiles.length === 0) {
      elements.addProfileBtn.style.display = 'none';
    } else {
      elements.addProfileBtn.style.display = '';
    }
  } catch (error) {
    console.error('Failed to load data:', error);
    showNotification('Failed to load configurations', 'error');
  }
}

/**
 * Render the list of profile cards
 */
function renderProfilesList(): void {
  const container = elements.profilesList;

  container.innerHTML = '';

  // If adding new profile, render form first
  if (isNewProfile && editingProfileId === null) {
    const formCard = createProfileFormCard();
    container.appendChild(formCard);
    return;
  }

  // Empty state - show message with option to create a new profile
  if (profiles.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'ai-profiles-empty-state';

    const message = document.createElement('p');
    message.textContent = 'No AI profiles have been created yet.';
    emptyState.appendChild(message);

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = 'Add profile';
    addButton.addEventListener('click', () => {
      isNewProfile = true;
      selectedProviderIdForNew = 'chrome'; // Default to Chrome built-in provider for new users
      renderProfilesList();
    });
    emptyState.appendChild(addButton);

    container.appendChild(emptyState);
    return;
  }

  // Render profiles
  profiles.forEach((profile) => {
    const card = createProfileCard(profile);
    container.appendChild(card);
  });
}

/**
 * Create a profile card (view or edit mode)
 */
function createProfileCard(profile: AIProfile): HTMLElement {
  const isEditing = editingProfileId === profile.modelConfig.id;
  const card = document.createElement('div');
  card.className = `profile-card${profile.modelConfig.isDefault ? ' default-profile' : ''}${isEditing ? ' editing' : ''}`;

  if (isEditing) {
    card.innerHTML = renderProfileEditForm(profile);
    setupProfileFormListeners(card, profile.modelConfig.id, false);
  } else {
    const { modelConfig, credential, provider } = profile;
    const showApiKey = provider.features.requiresApiKey !== false && credential.apiKey !== NO_API_KEY_PLACEHOLDER;

    card.innerHTML = `
      <div class="profile-header" data-profile-id="${modelConfig.id}">
        <div class="profile-name-row">
          <div class="profile-name">
            ${escapeHtml(modelConfig.name)}
            ${modelConfig.isDefault ? '<span class="default-badge">Default</span>' : ''}
          </div>
        </div>
        <div class="profile-details">
          <span class="profile-provider">${escapeHtml(provider.displayName)}</span>
          <span class="profile-model">${escapeHtml(modelConfig.model)}</span>
          ${showApiKey ? `<span class="profile-api-key">${maskApiKey(credential.apiKey)}</span>` : ''}
          ${modelConfig.temperature !== undefined ? `<span class="profile-temp">Temp: ${modelConfig.temperature}</span>` : ''}
          ${modelConfig.maxTokens ? `<span class="profile-max-tokens">Max: ${modelConfig.maxTokens}</span>` : ''}
        </div>
      </div>

      <div class="profile-actions">
        <button class="profile-btn" data-action="edit">Edit</button>
        <button class="profile-btn" ${modelConfig.isDefault ? 'disabled' : ''} data-action="set-default">
          ${modelConfig.isDefault ? 'Default' : 'Set Default'}
        </button>
        <button class="profile-btn stats" data-action="stats" title="View usage stats">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="12" width="4" height="9"></rect>
            <rect x="10" y="8" width="4" height="13"></rect>
            <rect x="17" y="4" width="4" height="17"></rect>
          </svg>
        </button>
        <button class="profile-btn delete" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelectorAll('.profile-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (e.target as HTMLButtonElement).dataset.action ?? (e.target as SVGElement).closest('button')?.dataset.action;
        if (action === 'edit') handleEditProfile(modelConfig.id);
        else if (action === 'set-default') handleSetDefaultProfile(modelConfig.id);
        else if (action === 'stats') handleShowUsageStats(modelConfig.id, modelConfig.name);
        else if (action === 'delete') handleDeleteProfile(modelConfig.id);
      });
    });
  }

  return card;
}

/**
 * Create a new profile form card
 */
function createProfileFormCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'profile-card editing new-profile';
  card.innerHTML = renderProfileEditForm(null);
  setupProfileFormListeners(card, null, true);
  return card;
}

/**
 * Check if provider supports model fetching
 */
function providerSupportsFetching(providerId: string): boolean {
  const provider = getProviderConfigById(providerId);
  return provider?.features.supportsModelFetching ?? false;
}

/**
 * Check if provider requires API key for model fetching
 */
function providerRequiresApiKeyForFetching(providerId: string): boolean {
  const provider = getProviderConfigById(providerId);
  return provider?.features.requiresApiKeyForFetching ?? false;
}

/**
 * Check if provider requires API key at all
 */
function providerRequiresApiKey(providerId: string): boolean {
  const provider = getProviderConfigById(providerId);
  return provider?.features.requiresApiKey ?? true;
}

/**
 * Simple fuzzy match scoring function
 * Returns higher score for better matches
 */
function fuzzyMatchScore(text: string, query: string): number {
  if (!query) return 0;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match at start - highest priority
  if (lowerText.startsWith(lowerQuery)) {
    return 100;
  }

  // Exact match anywhere
  if (lowerText.includes(lowerQuery)) {
    return 50;
  }

  // Character sequence match
  let queryIndex = 0;
  let score = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }

  // If we matched all characters in order
  if (queryIndex === lowerQuery.length) {
    return Math.min(score, 49);
  }

  return -1; // No match
}

/**
 * Render profile edit form
 */
function renderProfileEditForm(profile: AIProfile | null): string {
  const isNew = !profile;

  const currentProviderId = profile ? profile.provider.id : (selectedProviderIdForNew || '');
  const requiresApiKey = providerRequiresApiKey(currentProviderId);
  const apiKeyValue = profile?.credential.apiKey === NO_API_KEY_PLACEHOLDER ? '' : (profile?.credential.apiKey || '');

  return `
    <div class="profile-form">
      <div class="form-header">
        <h4>${isNew ? 'New AI Profile' : 'Edit AI Profile'}</h4>
      </div>

      <label class="input-label">Profile Name</label>
      <input type="text" class="form-input profile-name-input"
             placeholder="e.g., GPT-4 Turbo (Work)"
             value="${profile ? escapeHtml(profile.modelConfig.name) : ''}" />

      <label class="input-label">Provider</label>
      <div class="profile-provider-dropdown"></div>
      <input type="hidden" class="profile-provider-value" value="${currentProviderId}" />

      <div class="api-key-section" ${!requiresApiKey ? 'style="display: none;"' : ''}>
        <label class="input-label">API Key</label>
        <div class="password-input-wrapper">
          <input type="password" class="form-input profile-api-key-input"
                 placeholder="Required for most providers"
                 value="${escapeHtml(apiKeyValue)}" />
          <button type="button" class="password-toggle" aria-label="Show API key" title="Show API key">
            <svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg class="eye-off-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            </svg>
          </button>
        </div>
      </div>

      <label class="input-label">Model</label>
      <div class="model-dropdown">
        <input type="text" class="form-input profile-model-input"
               placeholder="Type to search models..."
               autocomplete="off"
               value="${profile ? escapeHtml(profile.modelConfig.model) : ''}" />
        <button type="button" class="dropdown-toggle" aria-label="Toggle model list">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline class="dropdown-chevron-down" points="6 9 12 15 18 9"></polyline>
            <polyline class="dropdown-chevron-up" points="6 15 12 9 18 15"></polyline>
          </svg>
        </button>
        <button type="button" class="model-refresh-btn" aria-label="Refresh models" title="Refresh model list">
          <svg class="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
          </svg>
          <svg class="refresh-spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          <svg class="refresh-success-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <svg class="refresh-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </button>
        <div class="dropdown-menu model-dropdown-menu" hidden style="position: absolute; z-index: 1000;"></div>
      </div>

      <details class="advanced-settings">
        <summary>Advanced Settings</summary>
        <label class="input-label">Temperature</label>
        <div class="range-input-row">
          <input type="range" class="form-range profile-temperature-input" min="0" max="2" step="0.1"
                 value="${profile?.modelConfig.temperature ?? 0.7}" />
          <span class="profile-temperature-value">${(profile?.modelConfig.temperature ?? 0.7).toFixed(1)}</span>
        </div>
        <p class="setting-hint">Controls randomness. Lower values are more focused, higher values are more creative.</p>

        <label class="input-label">Max Tokens</label>
        <input type="number" class="form-input profile-max-tokens-input" min="100" max="128000" step="100"
               placeholder="Default" value="${profile?.modelConfig.maxTokens || ''}" />
        <p class="setting-hint">Maximum length of the response. Leave empty for model default.</p>

        <label class="input-label">Context Compression</label>
        <select class="form-select profile-compression-mode-input">
          <option value="two-pass" ${(!profile?.modelConfig.compressionMode || profile?.modelConfig.compressionMode === 'two-pass') ? 'selected' : ''}>
            Smart (Two-Pass) - LLM ranks sources
          </option>
          <option value="single-pass" ${(profile?.modelConfig.compressionMode === 'single-pass') ? 'selected' : ''}>
            Fast (Single-Pass) - Fixed compression
          </option>
        </select>
        <p class="setting-hint">Smart mode uses AI to intelligently select relevant sources (slower). Fast mode uses a fixed strategy for quicker responses.</p>
      </details>

      <div class="form-actions">
        <button class="btn btn-outline profile-cancel-btn">Cancel</button>
        <button class="btn btn-outline profile-test-btn" title="Test connection with current settings">
          <svg class="test-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <svg class="testing-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          <svg class="success-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span class="test-text">Test</span>
        </button>
        <button class="btn btn-primary profile-save-btn">Save Profile</button>
      </div>
      <div class="test-status" style="display: none;"></div>
    </div>
  `;
}

/**
 * Render an empty state message in the model dropdown
 */
function renderEmptyDropdownMessage(dropdownMenu: HTMLElement, message: string, isLoading = false): void {
  dropdownMenu.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'dropdown-empty';
  if (isLoading) {
    empty.classList.add('dropdown-empty-loading');
    // Add a simple loading indicator
    empty.innerHTML = `
      <span class="loading-spinner"></span>
      <span>${escapeHtml(message)}</span>
    `;
  } else {
    empty.textContent = message;
  }
  dropdownMenu.appendChild(empty);
}

/**
 * Populate model dropdown with fuzzy-matched models
 */
function populateModelDropdown(
  dropdownMenu: HTMLElement,
  query: string,
  providerId: string,
  currentValue: string
): void {
  const providerConfig = getProviderConfigById(providerId);
  if (!providerConfig) {
    renderEmptyDropdownMessage(dropdownMenu, 'Provider not found');
    return;
  }

  const models = providerConfig.commonModels || [];

  // Get API key from the form to check cache
  const card = dropdownMenu.closest('.profile-card') as HTMLElement;
  const apiKeyInput = card?.querySelector('.profile-api-key-input') as HTMLInputElement;
  const apiKey = apiKeyInput?.value.trim();

  // Get cached models for this provider/API key combination
  const cachedModels = getCachedModels(providerId, apiKey);
  const cacheKey = generateCacheKey(providerId, apiKey);

  // Show loading state if currently fetching for this exact provider/API key combo
  if (isFetchingModels && currentCacheKey === cacheKey) {
    renderEmptyDropdownMessage(dropdownMenu, 'Loading models...', true);
    return;
  }

  // Check if provider supports fetching
  const supportsFetching = providerSupportsFetching(providerId);
  const requiresApiKey = providerRequiresApiKeyForFetching(providerId);
  const hasApiKey = apiKey?.length > 0;

  // Show message if fetching is supported but not available
  if (supportsFetching && requiresApiKey && !hasApiKey && cachedModels.length === 0) {
    renderEmptyDropdownMessage(dropdownMenu, 'Enter API key to fetch models');
    return;
  }

  // Combine common models and cached models
  const allOptions: { id: string; name: string; source: string }[] = [
    ...models.map((m: ModelOption) => ({ id: m.value, name: m.label, source: 'common' })),
    ...cachedModels.map((m: SelectableModel) => ({ id: m.id, name: m.name, source: 'fetched' })),
  ];

  // If no models available and provider doesn't support fetching
  if (allOptions.length === 0 && !supportsFetching) {
    renderEmptyDropdownMessage(dropdownMenu, 'Enter model ID manually');
    return;
  }

  let scoredModels: { option: { id: string; name: string }; score: number }[];

  if (!query) {
    // When query is empty, show all models (sorted by name)
    scoredModels = allOptions
      .map((option) => ({ option, score: 0 }))
      .sort((a, b) => a.option.name.localeCompare(b.option.name));
  } else {
    // Score and sort models based on fuzzy match
    scoredModels = allOptions.map((option) => {
      const labelScore = fuzzyMatchScore(option.name, query);
      const valueScore = fuzzyMatchScore(option.id, query);
      const score = Math.max(labelScore, valueScore);
      return { option, score };
    });

    // Sort by score (highest first), with no matches at the end
    scoredModels.sort((a, b) => {
      if (a.score === -1 && b.score === -1) return 0;
      if (a.score === -1) return 1;
      if (b.score === -1) return -1;
      return b.score - a.score;
    });
  }

  // Limit to 10 results
  const filtered = scoredModels.slice(0, 10);

  dropdownMenu.innerHTML = '';

  // Reset highlight when repopulating
  highlightedIndex = -1;

  for (const { option, score } of filtered) {
    const item = document.createElement('div');
    item.className = 'dropdown-item';

    // Store score for keyboard navigation
    item.dataset.score = score.toString();
    item.dataset.value = option.id;

    // Dim unmatched items slightly (only when there's a query)
    if (score === -1 && query) {
      item.style.opacity = '0.5';
    }

    // Mark currently selected value
    if (option.id === currentValue) {
      item.classList.add('selected');
    }

    // Add ARIA role for accessibility
    item.setAttribute('role', 'option');

    // Create label and ID spans with textContent to prevent XSS
    const labelSpan = document.createElement('span');
    labelSpan.className = 'model-label';
    labelSpan.textContent = option.name;

    const idSpan = document.createElement('span');
    idSpan.className = 'model-id';
    idSpan.textContent = option.id;

    item.appendChild(labelSpan);
    if (option.id !== option.name) {
      item.appendChild(idSpan);
    }

    item.addEventListener('click', () => {
      if (currentModelInput) {
        currentModelInput.value = option.id;
        // Auto-populate profile name if empty
        const nameInput = currentModelDropdown?.querySelector('.profile-name-input') as HTMLInputElement;
        if (nameInput && !nameInput.value) {
          nameInput.value = option.name;
        }
      }
      toggleModelDropdown(false);
    });

    dropdownMenu.appendChild(item);
  }
}

/**
 * Set highlighted index and update visual state
 */
function setHighlightedIndex(index: number, items: HTMLElement[]): void {
  // Remove previous highlight
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].classList.remove('highlighted');
  }

  highlightedIndex = index;

  // Add new highlight
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].classList.add('highlighted');
    items[highlightedIndex].scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Get dropdown items as HTMLElement array
 */
function getDropdownItems(): HTMLElement[] {
  if (!currentDropdownMenu) return [];
  return Array.from(
    currentDropdownMenu.querySelectorAll('.dropdown-item')
  ).filter((item): item is HTMLElement => item instanceof HTMLElement);
}

/**
 * Toggle model dropdown open/closed
 */
function toggleModelDropdown(show?: boolean, providerId?: string): void {
  dropdownOpen = show !== undefined ? show : !dropdownOpen;

  if (currentDropdownMenu) {
    currentDropdownMenu.hidden = !dropdownOpen;
  }

  if (currentModelInput) {
    currentModelInput.setAttribute('aria-expanded', dropdownOpen.toString());
  }

  if (dropdownOpen && currentDropdownMenu && currentModelInput) {
    // Populate dropdown when opening
    // If providerId not provided, try to get it from the form
    if (!providerId && currentModelDropdown) {
      const card = currentModelDropdown.closest('.profile-card') as HTMLElement;
      const providerValueInput = card?.querySelector('.profile-provider-value') as HTMLInputElement;
      providerId = providerValueInput?.value || '';
    }
    populateModelDropdown(currentDropdownMenu, currentModelInput.value, providerId || '', currentModelInput.value);
  } else if (!dropdownOpen) {
    highlightedIndex = -1;
  }
}

/**
 * Handle model dropdown keyboard navigation
 */
function handleModelDropdownKeydown(e: KeyboardEvent): void {
  const items = getDropdownItems();

  if (items.length === 0 && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (!dropdownOpen) {
        toggleModelDropdown(true);
        const newItems = getDropdownItems();
        setHighlightedIndex(0, newItems);
      } else {
        const newIndex = highlightedIndex < items.length - 1 ? highlightedIndex + 1 : 0;
        setHighlightedIndex(newIndex, items);
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (!dropdownOpen) {
        toggleModelDropdown(true);
        const newItems = getDropdownItems();
        setHighlightedIndex(newItems.length - 1, newItems);
      } else {
        const newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : items.length - 1;
        setHighlightedIndex(newIndex, items);
      }
      break;

    case 'Enter':
      e.preventDefault();

      // If something is highlighted, select it
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        const selectedItem = items[highlightedIndex];
        const modelValue = selectedItem.dataset.value;
        if (modelValue && currentModelInput) {
          currentModelInput.value = modelValue;
          // Auto-populate profile name if empty
          const nameInput = currentModelDropdown?.querySelector('.profile-name-input') as HTMLInputElement;
          if (nameInput && !nameInput.value) {
            const label = selectedItem.querySelector('.model-label')?.textContent || modelValue;
            nameInput.value = label;
          }
        }
        toggleModelDropdown(false);
        return;
      }

      // If dropdown is open, check if first item is a match before auto-selecting
      if (dropdownOpen && items.length > 0) {
        const firstItem = items[0];
        const firstScore = firstItem.dataset.score ? parseInt(firstItem.dataset.score, 10) : -1;

        // Only auto-select if it's an actual match (score >= 0)
        if (firstScore >= 0) {
          const modelValue = firstItem.dataset.value;
          if (modelValue && currentModelInput) {
            currentModelInput.value = modelValue;
            // Auto-populate profile name if empty
            const nameInput = currentModelDropdown?.querySelector('.profile-name-input') as HTMLInputElement;
            if (nameInput && !nameInput.value) {
              const label = firstItem.querySelector('.model-label')?.textContent || modelValue;
              nameInput.value = label;
            }
          }
        }
        // Always close dropdown on Enter
        toggleModelDropdown(false);
      }
      break;

    case 'Escape':
      e.preventDefault();
      toggleModelDropdown(false);
      break;
  }
}

/**
 * Handle test connection button click
 */
async function handleTestConnection(card: HTMLElement): Promise<void> {
  const testBtn = card.querySelector('.profile-test-btn') as HTMLButtonElement;
  const testStatus = card.querySelector('.test-status') as HTMLDivElement;
  const providerValueInput = card.querySelector('.profile-provider-value') as HTMLInputElement;
  const apiKeyInput = card.querySelector('.profile-api-key-input') as HTMLInputElement;
  const modelInput = card.querySelector('.profile-model-input') as HTMLInputElement;

  if (!testBtn || !providerValueInput || !apiKeyInput || !modelInput) {
    return;
  }

  const providerType = providerValueInput.value;
  const requiresKey = providerRequiresApiKey(providerType);
  const apiKey = requiresKey ? apiKeyInput.value.trim() : NO_API_KEY_PLACEHOLDER;
  const modelId = modelInput.value.trim();

  // Reset UI to testing state
  testBtn.disabled = true;
  setTestButtonState(testBtn, 'testing');
  testStatus.style.display = 'none';

  // Check if provider is selected
  if (!providerType) {
    showTestResult(testBtn, testStatus, 'error', 'Please select a provider');
    testBtn.disabled = false;
    return;
  }

  // Check if API key is provided (only for providers that require it)
  if (requiresKey && !apiKey) {
    showTestResult(testBtn, testStatus, 'error', 'Please enter an API key');
    testBtn.disabled = false;
    return;
  }

  // Check if model is provided
  if (!modelId) {
    showTestResult(testBtn, testStatus, 'error', 'Please enter a model ID');
    testBtn.disabled = false;
    return;
  }

  // Test connection with the form's actual values
  try {
    const result = await testConnectionWithConfig(providerType, apiKey, modelId);

    if (result.success) {
      showTestResult(testBtn, testStatus, 'success', 'Connection successful!');
    } else {
      showTestResult(testBtn, testStatus, 'error', `Failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    showTestResult(testBtn, testStatus, 'error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    testBtn.disabled = false;
  }
}

/**
 * Set the test button visual state
 */
function setTestButtonState(button: HTMLButtonElement, state: 'idle' | 'testing' | 'success' | 'error'): void {
  const testIcon = button.querySelector('.test-icon') as SVGElement;
  const testingIcon = button.querySelector('.testing-icon') as SVGElement;
  const successIcon = button.querySelector('.success-icon') as SVGElement;
  const errorIcon = button.querySelector('.error-icon') as SVGElement;
  const testText = button.querySelector('.test-text') as HTMLElement;

  // Hide all icons first
  testIcon.style.display = 'none';
  testingIcon?.style.setProperty('display', 'none');
  successIcon?.style.setProperty('display', 'none');
  errorIcon?.style.setProperty('display', 'none');

  switch (state) {
    case 'idle':
      testIcon.style.display = 'block';
      testText.textContent = 'Test';
      button.classList.remove('btn-success', 'btn-error');
      break;
    case 'testing':
      testingIcon?.style.setProperty('display', 'block');
      testText.textContent = 'Testing...';
      button.classList.remove('btn-success', 'btn-error');
      break;
    case 'success':
      successIcon?.style.setProperty('display', 'block');
      testText.textContent = 'Success';
      button.classList.add('btn-success');
      button.classList.remove('btn-error');
      // Reset to idle after 3 seconds
      setTimeout(() => setTestButtonState(button, 'idle'), 3000);
      break;
    case 'error':
      errorIcon?.style.setProperty('display', 'block');
      testText.textContent = 'Failed';
      button.classList.add('btn-error');
      button.classList.remove('btn-success');
      // Reset to idle after 5 seconds
      setTimeout(() => setTestButtonState(button, 'idle'), 5000);
      break;
  }
}

/**
 * Show test result message
 */
function showTestResult(
  button: HTMLButtonElement,
  statusEl: HTMLDivElement,
  state: 'success' | 'error',
  message: string
): void {
  setTestButtonState(button, state);
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  statusEl.className = `test-status test-${state}`;
}

/**
 * Setup event listeners for profile form
 */
function setupProfileFormListeners(card: HTMLElement, profileId: string | null, isNew: boolean): void {
  const providerDropdownContainer = card.querySelector('.profile-provider-dropdown') as HTMLElement;
  const providerValueInput = card.querySelector('.profile-provider-value') as HTMLInputElement;
  const modelInput = card.querySelector('.profile-model-input') as HTMLInputElement;
  const dropdownToggle = card.querySelector('.dropdown-toggle') as HTMLButtonElement;
  const dropdownMenu = card.querySelector('.model-dropdown-menu') as HTMLElement;
  const apiKeyInput = card.querySelector('.profile-api-key-input') as HTMLInputElement;
  const passwordToggle = card.querySelector('.password-toggle') as HTMLButtonElement;
  const testBtn = card.querySelector('.profile-test-btn') as HTMLButtonElement;
  const temperatureInput = card.querySelector('.profile-temperature-input') as HTMLInputElement;
  const temperatureValue = card.querySelector('.profile-temperature-value') as HTMLSpanElement;
  const cancelBtn = card.querySelector('.profile-cancel-btn') as HTMLButtonElement;
  const saveBtn = card.querySelector('.profile-save-btn') as HTMLButtonElement;

  // Password visibility toggle
  if (passwordToggle && apiKeyInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      passwordToggle.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
      passwordToggle.title = isPassword ? 'Hide API key' : 'Show API key';
      (passwordToggle.querySelector('.eye-icon') as SVGElement).style.display = isPassword ? 'none' : 'block';
      (passwordToggle.querySelector('.eye-off-icon') as SVGElement).style.display = isPassword ? 'block' : 'none';
    });
  }

  // Test connection button
  if (testBtn) {
    testBtn.addEventListener('click', async (e) => {
      // Stop propagation to prevent interference with dropdown's document click handler
      e.stopPropagation();
      await handleTestConnection(card);
    });
  }

  // Initialize provider fuzzy dropdown
  if (providerDropdownContainer && providerValueInput) {
    const allProviders = getAllProviders();
    const initialProviderId = providerValueInput.value;

    const providerDropdown = new FuzzyDropdown({
      container: providerDropdownContainer,
      currentValue: allProviders.find(p => p.id === initialProviderId)?.displayName || '',
      placeholder: 'Search providers...',
      allowCustom: false,
      onSelect: (option) => {
        providerValueInput.value = option.id;
        selectedProviderIdForNew = option.id;

        // Show/hide API key section based on provider requirements
        const apiKeySection = card.querySelector('.api-key-section') as HTMLElement;
        const requiresKey = providerRequiresApiKey(option.id);
        if (apiKeySection) {
          apiKeySection.style.display = requiresKey ? '' : 'none';
        }

        // Get the model input element
        const modelInput = card.querySelector('.profile-model-input') as HTMLInputElement;

        // For Chrome Built-in, auto-populate the model since it only has one
        const provider = getProviderConfigById(option.id);
        if (provider && !requiresKey && provider.defaultModel) {
          // Auto-populate with the default model for providers that don't require API key
          if (modelInput) {
            modelInput.value = provider.defaultModel;
          }
          // Also auto-populate the profile name if empty
          const nameInput = card.querySelector('.profile-name-input') as HTMLInputElement;
          if (nameInput && !nameInput.value) {
            nameInput.value = provider.displayName;
          }
        } else if (modelInput) {
          // Clear model input value when provider changes to one that requires API key
          modelInput.value = '';
        }

        if (isNew && requiresKey) {
          const apiKey = apiKeyInput?.value.trim();
          // Auto-fetch if provider supports it and has API key (or doesn't require one)
          const supportsFetching = providerSupportsFetching(option.id);
          const requiresApiKeyForFetch = providerRequiresApiKeyForFetching(option.id);

          if (supportsFetching && (!requiresApiKeyForFetch || apiKey)) {
            fetchModelsForCard(card, option.id, apiKey || undefined);
          }
        }

        // Refresh the model dropdown if it's open to show the new provider's models
        const dropdownMenu = card.querySelector('.model-dropdown-menu') as HTMLElement;
        if (dropdownMenu && !dropdownMenu.hidden) {
          const modelInputForDropdown = card.querySelector('.profile-model-input') as HTMLInputElement;
          const apiKeyForDropdown = apiKeyInput?.value.trim();
          populateModelDropdown(dropdownMenu, modelInputForDropdown?.value || '', option.id, apiKeyForDropdown || '');
        }
      },
      onToggle: (open) => {
        // Set options when dropdown opens to show all providers
        if (open) {
          providerDropdown.setOptions(providersToDropdownOptions(allProviders));
        }
      },
    });

    // Set initial options
    providerDropdown.setOptions(providersToDropdownOptions(allProviders));
    providerDropdowns.set(card, providerDropdown);
  }

  // API key input - auto-fetch models when entered (for providers that require it)
  apiKeyInput?.addEventListener('blur', async () => {
    if (isNew && providerValueInput) {
      const providerId = providerValueInput.value;
      const apiKey = apiKeyInput.value.trim();

      if (providerId && apiKey && providerSupportsFetching(providerId)) {
        const requiresApiKey = providerRequiresApiKeyForFetching(providerId);
        const cacheKey = generateCacheKey(providerId, apiKey);
        // Only fetch if we don't have cached models for this provider/API key combo
        if (requiresApiKey && !modelsCache.has(cacheKey)) {
          await fetchModelsForCard(card, providerId, apiKey);
        }
      }
    }
  });

  // Model dropdown - fuzzy search functionality
  if (modelInput && dropdownToggle && dropdownMenu) {
    const modelDropdown = card.querySelector('.model-dropdown') as HTMLElement;

    // Set up current dropdown references
    const setupDropdownRefs = () => {
      currentDropdownMenu = dropdownMenu;
      currentModelInput = modelInput;
      currentModelDropdown = modelDropdown;
    };

    // Focus handler - open dropdown
    modelInput.addEventListener('focus', () => {
      setupDropdownRefs();
      if (!dropdownOpen) {
        toggleModelDropdown(true);
      }
    });

    // Toggle button handler
    dropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setupDropdownRefs();
      toggleModelDropdown();
      // Focus input so arrow keys work for accessibility
      modelInput.focus();
    });

    // Refresh button handler
    const refreshBtn = card.querySelector('.model-refresh-btn') as HTMLButtonElement;
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Get provider ID from the FuzzyDropdown instance (current selection) as primary source,
        // falling back to the hidden input for backwards compatibility
        let providerId = providerValueInput?.value || '';
        const providerDropdown = providerDropdowns.get(card);
        if (providerDropdown) {
          const dropdownValue = providerDropdown.value;
          if (dropdownValue) {
            providerId = dropdownValue;
            // Sync the hidden input with the dropdown's current value
            if (providerValueInput) {
              providerValueInput.value = dropdownValue;
            }
          }
        }

        const apiKey = apiKeyInput?.value.trim() || '';

        if (!providerId) {
          showNotification('Please select a provider first', 'error');
          return;
        }

        if (!apiKey && providerRequiresApiKeyForFetching(providerId)) {
          showNotification('Please enter an API key first', 'error');
          return;
        }

        // Helper to show a specific icon state
        const showIcon = (iconClass: string) => {
          const icons = refreshBtn.querySelectorAll('svg');
          icons.forEach(icon => icon.style.display = 'none');
          const targetIcon = refreshBtn.querySelector(iconClass) as SVGElement;
          if (targetIcon) targetIcon.style.display = 'block';
        };

        // Show loading state
        refreshBtn.disabled = true;
        refreshBtn.classList.remove('refresh-success', 'refresh-error');
        refreshBtn.classList.add('refreshing');
        showIcon('.refresh-spinner-icon');

        const success = await fetchModelsForCard(card, providerId, apiKey || undefined);

        // If dropdown is open, refresh it
        if (dropdownMenu && !dropdownMenu.hidden) {
          populateModelDropdown(dropdownMenu, modelInput.value, providerId, modelInput.value);
        }

        refreshBtn.disabled = false;
        refreshBtn.classList.remove('refreshing');

        if (success) {
          refreshBtn.classList.add('refresh-success');
          showIcon('.refresh-success-icon');
          // Reset to refresh icon after delay
          setTimeout(() => {
            refreshBtn.classList.remove('refresh-success');
            showIcon('.refresh-icon');
          }, 2000);
        } else {
          refreshBtn.classList.add('refresh-error');
          showIcon('.refresh-error-icon');
          // Reset to refresh icon after delay
          setTimeout(() => {
            refreshBtn.classList.remove('refresh-error');
            showIcon('.refresh-icon');
          }, 2000);
          // Show notification for error
          showNotification('Failed to fetch models. Check your API key and try again.', 'error');
        }
      });
    }

    // Input handler - repopulate dropdown if open
    modelInput.addEventListener('input', () => {
      if (dropdownOpen && dropdownMenu && providerValueInput) {
        const providerId = providerValueInput.value || '';
        populateModelDropdown(dropdownMenu, modelInput.value, providerId, modelInput.value);
      }
    });

    // Keyboard navigation
    modelInput.addEventListener('keydown', (e) => {
      setupDropdownRefs();
      handleModelDropdownKeydown(e);
    });

    // Prevent clicks inside dropdown from closing it (handled by populateModelDropdown's item listeners)
    dropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Temperature slider
  temperatureInput?.addEventListener('input', () => {
    temperatureValue.textContent = parseFloat(temperatureInput.value).toFixed(1);
  });

  // Cancel button
  cancelBtn?.addEventListener('click', () => {
    editingProfileId = null;
    isNewProfile = false;
    selectedProviderIdForNew = null;
    renderProfilesList();
  });

  // Save button
  saveBtn?.addEventListener('click', () => handleSaveProfile(card, profileId, isNew));
}

/**
 * Fetch models for a provider (auto-fetch on provider/apiKey change)
 * Returns true if successful, false if failed
 */
async function fetchModelsForCard(card: HTMLElement, providerId: string, apiKey?: string): Promise<boolean> {
  const providerConfig = getProviderConfigById(providerId);
  if (!providerConfig) return false;

  // Check if provider requires API key for fetching
  if (providerRequiresApiKeyForFetching(providerId) && !apiKey) {
    return false; // Silent return - will fetch when API key is entered
  }

  // Generate cache key and set loading state
  const cacheKey = generateCacheKey(providerId, apiKey);
  currentCacheKey = cacheKey;
  isFetchingModels = true;

  // Refresh dropdown if it's open to show loading state
  const dropdownMenu = card.querySelector('.model-dropdown-menu') as HTMLElement;
  const modelInput = card.querySelector('.profile-model-input') as HTMLInputElement;
  if (dropdownMenu && !dropdownMenu.hidden) {
    populateModelDropdown(dropdownMenu, modelInput?.value || '', providerId, modelInput?.value || '');
  }

  try {
    const models = await fetchProviderSelectableModels(providerId, apiKey, true);
    setCachedModels(providerId, models, apiKey);
    console.log(`[ConfigUI] Fetched ${models.length} models from ${providerConfig.displayName}`);
    return true;
  } catch (error) {
    console.error('[ConfigUI] Failed to fetch models:', error);
    return false;
  } finally {
    isFetchingModels = false;
    // Refresh dropdown after fetching completes
    if (dropdownMenu && !dropdownMenu.hidden) {
      populateModelDropdown(dropdownMenu, modelInput?.value || '', providerId, modelInput?.value || '');
    }
  }
}

/**
 * Handle add profile
 */
function handleAddProfile(): void {
  if (editingProfileId !== null) {
    showNotification('Please save or cancel the current edit first', 'error');
    return;
  }

  isNewProfile = true;
  selectedProviderIdForNew = getAllProviders()[0]?.id ?? null;
  renderProfilesList();
}

/**
 * Handle edit profile
 */
function handleEditProfile(profileId: string): void {
  editingProfileId = profileId;
  isNewProfile = false;
  renderProfilesList();
}

/**
 * Handle save profile - with smart credential reuse
 */
async function handleSaveProfile(card: HTMLElement, profileId: string | null, isNew: boolean): Promise<void> {
  const nameInput = card.querySelector('.profile-name-input') as HTMLInputElement;
  const providerValueInput = card.querySelector('.profile-provider-value') as HTMLInputElement;
  const modelInput = card.querySelector('.profile-model-input') as HTMLInputElement;
  const apiKeyInput = card.querySelector('.profile-api-key-input') as HTMLInputElement;
  const temperatureInput = card.querySelector('.profile-temperature-input') as HTMLInputElement;
  const maxTokensInput = card.querySelector('.profile-max-tokens-input') as HTMLInputElement;
  const compressionModeInput = card.querySelector('.profile-compression-mode-input') as HTMLSelectElement;

  const name = nameInput.value.trim();
  const providerId = providerValueInput?.value || '';
  const model = modelInput.value.trim();
  const requiresKey = providerRequiresApiKey(providerId);
  // Use placeholder for providers that don't require API key
  const apiKey = requiresKey ? apiKeyInput.value.trim() : NO_API_KEY_PLACEHOLDER;
  const temperature = parseFloat(temperatureInput.value);
  const maxTokensStr = maxTokensInput.value.trim();
  const maxTokens = maxTokensStr ? parseInt(maxTokensStr, 10) : undefined;
  const compressionMode = (compressionModeInput?.value || 'two-pass') as 'two-pass' | 'single-pass';

  // Validation
  if (!name) {
    showNotification('Please enter a profile name', 'error');
    return;
  }

  if (!model) {
    showNotification('Please enter a model ID', 'error');
    return;
  }

  // Validate API key only for providers that require it
  if (requiresKey && !apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }

  // Find or create credential (smart reuse)
  let credentialId: string;

  if (profileId) {
    // Editing: check if API key changed
    const existingProfile = profiles.find((p) => p.modelConfig.id === profileId);
    if (existingProfile && existingProfile.credential.apiKey === apiKey) {
      // API key unchanged, reuse existing credential
      credentialId = existingProfile.credential.id;
    } else {
      // API key changed, find matching credential or create new
      const existingCredential = await findCredentialByApiKey(apiKey);
      if (existingCredential) {
        credentialId = existingCredential.id;
      } else {
        const newCredential = await createCredential({
          name: generateCredentialName(name, providerId),
          apiKey,
        });
        credentialId = newCredential.id;
      }
    }
  } else {
    // New profile: find matching credential or create new
    const existingCredential = await findCredentialByApiKey(apiKey);
    if (existingCredential) {
      credentialId = existingCredential.id;
    } else {
      const newCredential = await createCredential({
        name: generateCredentialName(name, providerId),
        apiKey,
      });
      credentialId = newCredential.id;
    }
  }

  try {
    if (isNew) {
      await createModelConfig({
        name,
        credentialId,
        providerId,
        model,
        temperature,
        maxTokens,
        compressionMode,
        isDefault: profiles.length === 0,
      });
      showNotification('Profile created', 'success');
    } else if (profileId) {
      await updateModelConfig(profileId, {
        name,
        credentialId,
        providerId,
        model,
        temperature,
        maxTokens,
        compressionMode,
      });
      showNotification('Profile updated', 'success');
    }

    editingProfileId = null;
    isNewProfile = false;
    selectedProviderIdForNew = null;
    await loadData();
    notifyProfilesChanged();
  } catch (error) {
    console.error('Failed to save profile:', error);
    showNotification(error instanceof Error ? error.message : 'Failed to save profile', 'error');
  }
}

/**
 * Generate a credential name based on profile name and provider
 * Credentials are internal entities, so we auto-generate sensible names
 */
function generateCredentialName(profileName: string, providerId: string): string {
  // Extract a meaningful name from the profile
  // e.g., "GPT-4 Turbo (Work)" -> "Work OpenAI"
  const provider = getProviderConfigById(providerId);
  const providerName = provider ? provider.displayName : providerId;

  // Check if profile has a parenthesized suffix like "(Work)"
  const match = profileName.match(/\(([^)]+)\)$/);
  if (match) {
    return `${match[1]} ${providerName}`;
  }

  // Otherwise use the profile name with provider
  return `${profileName} - ${providerName}`;
}

/**
 * Handle set default profile
 */
async function handleSetDefaultProfile(profileId: string): Promise<void> {
  try {
    await setDefaultModelConfig(profileId);
    showNotification('Default profile updated', 'success');
    await loadData();
    notifyProfilesChanged();
  } catch (error) {
    console.error('Failed to set default:', error);
    showNotification('Failed to set default profile', 'error');
  }
}

/**
 * Handle delete profile
 */
async function handleDeleteProfile(profileId: string): Promise<void> {
  const profile = profiles.find((p) => p.modelConfig.id === profileId);
  if (!profile) return;

  const confirmed = window.confirm(`Delete profile "${profile.modelConfig.name}"?`);
  if (!confirmed) return;

  try {
    await deleteModelConfig(profileId);

    // Note: We don't delete the credential here as it might be used by other profiles
    // Orphaned credentials could be cleaned up in a future maintenance function

    showNotification('Profile deleted', 'success');
    await loadData();
    notifyProfilesChanged();
  } catch (error) {
    console.error('Failed to delete profile:', error);
    showNotification(error instanceof Error ? error.message : 'Failed to delete profile', 'error');
  }
}

// ============================================================================
// Usage Stats Modal
// ============================================================================

let currentUsageStatsProfileId: string | null = null;
let currentTimeRange: UsageTimeRange = 'week';

/**
 * Show usage stats modal for a profile
 */
async function handleShowUsageStats(profileId: string, profileName: string): Promise<void> {
  // Avoid reopening the same modal
  if (currentUsageStatsProfileId === profileId) {
    const modal = document.getElementById('usage-stats-modal');
    if (modal && modal.style.display === 'flex') return;
  }
  currentUsageStatsProfileId = profileId;
  currentTimeRange = 'week';

  // Create modal if it doesn't exist
  let modal = document.getElementById('usage-stats-modal');
  if (!modal) {
    modal = createUsageStatsModal();
    document.body.appendChild(modal);
  }

  // Update modal title
  const titleEl = modal.querySelector('.usage-stats-title');
  if (titleEl) {
    titleEl.textContent = `Usage Stats: ${profileName}`;
  }

  // Show modal
  modal.style.display = 'flex';

  // Load and render stats
  await renderUsageStats(profileId, currentTimeRange);

  // Setup time range selector
  setupTimeRangeSelector(modal, profileId);
}

/**
 * Create the usage stats modal element
 */
function createUsageStatsModal(): HTMLElement {
  const modal = document.createElement('div');
  modal.id = 'usage-stats-modal';
  modal.className = 'usage-stats-modal';
  modal.innerHTML = `
    <div class="usage-stats-content">
      <div class="usage-stats-header">
        <h3 class="usage-stats-title">Usage Stats</h3>
        <button class="usage-stats-close" aria-label="Close">&times;</button>
      </div>

      <div class="usage-stats-time-range">
        <button class="time-range-btn" data-range="day">Day</button>
        <button class="time-range-btn active" data-range="week">Week</button>
        <button class="time-range-btn" data-range="month">Month</button>
        <button class="time-range-btn" data-range="quarter">Quarter</button>
        <button class="time-range-btn" data-range="year">Year</button>
      </div>

      <div class="usage-stats-summary">
        <div class="usage-stat-card">
          <span class="usage-stat-label">Total Tokens</span>
          <span class="usage-stat-value" id="usage-total-tokens">-</span>
        </div>
        <div class="usage-stat-card">
          <span class="usage-stat-label">Input Tokens</span>
          <span class="usage-stat-value" id="usage-input-tokens">-</span>
        </div>
        <div class="usage-stat-card">
          <span class="usage-stat-label">Output Tokens</span>
          <span class="usage-stat-value" id="usage-output-tokens">-</span>
        </div>
        <div class="usage-stat-card">
          <span class="usage-stat-label">Estimated Cost</span>
          <span class="usage-stat-value" id="usage-total-cost">-</span>
        </div>
        <div class="usage-stat-card">
          <span class="usage-stat-label">API Requests</span>
          <span class="usage-stat-value" id="usage-request-count">-</span>
        </div>
      </div>

      <div class="usage-chart-container">
        <canvas id="usage-chart" width="500" height="200"></canvas>
      </div>

      <div class="usage-stats-footer">
        <span class="usage-stats-period" id="usage-period-label">-</span>
      </div>
    </div>
  `;

  // Close button handler
  modal.querySelector('.usage-stats-close')?.addEventListener('click', () => {
    modal.style.display = 'none';
    currentUsageStatsProfileId = null;
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      currentUsageStatsProfileId = null;
    }
  });

  return modal;
}

/**
 * Setup time range selector buttons
 */
function setupTimeRangeSelector(modal: HTMLElement, profileId: string): void {
  const buttons = modal.querySelectorAll('.time-range-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const range = (e.target as HTMLButtonElement).dataset.range as UsageTimeRange;
      if (!range) return;

      // Update active state
      buttons.forEach((b) => b.classList.remove('active'));
      (e.target as HTMLButtonElement).classList.add('active');

      currentTimeRange = range;
      await renderUsageStats(profileId, range);
    });
  });
}

/**
 * Render usage stats for a profile
 */
async function renderUsageStats(profileId: string, timeRange: UsageTimeRange): Promise<void> {
  const stats = await getUsageStats(profileId, timeRange);
  const dataPoints = await getUsageDataPoints(profileId, timeRange);

  // Update summary cards
  const totalTokensEl = document.getElementById('usage-total-tokens');
  const inputTokensEl = document.getElementById('usage-input-tokens');
  const outputTokensEl = document.getElementById('usage-output-tokens');
  const totalCostEl = document.getElementById('usage-total-cost');
  const requestCountEl = document.getElementById('usage-request-count');
  const periodLabelEl = document.getElementById('usage-period-label');

  if (totalTokensEl) totalTokensEl.textContent = formatTokenCount(stats.totalTokens);
  if (inputTokensEl) inputTokensEl.textContent = formatTokenCount(stats.totalInputTokens);
  if (outputTokensEl) outputTokensEl.textContent = formatTokenCount(stats.totalOutputTokens);
  if (totalCostEl) totalCostEl.textContent = formatCost(stats.totalCost);
  if (requestCountEl) requestCountEl.textContent = stats.requestCount.toString();
  if (periodLabelEl) periodLabelEl.textContent = getTimeRangeLabel(timeRange);

  // Render chart
  renderUsageChart(dataPoints);
}

/**
 * Render usage chart using Canvas API
 */
function renderUsageChart(dataPoints: Awaited<ReturnType<typeof getUsageDataPoints>>): void {
  const canvas = document.getElementById('usage-chart') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (dataPoints.length === 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No usage data available', rect.width / 2, rect.height / 2);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = rect.width - padding.left - padding.right;
  const chartHeight = rect.height - padding.top - padding.bottom;

  // Find max values for scaling
  const maxTokens = Math.max(...dataPoints.map((d) => d.totalTokens), 1);
  const maxCost = Math.max(...dataPoints.map((d) => d.cost), 0.01);

  // Colors
  const tokenColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
  const costColor = '#10b981'; // Green for cost
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#333';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888';

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }

  // Draw bars for tokens
  const barWidth = Math.max(chartWidth / dataPoints.length - 4, 4);
  const barGap = chartWidth / dataPoints.length;

  dataPoints.forEach((point, i) => {
    const x = padding.left + i * barGap + (barGap - barWidth) / 2;
    const barHeight = (point.totalTokens / maxTokens) * chartHeight;
    const y = padding.top + chartHeight - barHeight;

    // Token bar
    ctx.fillStyle = tokenColor;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Cost line point (draw small circle)
    if (point.cost > 0) {
      const costY = padding.top + chartHeight - (point.cost / maxCost) * chartHeight;
      ctx.fillStyle = costColor;
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, costY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw cost line
  ctx.strokeStyle = costColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  dataPoints.forEach((point, i) => {
    const x = padding.left + i * barGap + barWidth / 2;
    const y = padding.top + chartHeight - (point.cost / maxCost) * chartHeight;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Y-axis labels (tokens)
  ctx.fillStyle = textColor;
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const value = maxTokens - (maxTokens / 5) * i;
    const y = padding.top + (chartHeight / 5) * i + 4;
    ctx.fillText(formatTokenCount(value), padding.left - 5, y);
  }

  // X-axis labels (dates) - show only some labels to avoid overlap
  ctx.textAlign = 'center';
  const labelStep = Math.ceil(dataPoints.length / 7);
  dataPoints.forEach((point, i) => {
    if (i % labelStep === 0 || i === dataPoints.length - 1) {
      const x = padding.left + i * barGap + barWidth / 2;
      const dateStr = point.date.slice(5); // MM-DD
      ctx.fillText(dateStr, x, rect.height - 5);
    }
  });

  // Legend
  ctx.font = '11px system-ui';
  ctx.textAlign = 'left';

  // Tokens legend
  ctx.fillStyle = tokenColor;
  ctx.fillRect(padding.left, rect.height - 25, 12, 12);
  ctx.fillStyle = textColor;
  ctx.fillText('Tokens', padding.left + 16, rect.height - 15);

  // Cost legend
  ctx.fillStyle = costColor;
  ctx.fillRect(padding.left + 80, rect.height - 25, 12, 12);
  ctx.fillStyle = textColor;
  ctx.fillText('Cost', padding.left + 96, rect.height - 15);
}

/**
 * Mask API key for display
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '••••••••';
  return apiKey.slice(0, 4) + '••••' + apiKey.slice(-4);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show notification
 */
function showNotification(message: string, type: 'success' | 'error' = 'success'): void {
  const notification = document.getElementById('notification');
  if (!notification) return;

  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'flex';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

/**
 * Update notebook model dropdown
 */
export function updateNotebookModelDropdown(): void {
  const select = elements.notebookModelSelect;
  select.innerHTML = '<option value="">Use Default</option>';

  profiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile.modelConfig.id;
    option.textContent = profile.modelConfig.name;
    select.appendChild(option);
  });
}

/**
 * Show notebook settings group
 */
export function showNotebookSettings(): void {
  elements.notebookSettingsGroup.style.display = 'block';
}

/**
 * Hide notebook settings group
 */
export function hideNotebookSettings(): void {
  elements.notebookSettingsGroup.style.display = 'none';
}

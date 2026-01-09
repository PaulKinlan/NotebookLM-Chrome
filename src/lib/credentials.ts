/**
 * Credential Management
 *
 * Manages named API key credentials.
 * Credentials are referenced by ModelConfigs for AI requests.
 */

import type { Credential, CredentialSettings } from '../types/index.ts';
import { dbGet, dbPut } from './db.ts';

const CREDENTIAL_SETTINGS_KEY = 'credentialSettings';

/**
 * Get all credential settings including credentials and default ID
 */
export async function getCredentialSettings(): Promise<CredentialSettings> {
  const result = await dbGet<{ key: string; value: CredentialSettings }>(
    'settings',
    CREDENTIAL_SETTINGS_KEY
  );

  if (!result) {
    return { credentials: [] };
  }

  return result.value;
}

/**
 * Save credential settings
 */
export async function saveCredentialSettings(settings: CredentialSettings): Promise<void> {
  await dbPut('settings', { key: CREDENTIAL_SETTINGS_KEY, value: settings });
}

/**
 * Get all credentials
 */
export async function getCredentials(): Promise<Credential[]> {
  const settings = await getCredentialSettings();
  return settings.credentials;
}

/**
 * Get a specific credential by ID
 */
export async function getCredential(id: string): Promise<Credential | null> {
  const credentials = await getCredentials();
  return credentials.find((c) => c.id === id) || null;
}

/**
 * Get the default credential
 */
export async function getDefaultCredential(): Promise<Credential | null> {
  const settings = await getCredentialSettings();
  if (!settings.defaultCredentialId) {
    return null;
  }
  return getCredential(settings.defaultCredentialId);
}

/**
 * Create a new credential
 */
export async function createCredential(
  credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Credential> {
  const settings = await getCredentialSettings();

  const newCredential: Credential = {
    ...credential,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // If this is the first credential, make it default
  if (settings.credentials.length === 0) {
    settings.defaultCredentialId = newCredential.id;
  }

  settings.credentials.push(newCredential);
  await saveCredentialSettings(settings);

  return newCredential;
}

/**
 * Update an existing credential
 */
export async function updateCredential(
  id: string,
  updates: Partial<Omit<Credential, 'id' | 'createdAt'>>
): Promise<void> {
  const settings = await getCredentialSettings();
  const credentialIndex = settings.credentials.findIndex((c) => c.id === id);

  if (credentialIndex === -1) {
    throw new Error(`Credential ${id} not found`);
  }

  const credential = settings.credentials[credentialIndex];

  // Update the credential
  settings.credentials[credentialIndex] = {
    ...credential,
    ...updates,
    id, // Ensure ID doesn't change
    createdAt: credential.createdAt, // Preserve creation time
    updatedAt: Date.now(),
  };

  await saveCredentialSettings(settings);
}

/**
 * Delete a credential
 * @throws Error if trying to delete the last credential
 */
export async function deleteCredential(id: string): Promise<void> {
  const settings = await getCredentialSettings();
  const credentialIndex = settings.credentials.findIndex((c) => c.id === id);

  if (credentialIndex === -1) {
    throw new Error(`Credential ${id} not found`);
  }

  // Prevent deleting the last credential
  if (settings.credentials.length === 1) {
    throw new Error('Cannot delete the last credential');
  }

  // If deleting default, need to assign new default
  if (settings.defaultCredentialId === id) {
    const remainingCredentials = settings.credentials.filter((c) => c.id !== id);
    settings.defaultCredentialId = remainingCredentials[0].id;
  }

  settings.credentials = settings.credentials.filter((c) => c.id !== id);
  await saveCredentialSettings(settings);
}

/**
 * Set a specific credential as the default
 */
export async function setDefaultCredential(id: string): Promise<void> {
  const settings = await getCredentialSettings();
  const credential = settings.credentials.find((c) => c.id === id);

  if (!credential) {
    throw new Error(`Credential ${id} not found`);
  }

  settings.defaultCredentialId = id;
  await saveCredentialSettings(settings);
}

/**
 * Find a credential by API key (for smart credential reuse)
 * Returns the credential if a matching API key exists, null otherwise
 */
export async function findCredentialByApiKey(apiKey: string): Promise<Credential | null> {
  const credentials = await getCredentials();
  return credentials.find((c) => c.apiKey === apiKey) || null;
}

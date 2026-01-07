import type { AISettings } from '../types/index.ts';
import { storage } from './storage.ts';

const SETTINGS_KEY = 'aiSettings';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250514',
  apiKeys: {},
};

export async function getAISettings(): Promise<AISettings> {
  const settings = await storage.getSetting<AISettings>(SETTINGS_KEY);
  return settings ?? DEFAULT_SETTINGS;
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  await storage.setSetting(SETTINGS_KEY, settings);
}

export async function getApiKey(provider: string): Promise<string | undefined> {
  const settings = await getAISettings();
  return settings.apiKeys[provider];
}

export async function setApiKey(provider: string, key: string): Promise<void> {
  const settings = await getAISettings();
  settings.apiKeys[provider] = key;
  await saveAISettings(settings);
}

export async function setProvider(provider: AISettings['provider']): Promise<void> {
  const settings = await getAISettings();
  settings.provider = provider;
  await saveAISettings(settings);
}

export async function setModel(model: string): Promise<void> {
  const settings = await getAISettings();
  settings.model = model;
  await saveAISettings(settings);
}

export async function setTemperature(temperature: number): Promise<void> {
  const settings = await getAISettings();
  settings.temperature = temperature;
  await saveAISettings(settings);
}

export async function setMaxTokens(maxTokens: number | undefined): Promise<void> {
  const settings = await getAISettings();
  settings.maxTokens = maxTokens;
  await saveAISettings(settings);
}

export async function setBaseURL(baseURL: string | undefined): Promise<void> {
  const settings = await getAISettings();
  settings.baseURL = baseURL;
  await saveAISettings(settings);
}

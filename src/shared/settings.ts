import { DEFAULT_SETTINGS, type Settings } from './messages';

const STORAGE_KEY = 'subly:settings';

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

import { DEFAULT_SETTINGS, type Settings } from './messages';

const STORAGE_KEY = 'subly:settings';

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  if ((settings.mode as string) === 'translate-tr') {
    settings.mode = 'translate';
    settings.targetLanguage = 'tr';
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

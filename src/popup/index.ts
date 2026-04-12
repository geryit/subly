import {
  DEFAULT_SETTINGS,
  type BackgroundToPopup,
  type Language,
  type Mode,
  type ModelSize,
  type OverlayPosition,
  type PopupToBackground,
  type Settings,
  type SessionState,
} from '../shared/messages';
import { loadSettings, saveSettings } from '../shared/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const toggle = $<HTMLButtonElement>('toggle');
const statusDot = $<HTMLSpanElement>('status-dot');
const progress = $<HTMLDivElement>('progress');
const progressBar = $<HTMLDivElement>('progress-bar');
const progressText = $<HTMLDivElement>('progress-text');
const errorBox = $<HTMLDivElement>('error');

const modeSel = $<HTMLSelectElement>('mode');
const languageSel = $<HTMLSelectElement>('language');
const modelSel = $<HTMLSelectElement>('model');
const apiKeyLabel = $<HTMLLabelElement>('api-key-label');
const apiKeyTitle = $<HTMLSpanElement>('api-key-title');
const apiKeyInput = $<HTMLInputElement>('api-key');
const fontSizeInput = $<HTMLInputElement>('font-size');
const fontSizeLabel = $<HTMLSpanElement>('font-size-label');
const positionSel = $<HTMLSelectElement>('position');

let settings: Settings = { ...DEFAULT_SETTINGS };
let currentState: SessionState = 'idle';
let activeTabId: number | null = null;

async function init() {
  settings = await loadSettings();
  applySettingsToControls();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;

  if (activeTabId !== null) {
    sendToBackground({ type: 'GET_STATE', tabId: activeTabId });
  } else {
    renderError({ code: 'INVALID_TAB', message: 'No active tab.' });
  }

  wireSettingControls();
  toggle.addEventListener('click', onToggleClick);

  chrome.runtime.onMessage.addListener((msg: BackgroundToPopup) => {
    if (msg.type === 'STATE') {
      setState(msg.state, msg.error);
    } else if (msg.type === 'MODEL_PROGRESS') {
      showProgress(msg.loaded, msg.total);
    }
  });
}

function applySettingsToControls() {
  modeSel.value = settings.mode;
  languageSel.value = settings.language;
  modelSel.value = settings.model;
  apiKeyInput.value = getApiKey(settings);
  updateApiKeyUI(settings.model);
  fontSizeInput.value = String(settings.fontSizePx);
  fontSizeLabel.textContent = `${settings.fontSizePx}px`;
  positionSel.value = settings.position;
}

function wireSettingControls() {
  modeSel.addEventListener('change', async () => {
    settings.mode = modeSel.value as Mode;
    await saveSettings(settings);
    pushSettings();
  });
  languageSel.addEventListener('change', async () => {
    settings.language = languageSel.value as Language;
    await saveSettings(settings);
    pushSettings();
  });
  modelSel.addEventListener('change', async () => {
    settings.model = modelSel.value as ModelSize;
    updateApiKeyUI(settings.model);
    apiKeyInput.value = getApiKey(settings);
    await saveSettings(settings);
    pushSettings();
  });
  apiKeyInput.addEventListener('change', async () => {
    setApiKey(settings, apiKeyInput.value.trim());
    await saveSettings(settings);
    pushSettings();
  });
  fontSizeInput.addEventListener('input', async () => {
    settings.fontSizePx = Number(fontSizeInput.value);
    fontSizeLabel.textContent = `${settings.fontSizePx}px`;
    await saveSettings(settings);
    pushSettings();
  });
  positionSel.addEventListener('change', async () => {
    settings.position = positionSel.value as OverlayPosition;
    await saveSettings(settings);
    pushSettings();
  });
}

function onToggleClick() {
  if (activeTabId === null) return;
  if (currentState === 'idle' || currentState === 'error') {
    sendToBackground({ type: 'START', tabId: activeTabId, settings });
  } else {
    sendToBackground({ type: 'STOP', tabId: activeTabId });
  }
}

function setState(state: SessionState, error?: { code: string; message: string }) {
  currentState = state;
  statusDot.className = '';
  errorBox.hidden = true;
  progress.hidden = state !== 'loading_model';

  switch (state) {
    case 'idle':
      toggle.textContent = 'Start';
      toggle.dataset.state = 'idle';
      break;
    case 'loading_model':
      toggle.textContent = 'Loading…';
      toggle.dataset.state = 'loading_model';
      statusDot.classList.add('loading');
      break;
    case 'capturing':
      toggle.textContent = 'Stop';
      toggle.dataset.state = 'capturing';
      statusDot.classList.add('active');
      break;
    case 'error':
      toggle.textContent = 'Start';
      toggle.dataset.state = 'idle';
      statusDot.classList.add('error');
      if (error) renderError(error);
      break;
  }
}

function renderError(error: { code: string; message: string }) {
  errorBox.hidden = false;
  errorBox.textContent = `${error.code}: ${error.message}`;
}

function showProgress(loaded: number, total: number) {
  progress.hidden = false;
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  progressBar.style.width = `${pct}%`;
  progressText.textContent = `Loading model… ${pct}%`;
}

function sendToBackground(msg: PopupToBackground) {
  chrome.runtime.sendMessage(msg).catch((err) => {
    console.error('[Subly popup] sendMessage failed', err);
  });
}

function pushSettings() {
  if (activeTabId === null) return;
  sendToBackground({ type: 'APPLY_SETTINGS', tabId: activeTabId, settings });
}

function isCloud(model: ModelSize): boolean {
  return model.startsWith('cloud-');
}

function updateApiKeyUI(model: ModelSize) {
  const cloud = isCloud(model);
  apiKeyLabel.hidden = !cloud;
  if (cloud) {
    const labels: Record<string, [string, string]> = {
      'cloud-groq': ['Groq API Key', 'gsk_...'],
      'cloud-openai': ['OpenAI API Key', 'sk-...'],
      'cloud-deepgram': ['Deepgram API Key', 'your key'],
    };
    const [title, placeholder] = labels[model] ?? ['API Key', ''];
    apiKeyTitle.textContent = title;
    apiKeyInput.placeholder = placeholder;
  }
}

function getApiKey(s: Settings): string {
  switch (s.model) {
    case 'cloud-groq': return s.groqApiKey ?? '';
    case 'cloud-openai': return s.openaiApiKey ?? '';
    case 'cloud-deepgram': return s.deepgramApiKey ?? '';
    default: return '';
  }
}

function setApiKey(s: Settings, key: string) {
  const val = key || undefined;
  switch (s.model) {
    case 'cloud-groq': s.groqApiKey = val; break;
    case 'cloud-openai': s.openaiApiKey = val; break;
    case 'cloud-deepgram': s.deepgramApiKey = val; break;
  }
}

init();

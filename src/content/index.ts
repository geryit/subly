import overlayCss from './overlay.css?inline';
import type { BackgroundToContent, Settings } from '../shared/messages';
import { DEFAULT_SETTINGS } from '../shared/messages';
import { loadSettings } from '../shared/settings';

const OVERLAY_ID = 'subly-overlay';
const MAX_LINES = 2;
const CLEAR_AFTER_MS = 6000;

let overlay: HTMLDivElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let lines: string[] = [];
let clearTimer: number | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };

async function init() {
  settings = await loadSettings();
  injectStyle();
  ensureOverlay();
  chrome.runtime.onMessage.addListener((msg: BackgroundToContent) => {
    if (msg.type === 'TRANSCRIPT') {
      appendText(msg.text);
    } else if (msg.type === 'CLEAR_OVERLAY') {
      clearText();
    } else if (msg.type === 'APPLY_SETTINGS') {
      settings = msg.settings;
      applySettingsToOverlay();
    }
  });

  document.addEventListener('fullscreenchange', onFullscreenChange);
  observeDomForVideoChanges();
}

function injectStyle() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.id = 'subly-style';
  styleEl.textContent = overlayCss;
  document.documentElement.appendChild(styleEl);
}

function ensureOverlay(): HTMLDivElement {
  if (overlay && overlay.isConnected) return overlay;
  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.dataset.position = settings.position;
  el.style.fontSize = `${settings.fontSizePx}px`;
  overlay = el;
  (document.fullscreenElement ?? document.body).appendChild(el);
  return el;
}

function applySettingsToOverlay() {
  if (!overlay) return;
  overlay.dataset.position = settings.position;
  overlay.style.fontSize = `${settings.fontSizePx}px`;
}

function appendText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  lines.push(trimmed);
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
  const el = ensureOverlay();
  el.textContent = lines.join('\n');
  el.dataset.visible = 'true';
  if (clearTimer !== null) window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(clearText, CLEAR_AFTER_MS);
}

function clearText() {
  lines = [];
  if (clearTimer !== null) {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (overlay) {
    overlay.dataset.visible = 'false';
    overlay.textContent = '';
  }
}

function onFullscreenChange() {
  if (!overlay) return;
  const target = document.fullscreenElement ?? document.body;
  if (overlay.parentElement !== target) {
    target.appendChild(overlay);
  }
}

function observeDomForVideoChanges() {
  const observer = new MutationObserver(() => {
    if (!overlay || !overlay.isConnected) {
      overlay = null;
      ensureOverlay();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

init();

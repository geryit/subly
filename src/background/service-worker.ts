import type {
  BackgroundToContent,
  BackgroundToOffscreen,
  BackgroundToPopup,
  OffscreenToBackground,
  PopupToBackground,
  SessionState,
  Settings,
  SubError,
} from '../shared/messages';

type TabSession = {
  tabId: number;
  state: SessionState;
  settings: Settings;
  error?: SubError;
};

const sessions = new Map<number, TabSession>();
const OFFSCREEN_URL = 'src/offscreen/offscreen.html';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message as PopupToBackground | OffscreenToBackground)
    .then((response) => sendResponse(response))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

async function handleMessage(
  msg: PopupToBackground | OffscreenToBackground,
): Promise<unknown> {
  switch (msg.type) {
    case 'START':
      await startSession(msg.tabId, msg.settings);
      return { ok: true };
    case 'STOP':
      await stopSession(msg.tabId);
      return { ok: true };
    case 'GET_STATE':
      broadcastState(msg.tabId);
      return { ok: true };
    case 'APPLY_SETTINGS':
      forwardSettings(msg.tabId, msg.settings);
      return { ok: true };
    case 'OFFSCREEN_READY':
      markAnyLoadingSessionCapturing();
      return { ok: true };
    case 'TRANSCRIPT':
      await forwardTranscript(msg.tabId, msg.text);
      return { ok: true };
    case 'MODEL_PROGRESS':
      broadcastPopup({ type: 'MODEL_PROGRESS', loaded: msg.loaded, total: msg.total });
      return { ok: true };
    case 'OFFSCREEN_ERROR':
      handleOffscreenError(msg.code, msg.message);
      return { ok: true };
    default:
      return { ok: false };
  }
}

async function startSession(tabId: number, settings: Settings) {
  const session: TabSession = { tabId, state: 'loading_model', settings };
  sessions.set(tabId, session);
  broadcastState(tabId);

  try {
    await ensureOffscreenDocument();
    const streamId = await getTabMediaStreamId(tabId);
    const initMsg: BackgroundToOffscreen = {
      type: 'INIT',
      streamId,
      tabId,
      settings,
    };
    // Fire-and-forget — don't await because model loading can take minutes
    // for large models and Chrome will timeout the message channel.
    // State transitions are driven by OFFSCREEN_READY / OFFSCREEN_ERROR.
    chrome.runtime.sendMessage(initMsg).catch(() => {});
  } catch (err) {
    session.state = 'error';
    session.error = {
      code: 'TAB_CAPTURE_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
    broadcastState(tabId);
  }
}

function markAnyLoadingSessionCapturing() {
  for (const session of sessions.values()) {
    if (session.state === 'loading_model') {
      session.state = 'capturing';
      session.error = undefined;
      broadcastState(session.tabId);
    }
  }
}

async function stopSession(tabId: number) {
  const session = sessions.get(tabId);
  if (!session) return;
  const shutdown: BackgroundToOffscreen = { type: 'SHUTDOWN' };
  try {
    await chrome.runtime.sendMessage(shutdown);
  } catch {
    /* offscreen may already be gone */
  }
  await closeOffscreenDocumentIfNoSessions(tabId);
  session.state = 'idle';
  session.error = undefined;
  broadcastState(tabId);
  const clear: BackgroundToContent = { type: 'CLEAR_OVERLAY' };
  chrome.tabs.sendMessage(tabId, clear).catch(() => {});
}

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Capturing tab audio for live subtitles',
  });
}

async function closeOffscreenDocumentIfNoSessions(excludeTabId: number) {
  sessions.delete(excludeTabId);
  const anyActive = [...sessions.values()].some((s) => s.state === 'capturing');
  if (anyActive) return;
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

function getTabMediaStreamId(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? 'getMediaStreamId failed'));
        return;
      }
      resolve(streamId);
    });
  });
}

function broadcastState(tabId: number) {
  const session = sessions.get(tabId);
  const state: SessionState = session?.state ?? 'idle';
  const msg: BackgroundToPopup = { type: 'STATE', state, error: session?.error };
  broadcastPopup(msg);
}

function broadcastPopup(msg: BackgroundToPopup) {
  chrome.runtime.sendMessage(msg).catch(() => {
    /* popup may be closed */
  });
}

async function forwardTranscript(tabId: number, text: string) {
  const msg: BackgroundToContent = { type: 'TRANSCRIPT', text };
  await chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

function forwardSettings(tabId: number, settings: Settings) {
  const msg: BackgroundToContent = { type: 'APPLY_SETTINGS', settings };
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

function handleOffscreenError(code: SubError['code'], message: string) {
  for (const session of sessions.values()) {
    if (session.state === 'capturing' || session.state === 'loading_model') {
      session.state = 'error';
      session.error = { code, message };
      broadcastState(session.tabId);
    }
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (sessions.has(tabId)) {
    stopSession(tabId).catch(() => {});
  }
});

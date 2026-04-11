import type {
  BackgroundToOffscreen,
  OffscreenToBackground,
  Settings,
} from '../shared/messages';

type SessionCtx = {
  tabId: number;
  settings: Settings;
  fakeTimer: number | null;
  fakeIndex: number;
};

let ctx: SessionCtx | null = null;

const FAKE_FINNISH_LINES = [
  'Tervetuloa katsomaan ohjelmaa.',
  'Tämä on testilause numero kaksi.',
  'Subly toimii – oikea Whisper tulee seuraavassa vaiheessa.',
  'Pipe on auki, viestit kulkevat oikein.',
  'Onneksi olkoon — skelettiä rakennetaan.',
];

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg as BackgroundToOffscreen)
    .then((r) => sendResponse(r))
    .catch((err) => {
      console.error('[Subly offscreen] error', err);
      sendResponse({ ok: false });
    });
  return true;
});

async function handleMessage(msg: BackgroundToOffscreen) {
  if (msg.type === 'INIT') {
    await startSession(msg.tabId, msg.settings);
    return { ok: true };
  }
  if (msg.type === 'SHUTDOWN') {
    stopSession();
    return { ok: true };
  }
}

async function startSession(tabId: number, settings: Settings) {
  stopSession();
  ctx = { tabId, settings, fakeTimer: null, fakeIndex: 0 };
  send({ type: 'OFFSCREEN_READY' });
  ctx.fakeTimer = self.setInterval(() => emitFake(), 2500);
}

function stopSession() {
  if (ctx?.fakeTimer !== null && ctx?.fakeTimer !== undefined) {
    clearInterval(ctx.fakeTimer);
  }
  ctx = null;
}

function emitFake() {
  if (!ctx) return;
  const text = FAKE_FINNISH_LINES[ctx.fakeIndex % FAKE_FINNISH_LINES.length];
  ctx.fakeIndex += 1;
  send({ type: 'TRANSCRIPT', tabId: ctx.tabId, text });
}

function send(msg: OffscreenToBackground) {
  chrome.runtime.sendMessage(msg).catch((err) => {
    console.error('[Subly offscreen] send failed', err);
  });
}

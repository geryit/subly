import type {
  BackgroundToOffscreen,
  OffscreenToBackground,
  Settings,
} from '../shared/messages';

type SessionCtx = {
  tabId: number;
  settings: Settings;
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  frameCount: number;
};

let ctx: SessionCtx | null = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg as BackgroundToOffscreen)
    .then((r) => sendResponse(r))
    .catch((err) => {
      console.error('[Subly offscreen] error', err);
      send({
        type: 'OFFSCREEN_ERROR',
        code: 'UNKNOWN',
        message: err instanceof Error ? err.message : String(err),
      });
      sendResponse({ ok: false });
    });
  return true;
});

async function handleMessage(msg: BackgroundToOffscreen) {
  if (msg.type === 'INIT') {
    await startSession(msg.streamId, msg.tabId, msg.settings);
    return { ok: true };
  }
  if (msg.type === 'SHUTDOWN') {
    await stopSession();
    return { ok: true };
  }
}

async function startSession(streamId: string, tabId: number, settings: Settings) {
  await stopSession();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    } as MediaTrackConstraints,
    video: false,
  });

  const audioContext = new AudioContext();
  const workletUrl = chrome.runtime.getURL('audio-collector.js');
  await audioContext.audioWorklet.addModule(workletUrl);

  const sourceNode = audioContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioContext, 'audio-collector');

  // Keep playing tab audio to the user
  sourceNode.connect(audioContext.destination);
  // Also tap into the worklet for future Whisper (worklet outputs nothing,
  // but Chrome still needs a destination to run the graph)
  sourceNode.connect(workletNode);
  workletNode.connect(audioContext.destination);

  workletNode.port.onmessage = (event: MessageEvent) => {
    if (!ctx) return;
    const data = event.data as { samples: Float32Array; sampleRate: number };
    ctx.frameCount += 1;
    if (ctx.frameCount % 100 === 0) {
      console.log(
        `[Subly offscreen] received ${ctx.frameCount} frames @ ${data.sampleRate} Hz, last length=${data.samples.length}`,
      );
    }
  };

  ctx = {
    tabId,
    settings,
    stream,
    audioContext,
    sourceNode,
    workletNode,
    frameCount: 0,
  };

  send({ type: 'OFFSCREEN_READY' });
}

async function stopSession() {
  if (!ctx) return;
  try {
    ctx.workletNode.port.onmessage = null;
    ctx.workletNode.disconnect();
    ctx.sourceNode.disconnect();
    ctx.stream.getTracks().forEach((t) => t.stop());
    await ctx.audioContext.close();
  } catch (err) {
    console.warn('[Subly offscreen] cleanup error', err);
  }
  ctx = null;
}

function send(msg: OffscreenToBackground) {
  chrome.runtime.sendMessage(msg).catch((err) => {
    console.error('[Subly offscreen] send failed', err);
  });
}

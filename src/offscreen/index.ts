import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers';
import type {
  BackgroundToOffscreen,
  OffscreenToBackground,
  Settings,
} from '../shared/messages';
import { LANGUAGE_TO_WHISPER, MODEL_IDS, type ModelSize } from '../shared/messages';

env.allowLocalModels = false;
env.useBrowserCache = true;
// Override the jsdelivr CDN fallback for ONNX runtime WASM backends.
// The files live in public/ort/ and are served from the extension origin.
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('ort/');
}

const WINDOW_SECONDS = 5;
const OVERLAP_SECONDS = 1;
const TARGET_SAMPLE_RATE = 16000;

type SessionCtx = {
  tabId: number;
  settings: Settings;
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  nativeSampleRate: number;
  buffer: Float32Array[];
  bufferedSamples: number;
  transcribing: boolean;
};

let ctx: SessionCtx | null = null;
let asr: AutomaticSpeechRecognitionPipeline | null = null;
let asrModelKey: string | null = null;

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

  // Capture audio FIRST — streamId expires if we wait too long (model download).
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

  sourceNode.connect(audioContext.destination);
  sourceNode.connect(workletNode);
  workletNode.connect(audioContext.destination);

  ctx = {
    tabId,
    settings,
    stream,
    audioContext,
    sourceNode,
    workletNode,
    nativeSampleRate: audioContext.sampleRate,
    buffer: [],
    bufferedSamples: 0,
    transcribing: false,
  };

  workletNode.port.onmessage = (event: MessageEvent) => {
    if (!ctx) return;
    const data = event.data as { samples: Float32Array; sampleRate: number };
    onAudioFrame(data.samples);
  };

  // Cloud mode skips local model loading entirely.
  if (settings.model !== 'cloud') {
    try {
      await ensureAsrPipeline(settings);
    } catch (err) {
      send({
        type: 'OFFSCREEN_ERROR',
        code: 'MODEL_LOAD_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }

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

async function ensureAsrPipeline(settings: Settings) {
  const modelId = MODEL_IDS[settings.model as Exclude<ModelSize, 'cloud'>];
  if (asr && asrModelKey === modelId) return;

  asr = null;
  asrModelKey = null;

  const progressReporter = (progress: ProgressInfo) => {
    if (progress.status === 'progress') {
      send({
        type: 'MODEL_PROGRESS',
        loaded: progress.loaded,
        total: progress.total,
      });
    }
  };

  try {
    const created = await pipeline('automatic-speech-recognition', modelId, {
      device: 'webgpu',
      dtype: 'fp32',
      progress_callback: progressReporter,
    });
    asr = created as unknown as AutomaticSpeechRecognitionPipeline;
  } catch (webgpuErr) {
    console.warn(
      '[Subly offscreen] WebGPU init failed, falling back to WASM',
      webgpuErr,
    );
    try {
      const created = await pipeline('automatic-speech-recognition', modelId, {
        device: 'wasm',
        dtype: 'fp32',
        progress_callback: progressReporter,
      });
      asr = created as unknown as AutomaticSpeechRecognitionPipeline;
    } catch (wasmErr) {
      throw new Error(
        `WebGPU failed (${String(webgpuErr)}); WASM also failed (${String(wasmErr)})`,
      );
    }
  }
  asrModelKey = modelId;
}

async function translateText(text: string, targetLang: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0].map((s: [string]) => s[0]).join('');
}

function onAudioFrame(frame: Float32Array) {
  if (!ctx) return;
  ctx.buffer.push(frame);
  ctx.bufferedSamples += frame.length;

  const windowSamples = ctx.nativeSampleRate * WINDOW_SECONDS;
  if (ctx.bufferedSamples >= windowSamples && !ctx.transcribing) {
    ctx.transcribing = true;
    const combined = concatFloat32(ctx.buffer, ctx.bufferedSamples);
    // Keep the trailing OVERLAP_SECONDS for the next window
    const overlapSamples = ctx.nativeSampleRate * OVERLAP_SECONDS;
    const tail = combined.subarray(combined.length - overlapSamples);
    ctx.buffer = [new Float32Array(tail)];
    ctx.bufferedSamples = tail.length;

    runTranscription(combined).finally(() => {
      if (ctx) ctx.transcribing = false;
    });
  }
}

async function runTranscription(audioAtNative: Float32Array) {
  if (!ctx) return;

  if (ctx.settings.model === 'cloud') {
    await runCloudTranscription(audioAtNative);
  } else {
    await runLocalTranscription(audioAtNative);
  }
}

async function runLocalTranscription(audioAtNative: Float32Array) {
  if (!ctx || !asr) return;
  const tabId = ctx.tabId;
  const language = LANGUAGE_TO_WHISPER[ctx.settings.language];

  const resampled = await resampleTo16k(audioAtNative, ctx.nativeSampleRate);

  try {
    const whisperTask = ctx.settings.mode === 'translate-tr' ? 'translate' : ctx.settings.mode;
    const result = await asr(resampled, {
      language,
      task: whisperTask,
      return_timestamps: false,
    });
    let text = Array.isArray(result)
      ? result.map((r) => r.text).join(' ')
      : result.text;
    text = text.trim();
    if (text.length > 0 && ctx.settings.mode === 'translate-tr') {
      try {
        text = await translateText(text, 'tr');
      } catch (err) {
        console.warn('[Subly] translation failed, showing English:', err);
      }
    }
    if (text.length > 0) {
      send({ type: 'TRANSCRIPT', tabId, text });
    }
  } catch (err) {
    console.error('[Subly offscreen] transcription error', err);
  }
}

async function runCloudTranscription(audioAtNative: Float32Array) {
  if (!ctx) return;
  const tabId = ctx.tabId;
  const apiKey = ctx.settings.groqApiKey;
  if (!apiKey) {
    send({ type: 'OFFSCREEN_ERROR', code: 'UNKNOWN', message: 'Groq API key is not set' });
    return;
  }

  const resampled = await resampleTo16k(audioAtNative, ctx.nativeSampleRate);
  const wavBlob = encodeWav(resampled, TARGET_SAMPLE_RATE);

  const task = ctx.settings.mode === 'translate' || ctx.settings.mode === 'translate-tr'
    ? 'translate' : 'transcribe';

  const form = new FormData();
  form.append('file', wavBlob, 'audio.wav');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', ctx.settings.language);
  form.append('response_format', 'json');
  if (task === 'translate') {
    form.append('task', 'translate');
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[Subly cloud] API error', res.status, body);
      return;
    }
    const data = await res.json() as { text: string };
    let text = data.text.trim();
    if (text.length > 0 && ctx.settings.mode === 'translate-tr') {
      try {
        text = await translateText(text, 'tr');
      } catch (err) {
        console.warn('[Subly] translation failed, showing English:', err);
      }
    }
    if (text.length > 0) {
      send({ type: 'TRANSCRIPT', tabId, text });
    }
  } catch (err) {
    console.error('[Subly cloud] transcription error', err);
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function concatFloat32(chunks: Float32Array[], totalLength: number): Float32Array {
  const out = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function resampleTo16k(
  input: Float32Array,
  fromRate: number,
): Promise<Float32Array> {
  if (fromRate === TARGET_SAMPLE_RATE) return input;
  const targetLength = Math.ceil((input.length * TARGET_SAMPLE_RATE) / fromRate);
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const buffer = offline.createBuffer(1, input.length, fromRate);
  // Copy into a fresh Float32Array backed by a plain ArrayBuffer so the
  // generic parameter of copyToChannel (Float32Array<ArrayBuffer>) is satisfied.
  const channel = new Float32Array(new ArrayBuffer(input.length * 4));
  channel.set(input);
  buffer.copyToChannel(channel, 0);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  const out = new Float32Array(new ArrayBuffer(rendered.length * 4));
  out.set(rendered.getChannelData(0));
  return out;
}

function send(msg: OffscreenToBackground) {
  chrome.runtime.sendMessage(msg).catch((err) => {
    console.error('[Subly offscreen] send failed', err);
  });
}

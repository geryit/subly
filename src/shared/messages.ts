export type SessionState = 'idle' | 'loading_model' | 'capturing' | 'error';

export type Language =
  | 'ar'
  | 'bn'
  | 'zh'
  | 'en'
  | 'fi'
  | 'fr'
  | 'de'
  | 'hi'
  | 'id'
  | 'it'
  | 'ja'
  | 'ko'
  | 'mr'
  | 'pt'
  | 'ru'
  | 'es'
  | 'sv'
  | 'ta'
  | 'te'
  | 'tr'
  | 'ur'
  | 'vi';
export type LocalModel = 'tiny' | 'base' | 'small';
export type CloudProvider = 'cloud-groq' | 'cloud-openai' | 'cloud-deepgram';
export type ModelSize = LocalModel | CloudProvider;
export type OverlayPosition = 'bottom' | 'top';
export type Mode = 'transcribe' | 'translate' | 'translate-tr';

export type Settings = {
  language: Language;
  model: ModelSize;
  mode: Mode;
  fontSizePx: number;
  position: OverlayPosition;
  groqApiKey?: string;
  openaiApiKey?: string;
  deepgramApiKey?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'fi',
  model: 'base',
  mode: 'transcribe',
  fontSizePx: 20,
  position: 'bottom',
};

export type ErrorCode =
  | 'TAB_CAPTURE_FAILED'
  | 'MODEL_LOAD_FAILED'
  | 'WEBGPU_AND_WASM_FAILED'
  | 'NO_VIDEO_FOUND'
  | 'INVALID_TAB'
  | 'UNKNOWN';

export type SubError = { code: ErrorCode; message: string };

// Popup → Background
export type PopupToBackground =
  | { type: 'START'; tabId: number; settings: Settings }
  | { type: 'STOP'; tabId: number }
  | { type: 'GET_STATE'; tabId: number }
  | { type: 'APPLY_SETTINGS'; tabId: number; settings: Settings };

// Background → Popup (sent as responses and via port broadcast)
export type BackgroundToPopup =
  | { type: 'STATE'; state: SessionState; error?: SubError }
  | { type: 'MODEL_PROGRESS'; loaded: number; total: number };

// Background → Offscreen
export type BackgroundToOffscreen =
  | { type: 'INIT'; streamId: string; tabId: number; settings: Settings }
  | { type: 'SHUTDOWN' };

// Offscreen → Background
export type OffscreenToBackground =
  | { type: 'OFFSCREEN_READY' }
  | { type: 'TRANSCRIPT'; tabId: number; text: string }
  | { type: 'MODEL_PROGRESS'; loaded: number; total: number }
  | { type: 'OFFSCREEN_ERROR'; code: ErrorCode; message: string };

// Background → Content
export type BackgroundToContent =
  | { type: 'TRANSCRIPT'; text: string }
  | { type: 'CLEAR_OVERLAY' }
  | { type: 'APPLY_SETTINGS'; settings: Settings };

export const MODEL_IDS: Record<LocalModel, string> = {
  tiny: 'Xenova/whisper-tiny',
  base: 'Xenova/whisper-base',
  small: 'Xenova/whisper-small',
};

export const LANGUAGE_TO_WHISPER: Record<Language, string> = {
  ar: 'arabic',
  bn: 'bengali',
  zh: 'chinese',
  en: 'english',
  fi: 'finnish',
  fr: 'french',
  de: 'german',
  hi: 'hindi',
  id: 'indonesian',
  it: 'italian',
  ja: 'japanese',
  ko: 'korean',
  mr: 'marathi',
  pt: 'portuguese',
  ru: 'russian',
  es: 'spanish',
  sv: 'swedish',
  ta: 'tamil',
  te: 'telugu',
  tr: 'turkish',
  ur: 'urdu',
  vi: 'vietnamese',
};

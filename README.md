# Subly

Live AI subtitles for any HTML5 video on the web. Subly captures the tab's audio, runs Whisper locally in the browser, and overlays the transcribed text on the page. Designed for watching Finnish TV (e.g. ruutu.fi) without native subtitles.

## Requirements

- Chrome or Chromium-based browser with Manifest V3 + offscreen + tabCapture APIs (Chrome ≥ 116)
- WebGPU recommended (Chrome ≥ 113 desktop). Without WebGPU, Subly falls back to WASM — slower and higher latency.
- First run downloads the Whisper model (~75 MB for `base`). The model is cached in the browser after the first run.

## Install (development)

```bash
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin Subly to the toolbar for convenience.

## Usage

1. Play a video on any site.
2. Click the Subly icon.
3. Pick language (Finnish default), model size, and overlay position.
4. Click **Start**. The first session downloads the model — watch the progress bar in the popup.
5. Subtitles appear on the page overlay. Close the popup — captioning continues.
6. Click **Stop** when done.

Changing language / model requires a **Stop** and **Start**. Font size and position apply live.

## Architecture

See `docs/superpowers/specs/2026-04-11-subly-design.md` for the full design spec. Quick version:

```
Popup ──▶ Background SW ──▶ Offscreen (tabCapture + Whisper) ──▶ Content (overlay)
```

- **Popup** — controls and session state.
- **Background service worker** — session state machine, offscreen lifecycle, message router.
- **Offscreen document** — holds the `MediaStream`, runs the audio graph, and invokes Whisper via `@huggingface/transformers`.
- **Content script** — injects an overlay `<div>` and renders incoming transcripts.

## Known limitations

- DRM-protected video on some sites may block `chrome.tabCapture`. If `TAB_CAPTURE_FAILED` appears in the popup, the site has opted out.
- Transcription latency is ~5–7 s (5 s audio window + ~1 s inference on WebGPU).
- One video per tab. Pages with multiple simultaneous videos caption only the one the content script picks.
- No translation. Subly transcribes the source language as-is.

## Development

```bash
pnpm dev          # Vite HMR build (auto-reloads on source changes)
pnpm build        # One-shot production build
pnpm type-check   # TypeScript without emit
```

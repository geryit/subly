# Subly Privacy Policy

**Last updated:** April 12, 2026

## What Subly Does

Subly is a Chrome extension that adds live subtitles to HTML5 videos by capturing tab audio and transcribing it using AI speech recognition.

## Data Collection and Processing

### Audio Data
- Subly captures audio **only** from the active browser tab when you explicitly click "Start"
- Audio is processed **entirely on your device** using a local Whisper AI model running in your browser
- **No audio data is sent to any server** — all speech-to-text processing happens locally
- Audio capture stops immediately when you click "Stop" or close the tab

### Translation Data (Turkish Translation Mode Only)
- When using "Translate to Turkish" mode, the **transcribed text** (not audio) is sent to Google Translate to perform the translation
- No other mode sends data externally
- "Transcribe" and "Translate to English" modes are fully local

### Model Downloads
- On first use, Subly downloads the Whisper AI model (~75 MB) from Hugging Face (huggingface.co)
- The model is cached locally in your browser and does not need to be re-downloaded
- No personal data is sent during model download

### Settings
- Your preferences (language, model size, font size, position) are stored locally using Chrome's built-in storage API
- Settings are never transmitted externally

## Data We Do NOT Collect

- No audio recordings
- No transcription text (except Turkish translation via Google Translate)
- No browsing history
- No personal information
- No analytics or telemetry
- No cookies or tracking

## Permissions Explained

| Permission | Why |
|---|---|
| `tabCapture` | Capture audio from the active tab for transcription |
| `offscreen` | Run the AI model in a background document |
| `activeTab` | Access the current tab to overlay subtitles |
| `storage` | Save your preferences locally |
| `scripting` | Inject the subtitle overlay into web pages |

## Third-Party Services

- **Hugging Face** (huggingface.co): Model file hosting only. No user data sent.
- **Google Translate** (translate.googleapis.com): Used only in "Translate to Turkish" mode. Transcribed text is sent for translation. See [Google's Privacy Policy](https://policies.google.com/privacy).

## Contact

For questions about this privacy policy, open an issue at [github.com/geryit/subly](https://github.com/geryit/subly).

## Changes

We may update this policy as features change. Check this page for the latest version.

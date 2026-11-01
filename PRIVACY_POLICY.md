# Subly Privacy Policy

**Last updated:** November 2, 2026

## What Subly Does

Subly is a Chrome extension that adds live subtitles to HTML5 videos by capturing tab audio and turning speech into text with AI speech recognition.

## Data Collection and Processing

### Audio Data
- Subly captures audio **only** from the active browser tab, and only after you click "Start subtitles"
- Audio capture stops immediately when you click "Stop subtitles" or close the tab
- Where the audio goes depends on the model you choose:
  - **Local models (Tiny, Base, Small, Large v3 Turbo):** audio is processed **entirely on your device** by a Whisper model running in your browser. No audio leaves your device.
  - **Cloud models (Groq, OpenAI, Deepgram, Google Gemini):** short audio clips (about 5 seconds each) are sent to the provider you selected, using your own API key, so the provider can return the text. Subly does not send audio anywhere else.

### Translation Data
- When you pick a "Translate to ..." option, **Google Translate** receives the **transcribed text** (not audio), except in these cases:
  - "Translate to English" with Tiny, Base, Small, Groq or OpenAI, because Whisper translates to English itself
  - Any translation with Google Gemini, because Gemini translates itself
- "Transcribe" mode never sends text to Google Translate

### API Keys
- Cloud models need an API key that you get from the provider
- Keys are stored with Chrome's storage API (`chrome.storage.sync`). If Chrome sync is on, Chrome syncs them across your signed-in browsers like your other extension settings
- Keys are sent only to the provider they belong to, to authenticate your requests

### Model Downloads
- On first use, a local model (about 41 MB to 760 MB depending on size) is downloaded from Hugging Face (huggingface.co)
- The model is cached locally in your browser and does not need to be re-downloaded
- No personal data is sent during model download

### Settings
- Your preferences (video language, subtitle mode, model, font size, position) are stored with Chrome's storage API
- Subly never sends your settings to its own servers or to any third party (Subly has no servers)

## Data We Do NOT Collect

- No audio recordings are stored by Subly
- No transcription history is stored by Subly
- No browsing history
- No personal information
- No analytics or telemetry
- No cookies or tracking

## Permissions Explained

| Permission | Why |
|---|---|
| `tabCapture` | Capture audio from the active tab for transcription |
| `offscreen` | Run speech recognition in a background document |
| `activeTab` | Access the current tab to show subtitles |
| `storage` | Save your preferences and API keys |
| Host access (all sites) | Show the subtitle overlay on videos on any website |

## Third-Party Services

Each service below is used only when the matching feature is in use. Its own privacy policy applies to the data it receives.

- **Hugging Face** (huggingface.co): local model file hosting. No user data sent.
- **Groq** (api.groq.com): receives audio clips when the Groq model is selected. [Privacy Policy](https://groq.com/privacy-policy/)
- **OpenAI** (api.openai.com): receives audio clips when the OpenAI model is selected. [Privacy Policy](https://openai.com/policies/privacy-policy/)
- **Deepgram** (api.deepgram.com): receives audio clips when the Deepgram model is selected. [Privacy Policy](https://deepgram.com/privacy)
- **Google Gemini** (generativelanguage.googleapis.com): receives audio clips when the Gemini model is selected. [Gemini API Terms](https://ai.google.dev/gemini-api/terms)
- **Google Translate** (translate.googleapis.com): receives transcribed text in the translation cases listed above. [Google Privacy Policy](https://policies.google.com/privacy)

## Contact

For questions about this privacy policy, open an issue at [github.com/geryit/subly](https://github.com/geryit/subly).

## Changes

We may update this policy as features change. Check this page for the latest version.

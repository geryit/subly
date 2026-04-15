import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Subly',
  version: '0.1.1',
  description: 'Live AI subtitles for any HTML5 video',
  action: {
    default_popup: 'src/popup/popup.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
  permissions: ['activeTab', 'tabCapture', 'offscreen', 'storage'],
  host_permissions: ['<all_urls>'],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [
    {
      resources: [
        'src/offscreen/offscreen.html',
        'audio-collector.js',
        'ort/*',
        'icons/*',
      ],
      matches: ['<all_urls>'],
    },
  ],
  icons: {
    16: 'icons/16.png',
    48: 'icons/48.png',
    128: 'icons/128.png',
  },
});

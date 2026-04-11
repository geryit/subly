import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        // CRXJS v2 only auto-discovers HTML entries from a fixed set of
        // manifest keys (popup, options, sandbox, etc). Offscreen documents
        // are not in that list, so we register the HTML as an explicit
        // Rollup input to get its <script> tags bundled and rewritten.
        offscreen: 'src/offscreen/offscreen.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});

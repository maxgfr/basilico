import { defineConfig } from 'vite'
import { resolve } from 'node:path'

/**
 * An MV3 extension has no single entry point: the service worker, the content
 * script, the offscreen document and the popup are each loaded separately by
 * Chrome.
 *
 * So every output keeps a fixed name and is not split into chunks:
 * `manifest.json` references precise files, and a content script cannot load a
 * chunk. Name hashing is off for the same reason.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    // Vite 8 runs on Rolldown: the key is no longer `rollupOptions`.
    rolldownOptions: {
      input: {
        background: resolve(import.meta.dirname, 'src/background.ts'),
        content: resolve(import.meta.dirname, 'src/content.ts'),
        popup: resolve(import.meta.dirname, 'popup.html'),
        offscreen: resolve(import.meta.dirname, 'offscreen.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
        // A content script is injected as-is: it cannot import a chunk.
        inlineDynamicImports: false,
      },
    },
  },
})

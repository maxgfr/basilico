import { defineConfig } from 'vite'
import { resolve } from 'node:path'

/**
 * Separate build for the content script.
 *
 * An MV3 content script is injected as a classic script, not a module: it can
 * neither import nor load a shared chunk. The main build, on the other hand,
 * benefits from sharing `protocol.ts` between the service worker and the popup.
 * Hence two configurations rather than one that would suit neither.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    // The main build already ran: on no account empty the directory.
    emptyOutDir: false,
    target: 'chrome116',
    rolldownOptions: {
      input: resolve(import.meta.dirname, 'src/content.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
})

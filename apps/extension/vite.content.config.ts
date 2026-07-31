import { defineConfig } from 'vite'
import { resolve } from 'node:path'

/**
 * Build séparé du content script.
 *
 * Un content script MV3 est injecté comme script classique, pas comme module :
 * il ne peut ni importer, ni charger un chunk partagé. Le build principal, lui,
 * a tout intérêt à partager `protocol.ts` entre le service worker et le popup.
 * D'où deux configurations plutôt qu'une seule qui conviendrait mal aux deux.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    // Le build principal est déjà passé : on ne vide surtout pas le dossier.
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

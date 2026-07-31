import { defineConfig } from 'vite'
import { resolve } from 'node:path'

/**
 * Une extension MV3 n'a pas d'entrée unique : le service worker, le content
 * script, le document offscreen et le popup sont chargés séparément par Chrome.
 *
 * Chaque sortie garde donc un nom fixe et n'est pas découpée en morceaux :
 * `manifest.json` référence des fichiers précis, et un content script ne sait
 * pas charger un chunk. Le hachage des noms est désactivé pour la même raison.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    // Vite 8 tourne sur Rolldown : la clé n'est plus `rollupOptions`.
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
        // Un content script est injecté tel quel : il ne peut pas importer de chunk.
        inlineDynamicImports: false,
      },
    },
  },
})

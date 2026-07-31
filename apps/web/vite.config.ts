/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Le site est publié sur https://maxgfr.github.io/basilico/ : le `base` doit valoir
// '/basilico/' en CI et '/' partout ailleurs, sinon `vite dev`, `vite preview` et
// Vitest travaillent sur des chemins qui n'existent pas en local.
const base = process.env.GITHUB_ACTIONS ? '/basilico/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        // Nom versionné et purge des anciens : l'origine `maxgfr.github.io` est
        // partagée avec les autres projets Pages du compte.
        cacheId: 'basilico-v1',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      manifest: {
        // Toutes les URL sont relatives au manifeste : un `start_url` absolu
        // ouvrirait maxgfr.github.io au lieu de basilico une fois l'app installée.
        id: '/basilico/',
        name: 'basilico — minuteur de focus',
        short_name: 'basilico',
        description:
          'Un minuteur de focus local-first : sessions, tâches, statistiques et alertes, sans compte ni serveur.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0b0f0e',
        theme_color: '#0b0f0e',
        lang: 'fr',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    alias: {
      // Module virtuel fabriqué au build par vite-plugin-pwa : introuvable en test.
      'virtual:pwa-register': new URL('./src/test/pwa-register-stub.ts', import.meta.url).pathname,
    },
    environment: 'jsdom',
    globals: true,
    // Les specs Playwright vivent dans e2e/ et n'ont rien à faire ici : Vitest 4
    // a resserré ses exclusions par défaut et les ramasserait sinon.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
})

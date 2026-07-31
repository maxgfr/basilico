/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The site is published at https://maxgfr.github.io/basilico/: `base` must be
// '/basilico/' in CI and '/' everywhere else, otherwise `vite dev`,
// `vite preview` and Vitest work against paths that don't exist locally.
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
        // Versioned name and old-cache purge: the `maxgfr.github.io` origin is
        // shared with the account's other Pages projects.
        cacheId: 'basilico-v1',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      manifest: {
        // Every URL is relative to the manifest: an absolute `start_url` would
        // open maxgfr.github.io instead of basilico once the app is installed.
        id: '/basilico/',
        name: 'basilico — focus timer',
        short_name: 'basilico',
        description:
          'A local-first focus timer: sessions, tasks, stats and alerts. No account, no server.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0b0f0e',
        theme_color: '#0b0f0e',
        lang: 'en',
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
      // Virtual module produced at build time by vite-plugin-pwa: absent in tests.
      'virtual:pwa-register': new URL('./src/test/pwa-register-stub.ts', import.meta.url).pathname,
    },
    environment: 'jsdom',
    globals: true,
    // Playwright specs live in e2e/ and have no business here: Vitest 4 tightened
    // its default exclusions and would otherwise pick them up.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
})

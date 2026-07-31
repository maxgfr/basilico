/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Le site est publié sur https://maxgfr.github.io/basilico/ : le `base` doit valoir
// '/basilico/' en CI et '/' partout ailleurs, sinon `vite dev`, `vite preview` et
// Vitest travaillent sur des chemins qui n'existent pas en local.
const base = process.env.GITHUB_ACTIONS ? '/basilico/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
})

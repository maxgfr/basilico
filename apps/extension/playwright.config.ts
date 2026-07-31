import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Chaque test charge sa propre instance de navigateur avec l'extension :
  // les faire tourner en parallèle multiplie les profils pour rien.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
})

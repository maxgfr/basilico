import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Each test loads its own browser instance with the extension: running them in
  // parallel multiplies profiles for no benefit.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
})

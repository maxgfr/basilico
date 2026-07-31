import { defineConfig } from 'vitest/config'

/**
 * The extension has no unit tests: its logic is the MV3 wiring, which can only
 * be exercised with the extension actually loaded into Chromium. Those tests
 * live in `e2e/` and run under Playwright, not here.
 */
export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})

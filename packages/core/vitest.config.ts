import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Aggregations reason in local days: without a fixed timezone, the midnight
    // and daylight-saving tests would pass or fail depending on the machine.
    env: { TZ: 'Europe/Paris' },
    coverage: {
      provider: 'v8',
      // Vitest 4 removed `coverage.all`: without an explicit `include`, coverage
      // only counts files the tests imported and reports a flattering, wrong score.
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts'],
    },
  },
})

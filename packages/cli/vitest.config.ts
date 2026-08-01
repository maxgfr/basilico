import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Same reason as the core: "today" is a local day, and a floating timezone
    // would make the day-rollover tests pass or fail by machine.
    env: { TZ: 'Europe/Paris' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/main.ts', 'src/**/*.test.ts'],
    },
  },
})

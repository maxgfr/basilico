import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Les agrégations raisonnent en jours locaux : sans fuseau fixe, les tests de
    // minuit et de changement d'heure passeraient ou non selon la machine.
    env: { TZ: 'Europe/Paris' },
    coverage: {
      provider: 'v8',
      // Vitest 4 a supprimé `coverage.all` : sans `include` explicite, la couverture
      // ne compte que les fichiers importés par les tests et affiche un score faux.
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts'],
    },
  },
})

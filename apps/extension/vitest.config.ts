import { defineConfig } from 'vitest/config'

/**
 * L'extension n'a pas de tests unitaires : sa logique tient dans le câblage MV3,
 * qui ne s'éprouve qu'avec l'extension réellement chargée dans Chromium. Ces
 * tests-là vivent dans `e2e/` et se lancent avec Playwright, pas ici.
 */
export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})

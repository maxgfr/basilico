import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Audit automatisé WCAG 2.1 AA sur chaque écran, dans les deux thèmes.
 *
 * axe ne trouve qu'une partie des problèmes — il ne juge ni la pertinence d'un
 * libellé ni l'ordre de lecture — mais il attrape sans discussion les contrastes
 * insuffisants, les champs sans étiquette et les rôles mal employés, c'est-à-dire
 * exactement ce qui se glisse dans une interface au fil des retouches.
 */
const SCREENS = [
  { name: 'minuteur', hash: '' },
  { name: 'statistiques', hash: '#/stats' },
  { name: 'réglages', hash: '#/reglages' },
] as const

for (const theme of ['dark', 'light'] as const) {
  for (const screen of SCREENS) {
    test(`aucune violation d'accessibilité — ${screen.name}, thème ${theme}`, async ({ page }) => {
      await page.goto('/')
      await page.evaluate((theme) => {
        const raw = JSON.parse(localStorage.getItem('basilico:v1:app') ?? '{"state":{}}')
        raw.state.settings = { ...raw.state.settings, theme }
        // Un peu de contenu : une page vide ne teste presque rien.
        raw.state.tasks = [
          {
            id: 't1',
            title: 'Écrire le noyau',
            notes: null,
            tag: 'basilico',
            estimatedPomodoros: 3,
            completedPomodoros: 1,
            status: 'active',
            order: 0,
            createdAt: Date.now(),
            completedAt: null,
          },
        ]
        raw.state.activeTaskId = 't1'
        raw.state.sessions = [
          {
            id: 's1',
            mode: 'focus',
            startedAt: Date.now() - 3_600_000,
            endedAt: Date.now() - 2_100_000,
            plannedMs: 1_500_000,
            actualMs: 1_500_000,
            overtimeMs: 0,
            outcome: 'completed',
            taskId: 't1',
            tag: 'basilico',
            interruptions: { internal: 1, external: 0 },
            intention: null,
            note: null,
            rating: null,
          },
        ]
        localStorage.setItem('basilico:v1:app', JSON.stringify(raw))
      }, theme)

      await page.goto(`/${screen.hash}`)
      await page.waitForTimeout(300)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
}

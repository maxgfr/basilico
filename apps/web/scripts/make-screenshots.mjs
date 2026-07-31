/**
 * Produit les captures du README à partir de la version buildée.
 *
 * `pnpm preview` doit tourner sur le port 4173. On sème des données de
 * démonstration crédibles — clairement synthétiques, jamais présentées comme
 * réelles — puis on capture chaque écran dans les deux thèmes.
 *
 * L'horloge n'est pas simulée : une horloge factice gèle la frise d'animation
 * de Chromium et l'anneau de progression sortirait vide sur les captures.
 */
import { chromium, devices } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const OUT = process.env.OUT ?? '../../docs/images'

const seed = async (page, { theme }) => {
  await page.goto(BASE)
  await page.evaluate(
    ({ theme }) => {
      const DAY = 86_400_000
      const now = Date.now()

      const tasks = [
        ['t1', 'Écrire le noyau de domaine', 'basilico', 5, 3, 'active'],
        ['t2', 'Relire la revue de code', 'boulot', 2, 0, 'active'],
        ['t3', 'Préparer la démo de vendredi', 'boulot', 3, 4, 'done'],
      ].map(([id, title, tag, estimated, completed, status], order) => ({
        id,
        title,
        notes: null,
        tag,
        estimatedPomodoros: estimated,
        completedPomodoros: completed,
        status,
        order,
        createdAt: now,
        completedAt: status === 'done' ? now : null,
      }))

      const sessions = []
      for (let d = 150; d >= 0; d--) {
        if (d % 7 === 5 || d % 11 === 3) continue
        const count = 1 + ((d * 7) % 5)
        for (let i = 0; i < count; i++) {
          const startedAt = now - d * DAY - (7 - i) * 3_600_000
          sessions.push({
            id: `demo-${d}-${i}`,
            mode: 'focus',
            startedAt,
            endedAt: startedAt + 1_500_000,
            plannedMs: 1_500_000,
            actualMs: 1_500_000,
            overtimeMs: 0,
            outcome: (d + i) % 9 === 0 ? 'voided' : 'completed',
            taskId: i % 2 ? 't1' : 't3',
            tag: i % 2 ? 'basilico' : 'boulot',
            interruptions: {
              internal: (d + i) % 3 === 0 ? 1 : 0,
              external: (d + i) % 5 === 0 ? 1 : 0,
            },
            intention: null,
            note: null,
            rating: null,
          })
        }
      }

      const raw = JSON.parse(localStorage.getItem('basilico:v1:app') ?? '{"state":{}}')
      raw.state.settings = { ...raw.state.settings, theme }
      raw.state.tasks = tasks
      raw.state.sessions = sessions
      raw.state.activeTaskId = 't1'
      raw.state.lastEnded = null
      raw.state.timer = {
        status: 'running',
        mode: 'focus',
        plannedMs: 1_500_000,
        startedAt: now - 440_000,
        endsAt: now + 1_060_000,
        pausedAt: null,
        pausedTotalMs: 0,
        focusSinceLongBreak: 1,
        interruptions: { internal: 1, external: 0 },
        taskId: 't1',
        intention: null,
      }
      localStorage.setItem('basilico:v1:app', JSON.stringify(raw))
    },
    { theme },
  )
  await page.reload()
  // Laisser la transition de l'anneau se terminer avant de figer l'image.
  await page.waitForTimeout(900)
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()

const SHOTS = [
  { file: 'timer.png', theme: 'dark', route: '', device: devices['Desktop Chrome'] },
  { file: 'timer-clair.png', theme: 'light', route: '', device: devices['Desktop Chrome'] },
  { file: 'stats.png', theme: 'dark', route: '#/stats', device: devices['Desktop Chrome'] },
  { file: 'reglages.png', theme: 'dark', route: '#/reglages', device: devices['Desktop Chrome'] },
  { file: 'mobile.png', theme: 'dark', route: '', device: devices['Pixel 7'] },
]

for (const shot of SHOTS) {
  const context = await browser.newContext({ ...shot.device })
  const page = await context.newPage()
  await seed(page, { theme: shot.theme })
  if (shot.route) {
    await page.goto(BASE + shot.route)
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${OUT}/${shot.file}` })
  await context.close()
  console.log(`${OUT}/${shot.file}`)
}

await browser.close()

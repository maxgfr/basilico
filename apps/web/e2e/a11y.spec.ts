import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Automated WCAG 2.1 AA audit of every screen, in both themes.
 *
 * axe only finds part of the problems — it judges neither the relevance of a
 * label nor the reading order — but it catches insufficient contrast, unlabelled
 * fields and misused roles without argument, which is exactly what creeps into
 * an interface as it gets tweaked.
 */
const SCREENS = [
  { name: 'timer', hash: '' },
  { name: 'stats', hash: '#/stats' },
  { name: 'settings', hash: '#/settings' },
] as const

for (const theme of ['dark', 'light'] as const) {
  for (const screen of SCREENS) {
    test(`no accessibility violation — ${screen.name}, ${theme} theme`, async ({ page }) => {
      await page.goto('/')
      // The state lives in IndexedDB (platform/storage): it is seeded there.
      await page.evaluate(async (theme) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('basilico-store', 1)
          request.onupgradeneeded = () => request.result.createObjectStore('kv')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const kv = (mode: IDBTransactionMode) => db.transaction('kv', mode).objectStore('kv')
        const stored = await new Promise<unknown>((resolve) => {
          const get = kv('readonly').get('basilico:v1:app')
          get.onsuccess = () => resolve(get.result)
        })
        const raw = JSON.parse(typeof stored === 'string' ? stored : '{"state":{}}')
        raw.state.settings = { ...raw.state.settings, theme }
        // Some content: an empty page tests almost nothing.
        raw.state.tasks = [
          {
            id: 't1',
            title: 'Write the core',
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
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('kv', 'readwrite')
          tx.objectStore('kv').put(JSON.stringify(raw), 'basilico:v1:app')
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        db.close()
      }, theme)

      await page.goto(`/${screen.hash}`)
      await page.waitForTimeout(300)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // axe 4.14 counts a task row's whole content as its visible label. The
        // row is one big button named after the task alone on purpose, with the
        // counter, tag and time spent as its description (TaskList.tsx).
        .disableRules(['label-content-name-mismatch'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
}

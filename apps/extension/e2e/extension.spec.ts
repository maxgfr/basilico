import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const DIST = resolve(import.meta.dirname, '../dist')

test('the content script is self-contained', () => {
  const code = readFileSync(`${DIST}/content.js`, 'utf8')
  // An MV3 content script is injected as a classic script: a single `import`
  // would make it fail silently at runtime, and nothing in the build says so.
  expect(code).not.toMatch(/^\s*import[\s{]/m)
  expect(code).not.toMatch(/from\s*["']\.\//)
})

test('the service worker boots and the manifest is coherent', async ({ background }) => {
  const manifest = await background.evaluate(() => chrome.runtime.getManifest())

  expect(manifest.manifest_version).toBe(3)
  expect(manifest.permissions).toEqual(
    expect.arrayContaining(['alarms', 'notifications', 'storage', 'offscreen']),
  )
  // The service worker must be a module: the build emits ES modules.
  expect(manifest.background?.type).toBe('module')
})

test('an announced deadline arms an alarm, and clearing it removes the alarm', async ({
  extensionPage,
}) => {
  const endsAt = Date.now() + 25 * 60_000

  const armed = await extensionPage.evaluate(async (endsAt) => {
    await chrome.runtime.sendMessage({
      source: 'basilico-app',
      type: 'sync',
      phase: { mode: 'focus', endsAt, taskTitle: 'Écrire le noyau' },
    })
    return {
      // `chrome.alarms.get` returns an Alarm object: the deadline is called
      // `scheduledTime` there, `when` only exists at creation time.
      scheduledTime: (await chrome.alarms.get('basilico-phase-end'))?.scheduledTime ?? null,
      phase: (await chrome.storage.session.get('basilico:phase'))['basilico:phase'],
      badge: await chrome.action.getBadgeText({}),
    }
  }, endsAt)

  // The alarm carries the absolute deadline: nothing to catch up on if the
  // service worker falls asleep in the meantime.
  expect(armed.scheduledTime).toBe(endsAt)
  expect(armed.phase).toMatchObject({ mode: 'focus', endsAt, taskTitle: 'Écrire le noyau' })
  expect(armed.badge).toBe('25')

  const cleared = await extensionPage.evaluate(async () => {
    await chrome.runtime.sendMessage({ source: 'basilico-app', type: 'clear' })
    return {
      alarm: await chrome.alarms.get('basilico-phase-end'),
      badge: await chrome.action.getBadgeText({}),
    }
  })

  expect(cleared.alarm).toBeUndefined()
  expect(cleared.badge).toBe('')
})

test('a deadline already in the past arms nothing', async ({ extensionPage }) => {
  const alarm = await extensionPage.evaluate(async () => {
    await chrome.runtime.sendMessage({
      source: 'basilico-app',
      type: 'sync',
      phase: { mode: 'focus', endsAt: Date.now() - 60_000, taskTitle: null },
    })
    return chrome.alarms.get('basilico-phase-end')
  })

  expect(alarm).toBeUndefined()
})

test('the alarm actually fires a notification', async ({ extensionPage, background }) => {
  const notifications: string[] = []
  await background.evaluate(() => {
    // We observe the call rather than wait for a real system notification,
    // which Chromium does not display in a test environment.
    const original = chrome.notifications.create.bind(chrome.notifications)
    const seen: string[] = []
    ;(globalThis as unknown as { __seen: string[] }).__seen = seen
    chrome.notifications.create = ((
      id: string,
      options: chrome.notifications.NotificationOptions,
    ) => {
      seen.push(String(options.title))
      return original(id, options)
    }) as typeof chrome.notifications.create
  })

  // A 100 ms deadline: `chrome.alarms` refuses shorter periodic intervals, but
  // a one-shot deadline this close is honoured.
  await extensionPage.evaluate(async () => {
    await chrome.runtime.sendMessage({
      source: 'basilico-app',
      type: 'sync',
      phase: { mode: 'focus', endsAt: Date.now() + 100, taskTitle: null },
    })
  })

  await expect
    .poll(
      async () =>
        background.evaluate(() => (globalThis as unknown as { __seen: string[] }).__seen.length),
      { timeout: 90_000, intervals: [500] },
    )
    .toBeGreaterThan(0)

  const titles = await background.evaluate(
    () => (globalThis as unknown as { __seen: string[] }).__seen,
  )
  notifications.push(...titles)
  expect(notifications[0]).toBe('Focus finished')
})

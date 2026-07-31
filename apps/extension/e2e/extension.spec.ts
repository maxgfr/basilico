import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const DIST = resolve(import.meta.dirname, '../dist')

test('le content script est autonome', () => {
  const code = readFileSync(`${DIST}/content.js`, 'utf8')
  // Un content script MV3 est injecté comme script classique : le moindre
  // `import` le ferait échouer silencieusement à l'exécution, et rien dans le
  // build ne le signale.
  expect(code).not.toMatch(/^\s*import[\s{]/m)
  expect(code).not.toMatch(/from\s*["']\.\//)
})

test('le service worker démarre et le manifeste est cohérent', async ({ background }) => {
  const manifest = await background.evaluate(() => chrome.runtime.getManifest())

  expect(manifest.manifest_version).toBe(3)
  expect(manifest.permissions).toEqual(
    expect.arrayContaining(['alarms', 'notifications', 'storage', 'offscreen']),
  )
  // Le service worker doit être un module : le build produit des ES modules.
  expect(manifest.background?.type).toBe('module')
})

test('une échéance annoncée arme une alarme, et son annulation la retire', async ({
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
      // `chrome.alarms.get` renvoie un objet Alarm : l'échéance s'y appelle
      // `scheduledTime`, `when` n'existe qu'à la création.
      scheduledTime: (await chrome.alarms.get('basilico-phase-end'))?.scheduledTime ?? null,
      phase: (await chrome.storage.session.get('basilico:phase'))['basilico:phase'],
      badge: await chrome.action.getBadgeText({}),
    }
  }, endsAt)

  // L'alarme porte l'échéance absolue : rien à rattraper si le service worker
  // s'endort entre-temps.
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

test('une échéance déjà passée n’arme rien', async ({ extensionPage }) => {
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

test('l’alarme déclenche bien une notification', async ({ extensionPage, background }) => {
  const notifications: string[] = []
  await background.evaluate(() => {
    // On observe l'appel plutôt que d'attendre une vraie notification système,
    // que Chromium n'affiche pas en environnement de test.
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

  // Échéance à 100 ms : `chrome.alarms` n'accepte pas de délai plus court en
  // périodique, mais une échéance ponctuelle proche est honorée.
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
  expect(notifications[0]).toBe('Focus terminé')
})

import { resolve } from 'node:path'
import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test'

const DIST = resolve(import.meta.dirname, '../dist')

/**
 * Charge réellement l'extension dans Chromium.
 *
 * C'est la seule façon d'éprouver le câblage MV3 — service worker de type
 * module, alarmes, `chrome.storage.session`, badge — qui ne se voit ni au
 * typecheck ni au build, et qui échoue silencieusement à l'exécution.
 *
 * Les messages partent d'une page d'extension et non du service worker :
 * Chrome ne délivre pas un message à son propre expéditeur, et c'est de toute
 * façon le chemin réel — la page parle, le service worker écoute.
 */
export const test = base.extend<{
  context: BrowserContext
  background: Worker
  extensionId: string
  extensionPage: Page
}>({
  // eslint-disable-next-line no-empty-pattern -- signature imposée par Playwright
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    })
    await use(context)
    await context.close()
  },

  background: async ({ context }, use) => {
    // Un service worker MV3 démarre à la demande : il peut ne pas être là tout de suite.
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await use(worker)
  },

  extensionId: async ({ background }, use) => {
    await use(new URL(background.url()).host)
  },

  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await use(page)
    await page.close()
  },
})

export const expect = test.expect

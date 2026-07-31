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
 * Actually loads the extension into Chromium.
 *
 * This is the only way to exercise the MV3 wiring — module-type service worker,
 * alarms, `chrome.storage.session`, badge — which neither typecheck nor build
 * can see, and which fails silently at runtime.
 *
 * Messages are sent from an extension page rather than the service worker:
 * Chrome does not deliver a message back to its own sender, and it is the real
 * path anyway — the page speaks, the service worker listens.
 */
export const test = base.extend<{
  context: BrowserContext
  background: Worker
  extensionId: string
  extensionPage: Page
}>({
  // eslint-disable-next-line no-empty-pattern -- signature imposed by Playwright
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    })
    await use(context)
    await context.close()
  },

  background: async ({ context }, use) => {
    // An MV3 service worker starts on demand: it may not be there immediately.
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

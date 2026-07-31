/**
 * Stand-in for the `virtual:pwa-register` virtual module under Vitest.
 *
 * The module is produced by vite-plugin-pwa at build time; in tests it does not
 * exist, and registering a service worker would make no sense in jsdom anyway.
 */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => {}
}

/**
 * Remplaçant du module virtuel `virtual:pwa-register` sous Vitest.
 *
 * Le module est fabriqué par vite-plugin-pwa au moment du build ; en test il
 * n'existe pas, et enregistrer un service worker n'aurait de toute façon aucun
 * sens dans jsdom.
 */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => {}
}

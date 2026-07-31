import '@testing-library/jest-dom/vitest'

/**
 * jsdom n'implémente pas `matchMedia`. On le comble ici plutôt que de truffer le
 * code applicatif de gardes défensives pour une API présente dans tous les vrais
 * navigateurs. Par défaut, aucune requête média ne correspond : les tests
 * s'exécutent donc en thème sombre, celui de l'app.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

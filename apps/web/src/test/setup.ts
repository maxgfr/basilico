import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement `matchMedia`. We fill the gap here rather than
 * littering application code with defensive guards for an API present in every
 * real browser. By default no media query matches, so tests run in the dark
 * theme — the app's own.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      // Component tests run as a pointer device: it is the branch most of the
      // interface assumes, and the touch one is covered end-to-end instead.
      matches: query.includes('hover: hover'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

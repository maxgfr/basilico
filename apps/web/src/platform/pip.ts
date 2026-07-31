import { useCallback, useEffect, useState } from 'react'

/**
 * Floating window through the Document Picture-in-Picture API.
 *
 * It is a real browser window, always on top, into which we render ordinary DOM
 * — not a video. Hence the need to copy the stylesheets over: it has its own
 * document.
 *
 * Chromium only for now. Elsewhere `supported` stays false and the option
 * simply isn't offered: no degraded imitation pretending to do the same thing.
 */

type PipApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
  window: Window | null
}

function api(): PipApi | null {
  return (globalThis as { documentPictureInPicture?: PipApi }).documentPictureInPicture ?? null
}

export const pipSupported = (): boolean => api() !== null

/**
 * Copies the main document's styles into the floating window.
 * `cssRules` throws on a cross-origin sheet: we fall back to a `<link>`, which
 * lets the browser fetch it again itself.
 */
function copyStyles(target: Window): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      const style = target.document.createElement('style')
      style.textContent = css
      target.document.head.append(style)
    } catch {
      if (!sheet.href) continue
      const link = target.document.createElement('link')
      link.rel = 'stylesheet'
      link.href = sheet.href
      target.document.head.append(link)
    }
  }

  // The theme lives on <html>: without it the floating window would always open
  // in the dark palette.
  const theme = document.documentElement.dataset.theme
  if (theme) target.document.documentElement.dataset.theme = theme
  target.document.body.style.margin = '0'
}

export function usePictureInPicture(): {
  supported: boolean
  window: Window | null
  toggle: () => Promise<void>
} {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  const toggle = useCallback(async () => {
    const pip = api()
    if (!pip) return

    if (pip.window) {
      pip.window.close()
      setPipWindow(null)
      return
    }

    try {
      // Must originate from a user gesture, otherwise the browser refuses.
      const target = await pip.requestWindow({ width: 300, height: 200 })
      copyStyles(target)
      target.addEventListener('pagehide', () => setPipWindow(null))
      setPipWindow(target)
    } catch {
      // Refused or closed immediately: nothing to report, the app carries on.
      setPipWindow(null)
    }
  }, [])

  useEffect(() => {
    return () => {
      api()?.window?.close()
    }
  }, [])

  return { supported: pipSupported(), window: pipWindow, toggle }
}

import { useCallback, useEffect, useState } from 'react'

/**
 * Fenêtre flottante via l'API Document Picture-in-Picture.
 *
 * C'est une vraie fenêtre de navigateur, toujours au-dessus des autres, dans
 * laquelle on rend du DOM ordinaire — pas une vidéo. D'où la nécessité de lui
 * recopier les feuilles de style : elle a son propre document.
 *
 * Chromium uniquement pour l'instant. Ailleurs, `supported` reste faux et
 * l'option n'est simplement pas proposée : pas d'imitation dégradée qui
 * prétendrait faire la même chose.
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
 * Recopie les styles du document principal dans la fenêtre flottante.
 * `cssRules` lève sur une feuille d'une autre origine : on retombe alors sur un
 * `<link>`, qui laisse le navigateur la recharger lui-même.
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

  // Le thème vit sur <html> : sans lui, la fenêtre flottante s'ouvrirait
  // systématiquement dans la palette sombre.
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
      // Doit partir d'un geste utilisateur, sinon le navigateur refuse.
      const target = await pip.requestWindow({ width: 300, height: 200 })
      copyStyles(target)
      target.addEventListener('pagehide', () => setPipWindow(null))
      setPipWindow(target)
    } catch {
      // Refus ou fermeture immédiate : rien à signaler, l'app continue.
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

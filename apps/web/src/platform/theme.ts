import { useEffect } from 'react'
import { useApp } from '../store/app'

const DARK = '#0b0f0e'
const LIGHT = '#f7faf8'

/**
 * Pose `data-theme` sur `<html>`, ce qui suffit à basculer toute l'interface :
 * la rampe de tokens est redéfinie en CSS, les composants n'ont pas de variante.
 */
export function useTheme(): void {
  const theme = useApp((s) => s.settings.theme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')

    const apply = () => {
      const light = theme === 'light' || (theme === 'system' && media.matches)
      document.documentElement.dataset.theme = light ? 'light' : 'dark'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', light ? LIGHT : DARK)
    }

    apply()
    // Suivre la préférence système en direct n'a de sens qu'en mode « système ».
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

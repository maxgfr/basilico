import { useEffect } from 'react'
import { useApp } from '../store/app'

const DARK = '#0b0f0e'
const LIGHT = '#f7faf8'

/**
 * Sets `data-theme` on `<html>`, which is enough to flip the whole interface:
 * the token ramp is redefined in CSS, components need no variant of their own.
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
    // Following the system preference live only makes sense in "auto" mode.
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

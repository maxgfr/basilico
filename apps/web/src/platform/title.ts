import { useEffect } from 'react'
import { remainingMs } from '@basilico/core'
import { useApp } from '../store/app'
import { useNow } from '../features/timer/runtime'
import { MODE_LABEL, formatClock } from '../lib/format'

const MODE_COLOR = {
  focus: '#5cc79a',
  shortBreak: '#6fb6e8',
  longBreak: '#d6b25e',
} as const

/**
 * Countdown in the tab title, and a favicon tinted by mode.
 *
 * This is the single most requested thing among users of web timers: being able
 * to work in another tab and still see the remaining time.
 */
export function useDocumentTitle(): void {
  const timer = useApp((s) => s.timer)
  const live = timer.status === 'running' || timer.status === 'overtime'
  // One second is plenty for a tab title: no need to repaint four times a second.
  const now = useNow(live, 1000)

  useEffect(() => {
    const remaining = remainingMs(timer, now)
    if (!live || remaining === null) {
      document.title = timer.status === 'paused' ? 'Paused — basilico' : 'basilico'
    } else {
      const clock = formatClock(Math.abs(remaining))
      const sign = remaining < 0 ? '+' : ''
      document.title = `${sign}${clock} · ${MODE_LABEL[timer.mode]} — basilico`
    }
  }, [timer, live, now])

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return
    const color = live ? MODE_COLOR[timer.mode] : '#4a5852'
    link.href = faviconFor(color)
  }, [timer.mode, live])
}

function faviconFor(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#1e2b26" stroke-width="4"/><circle cx="16" cy="16" r="13" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="81.68" stroke-dashoffset="20.42" transform="rotate(-90 16 16)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

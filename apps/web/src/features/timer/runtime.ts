import { useEffect, useState } from 'react'
import { useApp } from '../../store/app'

/** Slack after the deadline: a background `setTimeout` can fire ~1 s late. */
const DEADLINE_SLACK_MS = 60

/**
 * Display clock. Only runs while the page is visible and the timer is active: a
 * hidden tab burning CPU is exactly what gets it frozen by Chrome's Energy
 * Saver, and repainting off-screen is worth nothing anyway.
 */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    let id: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (id !== undefined || document.visibilityState !== 'visible') return
      setNow(Date.now())
      id = setInterval(() => setNow(Date.now()), intervalMs)
    }
    const stop = () => {
      if (id === undefined) return
      clearInterval(id)
      id = undefined
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, intervalMs])

  return now
}

/**
 * Drives the timer forward. Three complementary triggers:
 *
 * 1. a single `setTimeout` armed on the deadline — un-nested, so it escapes
 *    Chrome's intensive throttling and fires at worst a second late;
 * 2. visibility coming back, `pageshow` (bfcache) and window `focus`, which
 *    cover the case where the tab was frozen or the machine slept;
 * 3. the display tick, as a net for when everything else failed.
 */
export function useTimerRuntime(): void {
  const tick = useApp((s) => s.tick)
  const status = useApp((s) => s.timer.status)
  const endsAt = useApp((s) => s.timer.endsAt)
  const running = status === 'running' || status === 'overtime'

  useEffect(() => {
    if (!running || endsAt === null) return
    const delay = Math.max(0, endsAt - Date.now()) + DEADLINE_SLACK_MS
    const id = setTimeout(() => tick(Date.now()), delay)
    return () => clearTimeout(id)
  }, [running, endsAt, tick])

  useEffect(() => {
    const reconcile = () => tick(Date.now())
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reconcile()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', reconcile)
    window.addEventListener('focus', reconcile)
    reconcile()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', reconcile)
      window.removeEventListener('focus', reconcile)
    }
  }, [tick])
}

import { useEffect, useState } from 'react'
import { useApp } from '../../store/app'

/** Marge après l'échéance : un `setTimeout` peut tirer ~1 s en retard en arrière-plan. */
const DEADLINE_SLACK_MS = 60

/**
 * Horloge d'affichage. Ne tourne que si la page est visible et le minuteur actif :
 * un onglet caché qui consomme du CPU est exactement ce qui le fait geler par
 * l'économiseur d'énergie de Chrome, et le repaint n'a aucun intérêt hors écran.
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
 * Fait avancer le minuteur. Trois déclencheurs, complémentaires :
 *
 * 1. un unique `setTimeout` armé sur l'échéance — non imbriqué, il échappe au
 *    throttling agressif de Chrome et tire au pire une seconde trop tard ;
 * 2. le retour de visibilité, le `pageshow` (bfcache) et le `focus` fenêtre, qui
 *    rattrapent le cas où l'onglet a été gelé ou mis en veille ;
 * 3. le tick d'affichage, qui sert de filet quand tout le reste a échoué.
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

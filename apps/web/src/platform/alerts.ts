import { useEffect, useRef } from 'react'
import type { AlarmName } from './sound'
import { sound } from './sound'
import { notify } from './notifications'
import { createWakeLock } from './wakelock'
import { useApp } from '../store/app'
import { MODE_LABEL } from '../lib/format'

const NEXT_LABEL = {
  focus: 'Back to work.',
  shortBreak: 'Five minutes to breathe.',
  longBreak: 'Long break — actually get up.',
} as const

/**
 * Branche les alertes sur le minuteur : sonnerie programmée à l'avance,
 * notification, tic-tac et wake lock.
 */
export function useAlerts(): void {
  const timer = useApp((s) => s.timer)
  const settings = useApp((s) => s.settings)
  const drainEvents = useApp((s) => s.drainEvents)
  const pending = useApp((s) => s.pending)

  /** Échéance pour laquelle une sonnerie est déjà programmée sur l'horloge audio. */
  const scheduledFor = useRef<number | null>(null)
  const wakeLock = useRef<ReturnType<typeof createWakeLock> | null>(null)

  // Programmation de la sonnerie sur l'échéance absolue. C'est ce qui la fait
  // sonner à l'heure même si l'onglet est ralenti ou gelé entre-temps.
  useEffect(() => {
    const live = timer.status === 'running' || timer.status === 'overtime'
    if (!live || timer.endsAt === null || !settings.sound.enabled) {
      sound.cancel()
      scheduledFor.current = null
      return
    }
    const delay = timer.endsAt - Date.now()
    if (delay < 0) return
    sound.schedule(settings.sound.alarm as AlarmName, delay, settings.sound.volume)
    scheduledFor.current = timer.endsAt
  }, [
    timer.status,
    timer.endsAt,
    settings.sound.enabled,
    settings.sound.alarm,
    settings.sound.volume,
  ])

  // Tic-tac, uniquement pendant un focus actif.
  useEffect(() => {
    const ticking = settings.sound.ticking && timer.status === 'running' && timer.mode === 'focus'
    if (ticking) sound.startTicking(settings.sound.volume)
    else sound.stopTicking()
    return () => sound.stopTicking()
  }, [settings.sound.ticking, settings.sound.volume, timer.status, timer.mode])

  // Wake lock optionnel.
  useEffect(() => {
    wakeLock.current ??= createWakeLock()
    const lock = wakeLock.current
    lock.set(settings.wakeLock && timer.status === 'running')
    return () => {
      if (timer.status !== 'running') lock.set(false)
    }
  }, [settings.wakeLock, timer.status])

  useEffect(() => {
    return () => wakeLock.current?.dispose()
  }, [])

  // Effets de bord des événements du noyau : notification, et sonnerie de secours.
  useEffect(() => {
    if (pending.length === 0) return
    const events = drainEvents()

    for (const event of events) {
      if (event.type !== 'session-ended') continue

      // La sonnerie programmée a déjà retenti à l'heure. On ne rejoue que si
      // aucune n'était programmée pour cette échéance (fin manuelle, flowtime),
      // ou si le contexte audio a été interrompu entre-temps — le cas Safari.
      const wasScheduled = scheduledFor.current === event.record.endedAt
      if (settings.sound.enabled && (!wasScheduled || !sound.unlocked)) {
        void sound.unlock().then(() => {
          sound.playNow(settings.sound.alarm as AlarmName, settings.sound.volume)
        })
      }
      scheduledFor.current = null

      if (settings.notifications.enabled) {
        const finished = MODE_LABEL[event.record.mode]
        const next = useApp.getState().timer.mode
        void notify(`${finished} finished`, NEXT_LABEL[next])
      }
    }
  }, [pending, drainEvents, settings.sound, settings.notifications.enabled])
}

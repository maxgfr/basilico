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
 * Wires the alerts onto the timer: pre-scheduled alarm, notification, ticking
 * and wake lock.
 */
export function useAlerts(): void {
  const timer = useApp((s) => s.timer)
  const settings = useApp((s) => s.settings)
  const drainEvents = useApp((s) => s.drainEvents)
  const pending = useApp((s) => s.pending)

  /** Deadline an alarm is already scheduled for on the audio clock. */
  const scheduledFor = useRef<number | null>(null)
  const wakeLock = useRef<ReturnType<typeof createWakeLock> | null>(null)

  // Scheduling the alarm on the absolute deadline. That is what makes it ring
  // on time even if the tab gets throttled or frozen in the meantime.
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

  // Ticking, only during an active focus session.
  useEffect(() => {
    const ticking = settings.sound.ticking && timer.status === 'running' && timer.mode === 'focus'
    if (ticking) sound.startTicking(settings.sound.volume)
    else sound.stopTicking()
    return () => sound.stopTicking()
  }, [settings.sound.ticking, settings.sound.volume, timer.status, timer.mode])

  // Optional wake lock.
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

  // Side effects of the core's events: notification, and fallback alarm.
  useEffect(() => {
    if (pending.length === 0) return
    const events = drainEvents()

    for (const event of events) {
      if (event.type !== 'session-ended') continue

      // The scheduled alarm already rang on time. We only replay when none was
      // scheduled for this deadline (manual finish, flowtime), or when the audio
      // context got interrupted in the meantime — the Safari case.
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

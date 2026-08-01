import { Fragment, useMemo } from 'react'
import {
  dayKey,
  focusUntilLongBreak,
  isRunOpen,
  lastSession,
  sessionsBetween,
  startOfDay,
  summarize,
  type Mode,
  type Summary,
} from '@basilico/core'
import { useApp } from '../../store/app'
import { formatDuration } from '../../lib/format'

/**
 * Where you are, in words, under the ring.
 *
 * This replaces four 6px dots that could not say what they counted: filled and
 * empty were the same ink at that size, and the only explanation was an
 * `aria-label` sighted users never saw.
 *
 * Two scopes, because they answer different questions. **This run** is the
 * stretch you are in right now — it survives a reset and ends on an hour away
 * from the desk. **Today** is the local day, and it is the one that carries
 * over a lunch break. When they hold the same numbers only the run is shown:
 * repeating six figures under a timer is noise.
 */
export function CycleStats() {
  const sessions = useApp((s) => s.sessions)
  const timer = useApp((s) => s.timer)
  const settings = useApp((s) => s.settings)
  const runStartedAt = useApp((s) => s.runStartedAt)
  const resetsInRun = useApp((s) => s.resetsInRun)
  const resetsToday = useApp((s) => s.resetsToday)

  // Recomputed when the log changes, not on every tick: none of these numbers
  // moves while a phase runs down.
  const { run, today, todayResets } = useMemo(() => {
    const now = Date.now()
    const dayStart = startOfDay(now)
    const open = isRunOpen({
      runStartedAt,
      idle: timer.status === 'idle',
      lastEndedAt: lastSession(sessions)?.endedAt ?? null,
      now,
    })
    return {
      run:
        open && runStartedAt !== null
          ? summarize(sessionsBetween(sessions, runStartedAt, Number.MAX_SAFE_INTEGER))
          : null,
      today: summarize(sessionsBetween(sessions, dayStart, dayStart + 2 * 86_400_000)),
      // A tally from a day gone by is not today's, whatever it still holds.
      todayResets: resetsToday.day === dayKey(now) ? resetsToday.count : 0,
    }
  }, [sessions, timer.status, runStartedAt, resetsToday])

  const runParts = run ? countParts(run, resetsInRun) : null
  const todayParts = countParts(today, todayResets)
  // Identical figures twice over say nothing the first line did not.
  const showToday = runParts === null || runParts.join() !== todayParts.join()
  const anything = (runParts?.length ?? 0) > 1 || todayParts.length > 1

  return (
    <section
      aria-label="Where you are in the cycle"
      className="text-ink-600 flex flex-col items-center gap-1 text-xs"
    >
      <p>{cycleLine(timer.mode, focusUntilLongBreak(timer, settings))}</p>
      {anything && (
        <>
          {runParts && <Line label="This run" parts={runParts} />}
          {showToday && <Line label="Today" parts={todayParts} />}
        </>
      )}
    </section>
  )
}

function Line({ label, parts }: { label: string; parts: string[] }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
      <span className="text-ink-300">{label}</span>
      {parts.map((part, i) => (
        <Fragment key={part}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span className="tabular">{part}</span>
        </Fragment>
      ))}
    </p>
  )
}

/**
 * The figures worth reading, in the order they matter. A zero is dropped —
 * "0 skipped · 0 abandoned · 0 resets" is four words saying nothing — except
 * for the pomodoros, which are the point of the line and anchor it at zero.
 *
 * Every count is focus-only, so the line reads consistently as cycles: a
 * skipped break is not a cycle you skipped.
 */
function countParts(s: Summary, resets: number): string[] {
  const parts = [plural(s.completedFocus, 'done', 'done')]
  if (s.skippedFocus > 0) parts.push(`${s.skippedFocus} skipped`)
  if (s.voidedFocus > 0) parts.push(`${s.voidedFocus} abandoned`)
  if (resets > 0) parts.push(plural(resets, 'reset', 'resets'))
  // Guarded on what it renders, not on the milliseconds: a twenty-second focus
  // is above zero and still prints as "—", which reads as a broken field.
  const focus = formatDuration(s.focusMs)
  if (focus !== '—') parts.push(`${focus} focus`)
  const interruptions = s.interruptions.internal + s.interruptions.external
  if (interruptions > 0) parts.push(plural(interruptions, 'interruption', 'interruptions'))
  return parts
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function cycleLine(mode: Mode, left: number): string {
  if (mode === 'longBreak') return 'This is the long break.'
  // Owed rather than upcoming: a reset keeps the counter, so it can sit past
  // the threshold with the break still due.
  if (left === 0) return 'Long break next.'
  if (left === 1) {
    return mode === 'focus'
      ? 'Long break after this one.'
      : 'Long break after one more focus session.'
  }
  return `Long break after ${left} more focus sessions.`
}

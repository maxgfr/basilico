import { isCountedFocus } from './sessions'
import type { SessionRecord, Task } from './types'

/**
 * Every aggregation reasons in **local days**, computed through `Date`, which
 * handles daylight-saving shifts without millisecond arithmetic: a day is not
 * always 24 hours long.
 *
 * A session straddling midnight is counted on the day it started.
 */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** Local day key as `YYYY-MM-DD`: stable and sortable. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export type Summary = {
  focusMs: number
  overtimeMs: number
  breakMs: number
  completedFocus: number
  voidedFocus: number
  /**
   * Skipped phases, breaks included. `skippedFocus` is the focus-only count:
   * a line that reads "3 done, 1 skipped" mixes two scopes unless it uses that
   * one, since the counts around it are all focus-only.
   */
  skipped: number
  skippedFocus: number
  interruptions: { internal: number; external: number }
  /** Completed focus ÷ started focus, between 0 and 1. `null` when there are none. */
  completionRate: number | null
  /** Mean of the ratings actually given, `null` while none has been. */
  averageRating: number | null
}

export function summarize(sessions: readonly SessionRecord[]): Summary {
  const summary: Summary = {
    focusMs: 0,
    overtimeMs: 0,
    breakMs: 0,
    completedFocus: 0,
    voidedFocus: 0,
    skipped: 0,
    skippedFocus: 0,
    interruptions: { internal: 0, external: 0 },
    completionRate: null,
    averageRating: null,
  }

  let focusStarted = 0
  let ratings = 0
  let ratingTotal = 0
  for (const s of sessions) {
    summary.interruptions.internal += s.interruptions.internal
    summary.interruptions.external += s.interruptions.external
    if (s.outcome === 'skipped') summary.skipped++
    if (s.rating !== null) {
      ratings++
      ratingTotal += s.rating
    }

    if (s.mode === 'focus') {
      focusStarted++
      // A voided focus is still time spent: we count it, but it adds no
      // pomodoro. Ignoring it would show empty days for someone who did work.
      summary.focusMs += s.actualMs
      summary.overtimeMs += s.overtimeMs
      if (s.outcome === 'completed') summary.completedFocus++
      if (s.outcome === 'voided') summary.voidedFocus++
      if (s.outcome === 'skipped') summary.skippedFocus++
    } else {
      summary.breakMs += s.actualMs
    }
  }

  if (focusStarted > 0) summary.completionRate = summary.completedFocus / focusStarted
  if (ratings > 0) summary.averageRating = ratingTotal / ratings
  return summary
}

/**
 * The most recent focus sessions carrying something written by hand.
 *
 * An intention or a note nobody can read back is a field, not a feature — this
 * is what turns the log into something worth revisiting.
 */
export function annotatedSessions(sessions: readonly SessionRecord[], limit = 10): SessionRecord[] {
  return sessions
    .filter((s) => s.mode === 'focus' && (s.intention !== null || s.note !== null))
    .slice(-limit)
    .reverse()
}

export type DayBucket = { date: string; ts: number; focusMs: number; completedFocus: number }

/** Continuous daily series (empty days included) ending on the day of `endTs`. */
export function dailySeries(
  sessions: readonly SessionRecord[],
  days: number,
  endTs: number,
): DayBucket[] {
  const byDay = new Map<string, { focusMs: number; completedFocus: number }>()
  for (const s of sessions) {
    if (s.mode !== 'focus') continue
    const key = dayKey(s.startedAt)
    const bucket = byDay.get(key) ?? { focusMs: 0, completedFocus: 0 }
    bucket.focusMs += s.actualMs
    if (s.outcome === 'completed') bucket.completedFocus++
    byDay.set(key, bucket)
  }

  const out: DayBucket[] = []
  let cursor = startOfDay(addDays(endTs, -(days - 1)))
  for (let i = 0; i < days; i++) {
    const key = dayKey(cursor)
    const bucket = byDay.get(key)
    out.push({
      date: key,
      ts: cursor,
      focusMs: bucket?.focusMs ?? 0,
      completedFocus: bucket?.completedFocus ?? 0,
    })
    cursor = addDays(cursor, 1)
  }
  return out
}

/**
 * Run of consecutive days with at least one completed focus session.
 *
 * Today doesn't break the streak until it's over: we start from yesterday when
 * today is still empty, otherwise the app would announce a broken streak every
 * single morning.
 */
export function currentStreak(sessions: readonly SessionRecord[], todayTs: number): number {
  const active = new Set<string>()
  for (const s of sessions) {
    if (isCountedFocus(s)) active.add(dayKey(s.startedAt))
  }
  if (active.size === 0) return 0

  let cursor = startOfDay(todayTs)
  if (!active.has(dayKey(cursor))) cursor = addDays(cursor, -1)

  let streak = 0
  while (active.has(dayKey(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export type Distribution = { key: string; focusMs: number; completedFocus: number }

function distribute(
  sessions: readonly SessionRecord[],
  pick: (s: SessionRecord) => string | null,
): Distribution[] {
  const map = new Map<string, Distribution>()
  for (const s of sessions) {
    if (s.mode !== 'focus') continue
    const key = pick(s)
    if (key === null) continue
    const entry = map.get(key) ?? { key, focusMs: 0, completedFocus: 0 }
    entry.focusMs += s.actualMs
    if (s.outcome === 'completed') entry.completedFocus++
    map.set(key, entry)
  }
  return [...map.values()].toSorted((a, b) => b.focusMs - a.focusMs)
}

export const byTask = (sessions: readonly SessionRecord[]) => distribute(sessions, (s) => s.taskId)
export const byTag = (sessions: readonly SessionRecord[]) => distribute(sessions, (s) => s.tag)

/** Focus time per hour of the local day: 24 buckets, always filled. */
export function byHour(sessions: readonly SessionRecord[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0)
  for (const s of sessions) {
    if (s.mode !== 'focus') continue
    const h = new Date(s.startedAt).getHours()
    hours[h] = (hours[h] ?? 0) + s.actualMs
  }
  return hours
}

export type EstimationRow = {
  taskId: string
  title: string
  estimated: number
  actual: number
  /** > 1: underestimated. < 1: overestimated. */
  ratio: number
}

/**
 * Estimation accuracy, task by task: Cirillo's third objective, the one almost
 * no tool reports back even though it's the only one that teaches you something
 * about yourself.
 */
export function estimationAccuracy(tasks: readonly Task[]): {
  rows: EstimationRow[]
  /** Overall ratio, `null` until a completed task has at least one pomodoro. */
  overall: number | null
} {
  const rows: EstimationRow[] = []
  let estimated = 0
  let actual = 0

  for (const t of tasks) {
    if (t.status !== 'done' || t.completedPomodoros === 0) continue
    rows.push({
      taskId: t.id,
      title: t.title,
      estimated: t.estimatedPomodoros,
      actual: t.completedPomodoros,
      ratio: t.completedPomodoros / t.estimatedPomodoros,
    })
    estimated += t.estimatedPomodoros
    actual += t.completedPomodoros
  }

  return { rows, overall: estimated > 0 ? actual / estimated : null }
}

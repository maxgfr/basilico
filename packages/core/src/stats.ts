import { isCountedFocus } from './sessions'
import type { SessionRecord, Task } from './types'

/**
 * Toutes les agrégations raisonnent en **jours locaux**, calculés via `Date`,
 * ce qui gère les changements d'heure sans arithmétique sur des millisecondes :
 * un jour ne fait pas toujours 24 h.
 *
 * Une session à cheval sur minuit est comptée le jour où elle a commencé.
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

/** Clé de jour local au format `YYYY-MM-DD`, stable et triable. */
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
  skipped: number
  interruptions: { internal: number; external: number }
  /** Focus terminés ÷ focus démarrés, entre 0 et 1. `null` si aucun focus. */
  completionRate: number | null
}

export function summarize(sessions: readonly SessionRecord[]): Summary {
  const summary: Summary = {
    focusMs: 0,
    overtimeMs: 0,
    breakMs: 0,
    completedFocus: 0,
    voidedFocus: 0,
    skipped: 0,
    interruptions: { internal: 0, external: 0 },
    completionRate: null,
  }

  let focusStarted = 0
  for (const s of sessions) {
    summary.interruptions.internal += s.interruptions.internal
    summary.interruptions.external += s.interruptions.external
    if (s.outcome === 'skipped') summary.skipped++

    if (s.mode === 'focus') {
      focusStarted++
      // Le temps d'un focus annulé reste du temps passé : on le compte, mais il
      // n'ajoute pas de pomodoro. Ne pas le compter donnerait des journées à zéro
      // alors que la personne a travaillé.
      summary.focusMs += s.actualMs
      summary.overtimeMs += s.overtimeMs
      if (s.outcome === 'completed') summary.completedFocus++
      if (s.outcome === 'voided') summary.voidedFocus++
    } else {
      summary.breakMs += s.actualMs
    }
  }

  if (focusStarted > 0) summary.completionRate = summary.completedFocus / focusStarted
  return summary
}

export type DayBucket = { date: string; ts: number; focusMs: number; completedFocus: number }

/** Série journalière continue (jours vides inclus) se terminant le jour de `endTs`. */
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
 * Série de jours consécutifs avec au moins un focus terminé.
 *
 * La journée en cours ne casse pas la série tant qu'elle n'est pas finie : on
 * repart d'hier si aujourd'hui est encore vide, sinon l'app afficherait « série
 * rompue » tous les matins.
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

/** Minutes de focus par heure de la journée locale : 24 cases, toujours pleines. */
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
  /** > 1 : sous-estimé. < 1 : surestimé. */
  ratio: number
}

/**
 * Précision d'estimation, tâche par tâche : l'objectif III de Cirillo, celui que
 * pratiquement aucun outil ne restitue alors que c'est le seul qui apprend
 * quelque chose sur soi.
 */
export function estimationAccuracy(tasks: readonly Task[]): {
  rows: EstimationRow[]
  /** Ratio global, `null` tant qu'aucune tâche terminée n'a de pomodoro. */
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

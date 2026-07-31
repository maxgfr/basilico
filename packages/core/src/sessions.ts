import type { SessionRecord } from './types'

/**
 * The log is append-only: a recorded session is never recomputed, which makes
 * every statistic reproducible and the export trivial.
 *
 * One deliberate, bounded exception: the post-session annotation (note, rating,
 * tag) the user types right after it ends. It never touches durations or outcome.
 */
export function appendSession(
  log: readonly SessionRecord[],
  record: SessionRecord,
): SessionRecord[] {
  return [...log, record]
}

export type SessionAnnotation = {
  note?: string | null
  rating?: SessionRecord['rating']
  tag?: string | null
}

export function annotateSession(
  log: readonly SessionRecord[],
  id: string,
  patch: SessionAnnotation,
): SessionRecord[] {
  return log.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

/** Sessions within a time window, bounds in epoch ms, `to` excluded. */
export function sessionsBetween(
  log: readonly SessionRecord[],
  from: number,
  to: number,
): SessionRecord[] {
  return log.filter((s) => s.startedAt >= from && s.startedAt < to)
}

/** A focus session that counts: completed, neither voided nor skipped. */
export function isCountedFocus(session: SessionRecord): boolean {
  return session.mode === 'focus' && session.outcome === 'completed'
}

export function lastSession(log: readonly SessionRecord[]): SessionRecord | null {
  return log.length > 0 ? (log[log.length - 1] ?? null) : null
}

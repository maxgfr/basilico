import type { SessionRecord } from './types'

/**
 * Le journal est append-only : une session enregistrée n'est plus recalculée,
 * ce qui rend toutes les statistiques reproductibles et l'export trivial.
 *
 * Seule exception, volontaire et bornée : l'annotation post-session (note,
 * ressenti, tag), que l'utilisateur saisit juste après la fin. Elle ne touche
 * jamais aux durées ni au résultat.
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

/** Sessions d'une fenêtre temporelle, bornes en ms epoch, `to` exclu. */
export function sessionsBetween(
  log: readonly SessionRecord[],
  from: number,
  to: number,
): SessionRecord[] {
  return log.filter((s) => s.startedAt >= from && s.startedAt < to)
}

/** Un focus « qui compte » : terminé, ni annulé ni passé. */
export function isCountedFocus(session: SessionRecord): boolean {
  return session.mode === 'focus' && session.outcome === 'completed'
}

export function lastSession(log: readonly SessionRecord[]): SessionRecord | null {
  return log.length > 0 ? (log[log.length - 1] ?? null) : null
}

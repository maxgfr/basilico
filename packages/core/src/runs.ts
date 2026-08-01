/**
 * A **run** is one contiguous stretch at the desk — the thing you mean by "this
 * session" in ordinary speech. It is deliberately not the same object as a
 * `SessionRecord`, which is a single phase.
 *
 * Nothing in the append-only log marks where a run begins: the log is flat and
 * indexed by time. So a run is a start timestamp held next to the log, and this
 * module owns the one rule that says whether it is still the run you are in.
 */

/** Time away that ends a run. An hour: a lunch break is a new stretch. */
export const RUN_GAP_MS = 3_600_000

export type RunProbe = {
  runStartedAt: number | null
  /**
   * The timer is not running. A live phase is never a gap, however long it has
   * been going — in flowtime a focus session can pass an hour without closing
   * anything, and reading the log alone would declare the run stale while the
   * user is sitting there working.
   */
  idle: boolean
  /** End of the last recorded session, `null` when there is none. */
  lastEndedAt: number | null
  now: number
}

/**
 * Is the recorded run still the one in progress?
 *
 * A run ends on a **gap**, not on a reset. Reset is the way out of the cycle,
 * but counting "the resets in this run" would be meaningless if a reset closed
 * the run it is counted in — the number would always be zero.
 */
export function isRunOpen({ runStartedAt, idle, lastEndedAt, now }: RunProbe): boolean {
  if (runStartedAt === null) return false
  if (!idle) return true
  const lastActivity = Math.max(lastEndedAt ?? 0, runStartedAt)
  return now - lastActivity <= RUN_GAP_MS
}

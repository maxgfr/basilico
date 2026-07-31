/** The three phases of a cycle. */
export type Mode = 'focus' | 'shortBreak' | 'longBreak'

/**
 * Timer status.
 * `overtime` only exists when the settings allow it: the counter has passed zero
 * and keeps climbing instead of stopping.
 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'overtime'

export type InterruptionKind = 'internal' | 'external'

export type Interruptions = {
  internal: number
  external: number
}

/**
 * What gets persisted about the timer. No remaining duration is stored: only the
 * absolute deadline `endsAt` is, and the remaining time is recomputed from the
 * clock. Persisting a "remaining" would resurrect a stale timer on reload.
 */
export type TimerState = {
  status: TimerStatus
  mode: Mode
  /** Planned duration of the current phase, in ms. */
  plannedMs: number
  /** When the phase started (epoch ms), `null` until it does. */
  startedAt: number | null
  /** Absolute deadline (epoch ms). `null` while idle or paused. */
  endsAt: number | null
  /** When the timer was paused, `null` when it isn't. */
  pausedAt: number | null
  /** Total time spent paused during the current phase, in ms. */
  pausedTotalMs: number
  /** Focus sessions completed since the last long break: drives when it comes. */
  focusSinceLongBreak: number
  interruptions: Interruptions
  /** Task the current phase is attributed to. */
  taskId: string | null
  /** Tag inherited from that task, frozen at the time the phase started. */
  tag: string | null
  /** Intention jotted down before starting the phase. */
  intention: string | null
}

export type SessionOutcome = 'completed' | 'voided' | 'skipped'

/** Immutable record of a finished session. The log is append-only. */
export type SessionRecord = {
  id: string
  mode: Mode
  startedAt: number
  endedAt: number
  plannedMs: number
  /** Time actually spent, excluding pauses. */
  actualMs: number
  /** Time worked past zero (overtime mode), 0 otherwise. */
  overtimeMs: number
  outcome: SessionOutcome
  taskId: string | null
  tag: string | null
  interruptions: Interruptions
  intention: string | null
  note: string | null
  rating: 1 | 2 | 3 | 4 | 5 | null
}

export type TaskStatus = 'active' | 'done' | 'archived'

export type Task = {
  id: string
  title: string
  notes: string | null
  tag: string | null
  estimatedPomodoros: number
  completedPomodoros: number
  status: TaskStatus
  order: number
  createdAt: number
  completedAt: number | null
  /**
   * Local day key (`YYYY-MM-DD`) this task is planned for, or `null` while it
   * only sits in the backlog.
   *
   * Cirillo works with two sheets: an activity inventory that accumulates
   * everything, and a to-do-today sheet you compose each morning. Storing the
   * day rather than a boolean is what makes carry-over possible — a task still
   * planned for yesterday is visibly unfinished business.
   */
  plannedFor: string | null
}

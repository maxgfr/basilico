import {
  carryOver,
  createTimerState,
  dayKey,
  defaultSettings,
  normalizeTask,
  parseSettings,
  type SessionRecord,
  type Settings,
  type Task,
  type TimerState,
} from '@basilico/core'

/**
 * What the CLI keeps on disk. Deliberately the same object the web app
 * persists (`partialize` in `apps/web/src/store/app.ts`): the two halves of the
 * project describe one thing, and a field that existed on only one side would
 * be a field the export cannot carry.
 */
export type AppData = {
  settings: Settings
  timer: TimerState
  sessions: SessionRecord[]
  tasks: Task[]
  activeTaskId: string | null
  /** Last closed phase, for "your focus ended 12 minutes ago". */
  lastEnded: { record: SessionRecord; lateByMs: number } | null
  runStartedAt: number | null
  resetsInRun: number
  resetsToday: { day: string; count: number }
}

export function emptyData(settings: Settings = defaultSettings): AppData {
  return {
    settings,
    timer: createTimerState(settings),
    sessions: [],
    tasks: [],
    activeTaskId: null,
    lastEnded: null,
    runStartedAt: null,
    resetsInRun: 0,
    resetsToday: { day: '', count: 0 },
  }
}

/**
 * Reads whatever is on disk without ever throwing. A work log is not worth
 * losing to a stray byte, and `parseSettings` already refuses to throw for the
 * same reason.
 */
export function parseData(input: unknown, now: number): AppData {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Partial<AppData>
  const settings = parseSettings(raw.settings)
  const base = emptyData(settings)
  const resets = raw.resetsToday
  return {
    settings,
    timer: raw.timer ?? base.timer,
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    // Rolled forward on load, like the web app: a task still dated yesterday is
    // unfinished business, and left dated it drops silently out of today.
    tasks: carryOver((Array.isArray(raw.tasks) ? raw.tasks : []).map(normalizeTask), dayKey(now)),
    activeTaskId: raw.activeTaskId ?? null,
    lastEnded: raw.lastEnded ?? null,
    runStartedAt: raw.runStartedAt ?? null,
    resetsInRun: typeof raw.resetsInRun === 'number' ? raw.resetsInRun : 0,
    resetsToday:
      typeof resets?.day === 'string' && typeof resets.count === 'number'
        ? resets
        : { day: '', count: 0 },
  }
}

/** Resets recorded today, `0` once the day has turned over. */
export function resetsOn(data: AppData, now: number): number {
  return data.resetsToday.day === dayKey(now) ? data.resetsToday.count : 0
}

/** Adds one to both tallies, rolling the daily one over at midnight. */
export function countReset(
  data: AppData,
  now: number,
): Pick<AppData, 'resetsInRun' | 'resetsToday'> {
  const day = dayKey(now)
  return {
    resetsInRun: data.resetsInRun + 1,
    resetsToday:
      data.resetsToday.day === day ? { day, count: data.resetsToday.count + 1 } : { day, count: 1 },
  }
}

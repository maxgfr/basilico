import {
  addInterruption,
  advance,
  annotateSession,
  appendSession,
  archivedTasks,
  backlog,
  createBackup,
  createTask,
  createTimerState,
  creditPomodoro,
  dayKey,
  dayLoad,
  elapsedMs,
  finish,
  focusUntilLongBreak,
  isRunOpen,
  lastSession,
  parseBackup,
  parseTaskInput,
  pause,
  plannedFor,
  planTask,
  remainingMs,
  reset,
  resume,
  sessionsBetween,
  setTaskStatus,
  startOfDay,
  startPhase,
  summarize,
  visibleTasks,
  type Mode,
  type SessionRecord,
  type Summary,
  type Task,
  type TimerContext,
  type TimerResult,
  type TimerStatus,
} from '@basilico/core'
import { countReset, emptyData, resetsOn, type AppData } from './state'

export type Deps = {
  now: number
  uid: () => string
  /** Reads a file the user named, for `import`. Throws to report the failure. */
  readFile?: (path: string) => string
}

export type Counts = {
  done: number
  skipped: number
  abandoned: number
  resets: number
  focusMs: number
  interruptions: number
}

/** Everything `status` reports — and what every action reports back after it. */
export type View = {
  headline: string | null
  /** "Your focus ended 12 minutes ago", when the CLI closed a phase it found expired. */
  catchUp: string | null
  phase: {
    mode: Mode
    status: TimerStatus
    /** `null` in flowtime focus, where there is no deadline to count down to. */
    remainingMs: number | null
    elapsedMs: number
    plannedMs: number
  }
  cycle: { untilLongBreak: number; longBreakEvery: number }
  task: { id: string; title: string } | null
  intention: string | null
  /** `null` when no run is open — nobody has started anything for an hour. */
  run: Counts | null
  today: Counts
}

export type TaskRow = {
  id: string
  title: string
  tag: string | null
  estimated: number
  completed: number
  status: Task['status']
  plannedFor: string | null
  active: boolean
}

export type Output =
  | { kind: 'view'; view: View }
  | { kind: 'tasks'; today: TaskRow[]; backlog: TaskRow[]; archived: TaskRow[]; load: number }
  | { kind: 'stats'; scope: string; counts: Counts; completionRate: number | null }
  | { kind: 'text'; text: string; json: unknown }

export type Result = { ok: true; data: AppData; output: Output } | { ok: false; error: string }

const fail = (error: string): Result => ({ ok: false, error })

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

const ctxFor = (data: AppData, deps: Deps): TimerContext => ({
  now: deps.now,
  settings: data.settings,
  uid: deps.uid,
})

/** Applies a core result: append to the log, credit the task, remember the end. */
function commit(data: AppData, result: TimerResult): AppData {
  let sessions = data.sessions
  let tasks = data.tasks
  let lastEnded = data.lastEnded

  for (const event of result.events) {
    if (event.type !== 'session-ended') continue
    sessions = appendSession(sessions, event.record)
    if (event.record.mode === 'focus' && event.record.outcome === 'completed') {
      tasks = creditPomodoro(tasks, event.record.taskId)
    }
    lastEnded = { record: event.record, lateByMs: event.lateByMs }
  }

  return { ...data, timer: result.state, sessions, tasks, lastEnded }
}

/**
 * Brings the state up to date with the clock, before anything else happens.
 *
 * This is the `tick` the web app runs on every visibility change, and it is the
 * whole reason a CLI can drive this timer at all: nothing counts down, the
 * deadline is absolute, and a phase that expired while nobody was looking is
 * closed **at its real `endsAt`** rather than at the moment we noticed.
 *
 * It loops because one call closes one phase: a short break that came and went
 * inside the same absence has to be closed too. It converges because a phase
 * resumed after an absence starts *now*, so its deadline is in the future.
 */
export function reconcile(data: AppData, deps: Deps): AppData {
  let out = data
  for (let i = 0; i < 100; i++) {
    const result = advance(out.timer, ctxFor(out, deps))
    if (result.events.length === 0) return { ...out, timer: result.state }
    out = commit(out, result)
  }
  return out
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function countsOf(summary: Summary, resets: number): Counts {
  return {
    done: summary.completedFocus,
    // Focus-only, so every figure on one line shares a scope: a skipped break
    // is not a cycle you skipped.
    skipped: summary.skippedFocus,
    abandoned: summary.voidedFocus,
    resets,
    focusMs: summary.focusMs,
    interruptions: summary.interruptions.internal + summary.interruptions.external,
  }
}

export function viewOf(data: AppData, deps: Deps, headline: string | null = null): View {
  const { now } = deps
  const dayStart = startOfDay(now)
  const open = isRunOpen({
    runStartedAt: data.runStartedAt,
    idle: data.timer.status === 'idle',
    lastEndedAt: lastSession(data.sessions)?.endedAt ?? null,
    now,
  })
  const task = data.tasks.find((t) => t.id === data.timer.taskId) ?? null

  return {
    headline,
    // Only worth saying when it is genuinely late: the same minute of grace the
    // app uses before it decides the tab was asleep.
    catchUp:
      data.lastEnded && data.lastEnded.lateByMs > 60_000
        ? `Your ${MODE_WORD[data.lastEnded.record.mode]} ended ${minutesAgo(data.lastEnded.lateByMs)}. It was recorded at the right time.`
        : null,
    phase: {
      mode: data.timer.mode,
      status: data.timer.status,
      remainingMs: remainingMs(data.timer, now),
      elapsedMs: elapsedMs(data.timer, now),
      plannedMs: data.timer.plannedMs,
    },
    cycle: {
      untilLongBreak: focusUntilLongBreak(data.timer, data.settings),
      longBreakEvery: data.settings.longBreakEvery,
    },
    task: task ? { id: task.id, title: task.title } : null,
    intention: data.timer.intention,
    run:
      open && data.runStartedAt !== null
        ? countsOf(
            summarize(sessionsBetween(data.sessions, data.runStartedAt, Number.MAX_SAFE_INTEGER)),
            data.resetsInRun,
          )
        : null,
    today: countsOf(
      summarize(sessionsBetween(data.sessions, dayStart, dayStart + 2 * 86_400_000)),
      resetsOn(data, now),
    ),
  }
}

export const MODE_WORD: Record<Mode, string> = {
  focus: 'focus session',
  shortBreak: 'short break',
  longBreak: 'long break',
}

function minutesAgo(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`
}

const ok = (data: AppData, deps: Deps, headline: string | null = null): Result => ({
  ok: true,
  data,
  output: { kind: 'view', view: viewOf(data, deps, headline) },
})

// ---------------------------------------------------------------------------
// The phase commands
// ---------------------------------------------------------------------------

export function status(data: AppData, deps: Deps): Result {
  return ok(data, deps)
}

export function start(
  data: AppData,
  deps: Deps,
  options: { task?: string; intention?: string } = {},
): Result {
  if (data.timer.status !== 'idle') {
    return fail('A phase is already under way. Use pause, done, skip or abandon first.')
  }

  let activeTaskId = data.activeTaskId
  if (options.task !== undefined) {
    const found = findTask(data.tasks, options.task)
    if (!found.ok) return fail(found.error)
    activeTaskId = found.task.id
  }
  const task = data.tasks.find((t) => t.id === activeTaskId) ?? null

  // Starting is the only moment a run can begin, and so the only place that has
  // to ask whether the previous one is still going.
  const open = isRunOpen({
    runStartedAt: data.runStartedAt,
    idle: true,
    lastEndedAt: lastSession(data.sessions)?.endedAt ?? null,
    now: deps.now,
  })

  const next: AppData = {
    ...data,
    activeTaskId,
    runStartedAt: open ? data.runStartedAt : deps.now,
    resetsInRun: open ? data.resetsInRun : 0,
    lastEnded: null,
    timer: startPhase(data.timer, ctxFor(data, deps), {
      taskId: activeTaskId,
      // Frozen at start time: reading it back from the task later would rewrite
      // history the first time someone retags something.
      tag: task?.tag ?? null,
      intention: options.intention ?? null,
    }),
  }
  return ok(next, deps, `${capitalise(MODE_WORD[next.timer.mode])} started.`)
}

export function pauseCmd(data: AppData, deps: Deps): Result {
  if (data.timer.status !== 'running' && data.timer.status !== 'overtime') {
    return fail('Nothing is running.')
  }
  return ok({ ...data, timer: pause(data.timer, ctxFor(data, deps)) }, deps, 'Paused.')
}

export function resumeCmd(data: AppData, deps: Deps): Result {
  if (data.timer.status !== 'paused') return fail('Nothing is paused.')
  return ok({ ...data, timer: resume(data.timer, ctxFor(data, deps)) }, deps, 'Resumed.')
}

/**
 * The three ways to end a phase by hand, and what each one costs — the table in
 * `docs/design.md`. The vocabulary has to make the consequence obvious before
 * the command runs, because the log is append-only and none of it comes back.
 */
export function endPhase(
  data: AppData,
  deps: Deps,
  outcome: 'completed' | 'skipped' | 'voided',
): Result {
  if (data.timer.status === 'idle') return fail('No phase is under way.')
  if (outcome === 'voided' && data.timer.mode !== 'focus') {
    return fail('Only a focus session can be abandoned — a break costs no pomodoro. Use skip.')
  }

  const before = data.timer.mode
  const next = commit(data, finish(data.timer, ctxFor(data, deps), outcome))
  const said = {
    completed: `${capitalise(MODE_WORD[before])} counted.`,
    skipped: `${capitalise(MODE_WORD[before])} skipped — it keeps its time but no pomodoro.`,
    voided: 'Focus session abandoned — the time counts, the pomodoro does not.',
  }[outcome]
  const handover =
    next.timer.status === 'idle' ? '' : ` ${capitalise(MODE_WORD[next.timer.mode])} started.`
  return ok(next, deps, said + handover)
}

/**
 * The one action that records nothing, and so the one real way out of the
 * cycle. It is counted here rather than in the log precisely because of that.
 */
export function resetCmd(data: AppData, deps: Deps): Result {
  if (data.timer.status === 'idle') return fail('Nothing to reset.')
  const next: AppData = {
    ...data,
    timer: reset(data.timer, ctxFor(data, deps)),
    lastEnded: null,
    ...countReset(data, deps.now),
  }
  return ok(next, deps, 'Reset. Nothing was recorded.')
}

export function interruptCmd(data: AppData, deps: Deps, kind: string): Result {
  if (kind !== 'internal' && kind !== 'external') {
    return fail("An interruption is either 'internal' or 'external'.")
  }
  if (data.timer.status === 'idle') return fail('No phase is under way.')
  return ok(
    { ...data, timer: addInterruption(data.timer, kind) },
    deps,
    `Noted one ${kind} interruption.`,
  )
}

export function noteCmd(data: AppData, deps: Deps, text: string, rating: number | null): Result {
  if (!data.lastEnded) return fail('No session has ended yet.')
  if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return fail('A rating is a whole number from 1 to 5.')
  }

  const patch = { note: text || null, rating: (rating as SessionRecord['rating']) ?? null }
  const next: AppData = {
    ...data,
    sessions: annotateSession(data.sessions, data.lastEnded.record.id, patch),
    lastEnded: { ...data.lastEnded, record: { ...data.lastEnded.record, ...patch } },
  }
  return ok(next, deps, 'Noted.')
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function rowOf(task: Task, activeTaskId: string | null): TaskRow {
  return {
    id: task.id,
    title: task.title,
    tag: task.tag,
    estimated: task.estimatedPomodoros,
    completed: task.completedPomodoros,
    status: task.status,
    plannedFor: task.plannedFor,
    active: task.id === activeTaskId,
  }
}

type Found = { ok: true; task: Task } | { ok: false; error: string }

/** Resolves `--task`: an exact id, or a case-insensitive piece of a title. */
function findTask(tasks: readonly Task[], query: string): Found {
  const byId = tasks.find((t) => t.id === query)
  if (byId) return { ok: true, task: byId }

  const needle = query.toLowerCase()
  const matches = visibleTasks(tasks).filter((t) => t.title.toLowerCase().includes(needle))
  if (matches.length === 1 && matches[0]) return { ok: true, task: matches[0] }
  if (matches.length === 0) return { ok: false, error: `No task matches "${query}".` }
  return {
    ok: false,
    // Guessing between two tasks would attribute the work to the wrong one, and
    // a session's task is frozen at start time.
    error: `"${query}" matches ${matches.length} tasks: ${matches.map((t) => t.title).join(', ')}.`,
  }
}

export function listTasks(data: AppData, deps: Deps): Result {
  const day = dayKey(deps.now)
  return {
    ok: true,
    data,
    output: {
      kind: 'tasks',
      today: plannedFor(data.tasks, day).map((t) => rowOf(t, data.activeTaskId)),
      backlog: backlog(data.tasks).map((t) => rowOf(t, data.activeTaskId)),
      archived: archivedTasks(data.tasks).map((t) => rowOf(t, data.activeTaskId)),
      load: dayLoad(data.tasks, day).remaining,
    },
  }
}

export function addTask(data: AppData, deps: Deps, raw: string, estimate: number): Result {
  const { title, tag } = parseTaskInput(raw)
  if (title === '') return fail('A task needs a title.')

  const task = createTask(
    data.tasks,
    { title, tag, estimatedPomodoros: estimate },
    deps.now,
    deps.uid(),
  )
  const next: AppData = {
    ...data,
    tasks: [...data.tasks, task],
    activeTaskId: data.activeTaskId ?? task.id,
  }
  return listTasks(next, deps)
}

export function taskStatus(
  data: AppData,
  deps: Deps,
  query: string,
  status: Task['status'],
): Result {
  const found = findTask(data.tasks, query)
  if (!found.ok) return fail(found.error)

  const tasks = setTaskStatus(data.tasks, found.task.id, status, deps.now)
  const activeTaskId =
    status === 'active' || data.activeTaskId !== found.task.id ? data.activeTaskId : null
  return listTasks({ ...data, tasks, activeTaskId }, deps)
}

export function planTaskCmd(data: AppData, deps: Deps, query: string, day: string | null): Result {
  const found = findTask(data.tasks, query)
  if (!found.ok) return fail(found.error)
  return listTasks({ ...data, tasks: planTask(data.tasks, found.task.id, day) }, deps)
}

export function activateTask(data: AppData, deps: Deps, query: string): Result {
  const found = findTask(data.tasks, query)
  if (!found.ok) return fail(found.error)
  return listTasks({ ...data, activeTaskId: found.task.id }, deps)
}

// ---------------------------------------------------------------------------
// Stats, export, import
// ---------------------------------------------------------------------------

export function stats(data: AppData, deps: Deps, scope: 'run' | 'today' | 'all'): Result {
  const { now } = deps
  const dayStart = startOfDay(now)

  let sessions: readonly SessionRecord[] = data.sessions
  let resets = 0
  if (scope === 'today') {
    sessions = sessionsBetween(data.sessions, dayStart, dayStart + 2 * 86_400_000)
    resets = resetsOn(data, now)
  } else if (scope === 'run') {
    const open = isRunOpen({
      runStartedAt: data.runStartedAt,
      idle: data.timer.status === 'idle',
      lastEndedAt: lastSession(data.sessions)?.endedAt ?? null,
      now,
    })
    sessions =
      open && data.runStartedAt !== null
        ? sessionsBetween(data.sessions, data.runStartedAt, Number.MAX_SAFE_INTEGER)
        : []
    resets = open ? data.resetsInRun : 0
  }

  const summary = summarize(sessions)
  return {
    ok: true,
    data,
    output: {
      kind: 'stats',
      scope,
      counts: countsOf(summary, resets),
      completionRate: summary.completionRate,
    },
  }
}

export function exportCmd(data: AppData, deps: Deps): Result {
  const backup = createBackup(data.settings, data.sessions, data.tasks, deps.now)
  return {
    ok: true,
    data,
    output: { kind: 'text', text: JSON.stringify(backup, null, 2), json: backup },
  }
}

export function importCmd(raw: string): Result {
  const parsed = parseBackup(raw)
  if (!parsed.ok) return fail(parsed.error)

  const { settings, sessions, tasks } = parsed.backup
  // Everything is replaced, the run included: the state that arrives is not the
  // stretch of work you were in.
  const next: AppData = {
    ...emptyData(settings),
    sessions,
    tasks,
    timer: createTimerState(settings),
  }
  return {
    ok: true,
    data: next,
    output: {
      kind: 'text',
      text: `Imported ${sessions.length} sessions and ${tasks.length} tasks.`,
      json: { sessions: sessions.length, tasks: tasks.length },
    },
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

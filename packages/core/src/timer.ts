import type { InterruptionKind, Mode, SessionOutcome, SessionRecord, TimerState } from './types'
import { plannedMsFor, type Settings } from './settings'

/**
 * Past this much lateness we stop auto-starting the next phase: the tab was
 * closed or frozen, and picking up a break that was due an hour ago makes no
 * sense. The app shows "ended X ago" and hands control back.
 *
 * Unless the cycle is set to never stop on its own — see `closePhase`.
 */
export const CATCH_UP_GRACE_MS = 60_000

export type TimerContext = {
  /** Current instant (epoch ms). Always injected: the core never reads the clock. */
  now: number
  settings: Settings
  uid: () => string
}

export type TimerEvent =
  | { type: 'session-ended'; record: SessionRecord; lateByMs: number }
  | { type: 'overtime-started'; mode: Mode }
  | { type: 'phase-started'; mode: Mode }

export type TimerResult = { state: TimerState; events: TimerEvent[] }

/** Who ended a phase: the user (`manual`) or its own deadline (`elapsed`). */
type CloseIntent = 'manual' | 'elapsed'

export function createTimerState(settings: Settings): TimerState {
  return {
    status: 'idle',
    mode: 'focus',
    plannedMs: plannedMsFor(settings, 'focus'),
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    focusSinceLongBreak: 0,
    interruptions: { internal: 0, external: 0 },
    taskId: null,
    tag: null,
    intention: null,
  }
}

/** In flowtime a focus session has no deadline: it runs until you stop it. */
function hasDeadline(mode: Mode, settings: Settings): boolean {
  return !(settings.mode === 'flowtime' && mode === 'focus')
}

/** Effective clock: frozen at the moment of pausing while the timer is paused. */
function clockOf(state: TimerState, now: number): number {
  return state.status === 'paused' && state.pausedAt !== null ? state.pausedAt : now
}

/**
 * Remaining time in ms, negative in overtime. `null` when the phase has no
 * deadline (focus in flowtime) — `elapsedMs` is what counts then.
 */
export function remainingMs(state: TimerState, now: number): number | null {
  if (state.endsAt === null) return state.status === 'idle' ? state.plannedMs : null
  return state.endsAt - clockOf(state, now)
}

/** Time actually elapsed on the phase, excluding pauses. Never negative. */
export function elapsedMs(state: TimerState, now: number): number {
  if (state.startedAt === null) return 0
  const raw = clockOf(state, now) - state.startedAt - state.pausedTotalMs
  return raw > 0 ? raw : 0
}

/** Progress from 0 to 1, capped at 1 even in overtime. */
export function progress(state: TimerState, now: number): number {
  if (state.plannedMs <= 0) return 0
  const done = elapsedMs(state, now) / state.plannedMs
  return done < 0 ? 0 : done > 1 ? 1 : done
}

/**
 * Which mode comes next, given how many focus sessions have happened since the
 * last long break.
 *
 * The threshold is a `>=` rather than a modulo: a voided focus doesn't count,
 * and with a modulo the long break that was due would simply be skipped.
 */
export function nextMode(mode: Mode, focusSinceLongBreak: number, settings: Settings): Mode {
  if (mode !== 'focus') return 'focus'
  return focusSinceLongBreak >= settings.longBreakEvery ? 'longBreak' : 'shortBreak'
}

/**
 * Focus sessions still to do before the long break falls due. `0` means the
 * long break is already owed — which a reset preserves, hence the clamp.
 *
 * The arithmetic lives here rather than in the interface so it cannot drift
 * from the `>=` in `nextMode`, which is what makes a due long break survive.
 */
export function focusUntilLongBreak(state: TimerState, settings: Settings): number {
  return Math.max(0, settings.longBreakEvery - state.focusSinceLongBreak)
}

/** Break length proposed in flowtime, proportional to the time worked. */
export function flowtimeBreakMs(workedMs: number, settings: Settings): number {
  return Math.max(60_000, Math.round(workedMs * settings.flowtimeBreakRatio))
}

export function startPhase(
  state: TimerState,
  ctx: TimerContext,
  options: {
    taskId?: string | null
    tag?: string | null
    intention?: string | null
    at?: number
  } = {},
): TimerState {
  const at = options.at ?? ctx.now
  // We start the duration already carried by the state, never one recomputed
  // from the settings: otherwise flowtime's proportional break would be
  // overwritten by the generic short-break duration. `applySettings` is the only
  // place that picks durations back up from the settings.
  return {
    ...state,
    status: 'running',
    startedAt: at,
    endsAt: hasDeadline(state.mode, ctx.settings) ? at + state.plannedMs : null,
    pausedAt: null,
    pausedTotalMs: 0,
    interruptions: { internal: 0, external: 0 },
    taskId: options.taskId !== undefined ? options.taskId : state.taskId,
    tag: options.tag !== undefined ? options.tag : state.tag,
    intention: options.intention !== undefined ? options.intention : state.intention,
  }
}

export function pause(state: TimerState, ctx: TimerContext): TimerState {
  if (state.status !== 'running' && state.status !== 'overtime') return state
  return { ...state, status: 'paused', pausedAt: ctx.now }
}

export function resume(state: TimerState, ctx: TimerContext): TimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state
  // Time spent paused pushes the deadline back by the same amount: a 3-minute
  // pause gives 3 minutes of work back, it doesn't steal them.
  const pausedFor = Math.max(0, ctx.now - state.pausedAt)
  return {
    ...state,
    status: state.endsAt !== null && state.endsAt + pausedFor <= ctx.now ? 'overtime' : 'running',
    endsAt: state.endsAt === null ? null : state.endsAt + pausedFor,
    pausedAt: null,
    pausedTotalMs: state.pausedTotalMs + pausedFor,
  }
}

/**
 * Resets without recording anything, and back to a focus phase.
 *
 * Reset is the way out of the cycle, and one that leaves you standing on a break
 * is not a way out: every phase you end by hand hands over the next one, so
 * after ending a session Reset was the natural next click — and it stranded you
 * on a short break the next Start would have run. The cycle begins at focus, so
 * this returns there.
 *
 * `focusSinceLongBreak` is deliberately untouched, and `nextMode` compares with
 * `>=`: a long break that was due is still due after a reset.
 */
export function reset(state: TimerState, ctx: TimerContext): TimerState {
  return {
    ...state,
    status: 'idle',
    mode: 'focus',
    plannedMs: plannedMsFor(ctx.settings, 'focus'),
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    interruptions: { internal: 0, external: 0 },
    intention: null,
  }
}

/**
 * Picks durations back up from the settings. No effect on a running phase:
 * changing "focus = 30 min" must not stretch the focus already under way.
 */
export function applySettings(state: TimerState, settings: Settings): TimerState {
  if (state.status !== 'idle') return state
  return { ...state, plannedMs: plannedMsFor(settings, state.mode) }
}

export function addInterruption(state: TimerState, kind: InterruptionKind): TimerState {
  return {
    ...state,
    interruptions: { ...state.interruptions, [kind]: state.interruptions[kind] + 1 },
  }
}

function buildRecord(
  state: TimerState,
  ctx: TimerContext,
  endedAt: number,
  outcome: SessionOutcome,
): SessionRecord {
  const startedAt = state.startedAt ?? endedAt
  const worked = Math.max(0, endedAt - startedAt - state.pausedTotalMs)
  const overtime = state.endsAt !== null && endedAt > state.endsAt ? endedAt - state.endsAt : 0
  return {
    id: ctx.uid(),
    mode: state.mode,
    startedAt,
    endedAt,
    plannedMs: state.plannedMs,
    actualMs: worked,
    overtimeMs: overtime,
    outcome,
    taskId: state.taskId,
    // The tag is frozen at start time rather than looked up later: renaming a
    // task's tag must not silently rewrite months of history.
    tag: state.tag,
    interruptions: { ...state.interruptions },
    intention: state.intention,
    note: null,
    rating: null,
  }
}

/**
 * Closes the current phase and prepares the next one.
 *
 * `endedAt` is the real end time, which is not necessarily `now`: if the tab was
 * frozen, the session ended at its deadline, not when we noticed. That's the
 * whole catch-up logic.
 *
 * `intent` says who ended it. The auto-start settings describe what the timer
 * may do *on its own*; they have no say over a phase the user ended by hand.
 */
function closePhase(
  state: TimerState,
  ctx: TimerContext,
  endedAt: number,
  outcome: SessionOutcome,
  intent: CloseIntent,
): TimerResult {
  const record = buildRecord(state, ctx, endedAt, outcome)
  const events: TimerEvent[] = [
    { type: 'session-ended', record, lateByMs: Math.max(0, ctx.now - endedAt) },
  ]

  const countsAsPomodoro = state.mode === 'focus' && outcome === 'completed'
  let focusSinceLongBreak = state.focusSinceLongBreak + (countsAsPomodoro ? 1 : 0)
  const next = nextMode(state.mode, focusSinceLongBreak, ctx.settings)
  if (state.mode === 'longBreak') focusSinceLongBreak = 0

  const plannedNext =
    ctx.settings.mode === 'flowtime' && next !== 'focus'
      ? flowtimeBreakMs(record.actualMs, ctx.settings)
      : plannedMsFor(ctx.settings, next)

  const idle: TimerState = {
    ...state,
    status: 'idle',
    mode: next,
    plannedMs: plannedNext,
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    focusSinceLongBreak,
    interruptions: { internal: 0, external: 0 },
    intention: null,
  }

  // Asking for the next phase by hand *is* the explicit request to carry on, so
  // the auto-start settings don't get a vote: they only govern what the timer
  // does unattended. `reset` stays the way out of the cycle — it is the one
  // action that records nothing.
  const autoStart =
    intent === 'manual'
      ? true
      : next === 'focus'
        ? ctx.settings.autoStartFocus
        : ctx.settings.autoStartBreaks
  // "Never stop on its own" means exactly that: an absence is not a reason to
  // break the cycle, only an explicit stop is.
  const endless = ctx.settings.autoStartBreaks && ctx.settings.autoStartFocus
  const lateBy = Math.max(0, ctx.now - endedAt)
  const justEnded = lateBy <= CATCH_UP_GRACE_MS

  if (autoStart && (justEnded || endless)) {
    // A phase that just ended chains from its own end, so the cycle stays
    // aligned. One resumed after an absence starts *now* instead — dating it
    // back would hand over an already-expired phase, and the next tick would
    // close that one too, and the one after it.
    const started = startPhase(idle, ctx, { at: justEnded ? endedAt : ctx.now, intention: null })
    return { state: started, events: [...events, { type: 'phase-started', mode: next }] }
  }

  return { state: idle, events }
}

/**
 * Ends the current phase now, by hand: count it (`completed`), abandon it
 * (`voided`) or skip it (`skipped`).
 */
export function finish(state: TimerState, ctx: TimerContext, outcome: SessionOutcome): TimerResult {
  if (state.status === 'idle') return { state, events: [] }
  return closePhase(state, ctx, ctx.now, outcome, 'manual')
}

/**
 * Reconciles the state with the clock. Call it on every tick, when
 * `visibilitychange` brings the page back, on `pageshow` and at startup: this is
 * the only place that decides a session is over.
 */
export function advance(state: TimerState, ctx: TimerContext): TimerResult {
  if (state.status !== 'running' && state.status !== 'overtime') return { state, events: [] }
  if (state.endsAt === null) return { state, events: [] }
  if (ctx.now < state.endsAt) return { state, events: [] }

  const overtimeAllowed = ctx.settings.mode === 'overtime' && state.mode === 'focus'
  if (overtimeAllowed) {
    if (state.status === 'overtime') return { state, events: [] }
    return {
      state: { ...state, status: 'overtime' },
      events: [{ type: 'overtime-started', mode: state.mode }],
    }
  }

  return closePhase(state, ctx, state.endsAt, 'completed', 'elapsed')
}

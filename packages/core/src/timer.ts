import type { InterruptionKind, Mode, SessionOutcome, SessionRecord, TimerState } from './types'
import { plannedMsFor, type Settings } from './settings'

/**
 * Au-delà de ce retard, on ne démarre plus la phase suivante automatiquement :
 * l'onglet était fermé ou gelé, et enchaîner une pause commencée il y a une heure
 * n'a aucun sens. L'app affiche « terminée il y a X » et laisse la main.
 */
export const CATCH_UP_GRACE_MS = 60_000

export type TimerContext = {
  /** Instant courant (ms epoch). Toujours injecté : le noyau ne lit jamais l'horloge. */
  now: number
  settings: Settings
  uid: () => string
}

export type TimerEvent =
  | { type: 'session-ended'; record: SessionRecord; lateByMs: number }
  | { type: 'overtime-started'; mode: Mode }
  | { type: 'phase-started'; mode: Mode }

export type TimerResult = { state: TimerState; events: TimerEvent[] }

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
    intention: null,
  }
}

/** En flowtime, un focus n'a pas d'échéance : il tourne jusqu'à ce qu'on l'arrête. */
function hasDeadline(mode: Mode, settings: Settings): boolean {
  return !(settings.mode === 'flowtime' && mode === 'focus')
}

/** Horloge effective : figée à l'instant de la pause tant que le minuteur est en pause. */
function clockOf(state: TimerState, now: number): number {
  return state.status === 'paused' && state.pausedAt !== null ? state.pausedAt : now
}

/**
 * Temps restant en ms, négatif en overtime. `null` quand la phase n'a pas
 * d'échéance (focus en flowtime) — dans ce cas c'est `elapsedMs` qui fait foi.
 */
export function remainingMs(state: TimerState, now: number): number | null {
  if (state.endsAt === null) return state.status === 'idle' ? state.plannedMs : null
  return state.endsAt - clockOf(state, now)
}

/** Temps réellement écoulé sur la phase, hors pauses. Jamais négatif. */
export function elapsedMs(state: TimerState, now: number): number {
  if (state.startedAt === null) return 0
  const raw = clockOf(state, now) - state.startedAt - state.pausedTotalMs
  return raw > 0 ? raw : 0
}

/** Avancement de 0 à 1, plafonné à 1 même en overtime. */
export function progress(state: TimerState, now: number): number {
  if (state.plannedMs <= 0) return 0
  const done = elapsedMs(state, now) / state.plannedMs
  return done < 0 ? 0 : done > 1 ? 1 : done
}

/**
 * Mode qui suivra, connaissant le nombre de focus déjà faits depuis la longue pause.
 *
 * Le seuil est un `>=` et non un modulo : un focus annulé ne compte pas, et avec
 * un modulo la longue pause due sauterait purement et simplement au tour suivant.
 */
export function nextMode(mode: Mode, focusSinceLongBreak: number, settings: Settings): Mode {
  if (mode !== 'focus') return 'focus'
  return focusSinceLongBreak >= settings.longBreakEvery ? 'longBreak' : 'shortBreak'
}

/** Durée de pause proposée en flowtime, proportionnelle au temps travaillé. */
export function flowtimeBreakMs(workedMs: number, settings: Settings): number {
  return Math.max(60_000, Math.round(workedMs * settings.flowtimeBreakRatio))
}

export function startPhase(
  state: TimerState,
  ctx: TimerContext,
  options: { taskId?: string | null; intention?: string | null; at?: number } = {},
): TimerState {
  const at = options.at ?? ctx.now
  // On démarre la durée déjà portée par l'état, jamais une durée recalculée depuis
  // les réglages : sinon la pause proportionnelle du mode flowtime serait écrasée
  // par la durée de pause courte générique. `applySettings` est le seul endroit
  // qui reprend les durées des réglages.
  return {
    ...state,
    status: 'running',
    startedAt: at,
    endsAt: hasDeadline(state.mode, ctx.settings) ? at + state.plannedMs : null,
    pausedAt: null,
    pausedTotalMs: 0,
    interruptions: { internal: 0, external: 0 },
    taskId: options.taskId !== undefined ? options.taskId : state.taskId,
    intention: options.intention !== undefined ? options.intention : state.intention,
  }
}

export function pause(state: TimerState, ctx: TimerContext): TimerState {
  if (state.status !== 'running' && state.status !== 'overtime') return state
  return { ...state, status: 'paused', pausedAt: ctx.now }
}

export function resume(state: TimerState, ctx: TimerContext): TimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state
  // Le temps passé en pause décale l'échéance d'autant : une pause de 3 minutes
  // rend bien 3 minutes de travail, elle ne les vole pas.
  const pausedFor = Math.max(0, ctx.now - state.pausedAt)
  return {
    ...state,
    status: state.endsAt !== null && state.endsAt + pausedFor <= ctx.now ? 'overtime' : 'running',
    endsAt: state.endsAt === null ? null : state.endsAt + pausedFor,
    pausedAt: null,
    pausedTotalMs: state.pausedTotalMs + pausedFor,
  }
}

/** Remet la phase courante à zéro sans rien enregistrer. */
export function reset(state: TimerState, ctx: TimerContext): TimerState {
  return {
    ...state,
    status: 'idle',
    plannedMs: plannedMsFor(ctx.settings, state.mode),
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    interruptions: { internal: 0, external: 0 },
    intention: null,
  }
}

/**
 * Reprend les durées des réglages. Sans effet sur une phase en cours : changer
 * « focus = 30 min » ne doit pas rallonger le focus qui tourne déjà.
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
    tag: null,
    interruptions: { ...state.interruptions },
    intention: state.intention,
    note: null,
    rating: null,
  }
}

/**
 * Clôt la phase courante et prépare la suivante.
 *
 * `endedAt` est l'heure réelle de fin, qui n'est pas forcément `now` : si l'onglet
 * était gelé, la session s'est terminée à son échéance, pas au moment où on s'en
 * aperçoit. C'est toute la logique de rattrapage.
 */
function closePhase(
  state: TimerState,
  ctx: TimerContext,
  endedAt: number,
  outcome: SessionOutcome,
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

  const autoStart = next === 'focus' ? ctx.settings.autoStartFocus : ctx.settings.autoStartBreaks
  const lateBy = Math.max(0, ctx.now - endedAt)
  // On n'enchaîne que si la fin vient d'avoir lieu : reprendre une pause due il y a
  // une heure produirait un minuteur déjà terminé au retour de l'utilisateur.
  if (autoStart && lateBy <= CATCH_UP_GRACE_MS) {
    const started = startPhase(idle, ctx, { at: endedAt, intention: null })
    return { state: started, events: [...events, { type: 'phase-started', mode: next }] }
  }

  return { state: idle, events }
}

/** Termine la phase courante maintenant : passer (`skipped`) ou annuler (`voided`). */
export function finish(state: TimerState, ctx: TimerContext, outcome: SessionOutcome): TimerResult {
  if (state.status === 'idle') return { state, events: [] }
  return closePhase(state, ctx, ctx.now, outcome)
}

/**
 * Réconcilie l'état avec l'horloge. À appeler à chaque tick, au retour de
 * `visibilitychange`, au `pageshow` et au démarrage : c'est le seul endroit qui
 * décide qu'une session est terminée.
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

  return closePhase(state, ctx, state.endsAt, 'completed')
}

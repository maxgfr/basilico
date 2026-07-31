import { describe, expect, it } from 'vitest'
import {
  CATCH_UP_GRACE_MS,
  addInterruption,
  advance,
  createTimerState,
  elapsedMs,
  finish,
  pause,
  progress,
  remainingMs,
  resume,
  startPhase,
  type TimerContext,
} from './timer'
import { defaultSettings, type Settings } from './settings'
import type { SessionRecord, TimerState } from './types'

const T0 = Date.UTC(2026, 6, 31, 9, 0, 0)
const MIN = 60_000

function ctxAt(now: number, overrides: Partial<Settings> = {}): TimerContext {
  let n = 0
  return {
    now,
    settings: { ...defaultSettings, ...overrides },
    uid: () => `id-${++n}`,
  }
}

/** Démarre un focus à T0 avec les réglages donnés. */
function running(overrides: Partial<Settings> = {}): TimerState {
  const ctx = ctxAt(T0, overrides)
  return startPhase(createTimerState(ctx.settings), ctx)
}

function endedRecords(events: ReturnType<typeof advance>['events']): SessionRecord[] {
  return events.flatMap((e) => (e.type === 'session-ended' ? [e.record] : []))
}

describe('décompte', () => {
  it('calcule le restant à partir de l’échéance absolue', () => {
    const state = running()
    expect(remainingMs(state, T0)).toBe(25 * MIN)
    expect(remainingMs(state, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(progress(state, T0 + 5 * MIN)).toBeCloseTo(0.2)
  })

  it('ne dérive pas quand aucun tick n’a eu lieu pendant 24 minutes', () => {
    const state = running()
    // Onglet en arrière-plan : l'horloge a avancé, aucun callback n'a tourné.
    expect(remainingMs(state, T0 + 24 * MIN)).toBe(1 * MIN)
    expect(advance(state, ctxAt(T0 + 24 * MIN)).events).toHaveLength(0)
  })

  it('ne rend jamais un écoulé négatif si l’horloge recule', () => {
    const state = running()
    expect(elapsedMs(state, T0 - 5 * MIN)).toBe(0)
    expect(progress(state, T0 - 5 * MIN)).toBe(0)
  })
})

describe('pause', () => {
  it('gèle le décompte et décale l’échéance du temps passé en pause', () => {
    let state = running()
    state = pause(state, ctxAt(T0 + 10 * MIN))

    // Le restant ne bouge plus pendant la pause, même si l'horloge tourne.
    expect(remainingMs(state, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(remainingMs(state, T0 + 13 * MIN)).toBe(15 * MIN)

    state = resume(state, ctxAt(T0 + 13 * MIN))
    expect(state.status).toBe('running')
    expect(remainingMs(state, T0 + 13 * MIN)).toBe(15 * MIN)
    expect(state.pausedTotalMs).toBe(3 * MIN)
  })

  it('exclut le temps de pause du temps réellement travaillé', () => {
    let state = running()
    state = pause(state, ctxAt(T0 + 10 * MIN))
    state = resume(state, ctxAt(T0 + 13 * MIN))
    const { events } = finish(state, ctxAt(T0 + 20 * MIN), 'skipped')
    const [record] = endedRecords(events)
    expect(record?.actualMs).toBe(17 * MIN)
  })

  it('une longue pause ne fait pas perdre de temps de travail', () => {
    let state = running()
    state = pause(state, ctxAt(T0 + 10 * MIN))
    state = resume(state, ctxAt(T0 + 60 * MIN))
    // 50 minutes de pause : l'échéance a glissé d'autant, il reste bien 15 minutes.
    expect(state.status).toBe('running')
    expect(remainingMs(state, T0 + 60 * MIN)).toBe(15 * MIN)
  })

  it('reste en overtime après une pause prise au-delà de l’échéance', () => {
    const opts = { mode: 'overtime' } as const
    let state = advance(running(opts), ctxAt(T0 + 26 * MIN, opts)).state
    expect(state.status).toBe('overtime')
    state = pause(state, ctxAt(T0 + 27 * MIN, opts))
    state = resume(state, ctxAt(T0 + 29 * MIN, opts))
    expect(state.status).toBe('overtime')
  })
})

describe('fin de session et enchaînement', () => {
  it('termine à l’échéance, pas au moment où on s’en aperçoit', () => {
    const state = running()
    const late = T0 + 40 * MIN
    const { events } = advance(state, ctxAt(late))
    const [record] = endedRecords(events)

    expect(record?.endedAt).toBe(T0 + 25 * MIN)
    expect(record?.actualMs).toBe(25 * MIN)
    expect(record?.outcome).toBe('completed')
    const ended = events.find((e) => e.type === 'session-ended')
    expect(ended?.type === 'session-ended' && ended.lateByMs).toBe(15 * MIN)
  })

  it('enchaîne la pause automatiquement quand la fin vient d’avoir lieu', () => {
    const result = advance(running(), ctxAt(T0 + 25 * MIN))
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.status).toBe('running')
    // La pause a commencé quand le focus s'est terminé, pas une seconde plus tard.
    expect(result.state.startedAt).toBe(T0 + 25 * MIN)
  })

  it('n’enchaîne pas une pause due depuis trop longtemps', () => {
    const result = advance(running(), ctxAt(T0 + 25 * MIN + CATCH_UP_GRACE_MS + 1))
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.status).toBe('idle')
  })

  it('donne une longue pause tous les quatre focus', () => {
    let state = running()
    let ctx = ctxAt(T0)
    const modes: string[] = []

    for (let i = 0; i < 4; i++) {
      const at = (state.endsAt ?? 0) + 1
      ctx = ctxAt(at)
      const result = advance(state, ctx)
      state = result.state
      modes.push(state.mode)
      // On passe la pause pour revenir à un focus.
      const skipped = finish(state, ctxAt(at + 1), 'skipped')
      state = startPhase(skipped.state, ctxAt(at + 2))
    }

    expect(modes).toEqual(['shortBreak', 'shortBreak', 'shortBreak', 'longBreak'])
  })

  it('remet le compteur à zéro après la longue pause', () => {
    let state: TimerState = { ...running(), focusSinceLongBreak: 4 }
    state = advance(state, ctxAt(T0 + 25 * MIN)).state
    expect(state.mode).toBe('longBreak')
    state = finish(state, ctxAt(T0 + 26 * MIN), 'completed').state
    expect(state.focusSinceLongBreak).toBe(0)
    expect(state.mode).toBe('focus')
  })

  it('ne compte pas un focus annulé, et ne perd pas la longue pause due', () => {
    // Trois focus faits, le quatrième est annulé : la longue pause reste due.
    let state: TimerState = { ...running(), focusSinceLongBreak: 3 }
    const voided = finish(state, ctxAt(T0 + 3 * MIN), 'voided')
    state = voided.state
    expect(endedRecords(voided.events)[0]?.outcome).toBe('voided')
    expect(state.focusSinceLongBreak).toBe(3)
    expect(state.mode).toBe('shortBreak')

    // Le focus suivant, lui, compte : la longue pause arrive bien.
    state = startPhase({ ...state, mode: 'focus', status: 'idle' }, ctxAt(T0 + 5 * MIN))
    state = advance(state, ctxAt(T0 + 30 * MIN)).state
    expect(state.mode).toBe('longBreak')
  })

  it('enregistre les interruptions sur la session', () => {
    let state = addInterruption(running(), 'internal')
    state = addInterruption(state, 'external')
    state = addInterruption(state, 'internal')
    const [record] = endedRecords(finish(state, ctxAt(T0 + 5 * MIN), 'voided').events)
    expect(record?.interruptions).toEqual({ internal: 2, external: 1 })
  })
})

describe('mode overtime', () => {
  it('continue de compter au-delà de zéro au lieu de terminer', () => {
    const state = running({ mode: 'overtime' })
    const result = advance(state, ctxAt(T0 + 25 * MIN + 1, { mode: 'overtime' }))

    expect(result.state.status).toBe('overtime')
    expect(result.events).toEqual([{ type: 'overtime-started', mode: 'focus' }])
    expect(remainingMs(result.state, T0 + 30 * MIN)).toBe(-5 * MIN)
  })

  it('n’émet l’événement overtime qu’une seule fois', () => {
    const state = running({ mode: 'overtime' })
    const first = advance(state, ctxAt(T0 + 26 * MIN, { mode: 'overtime' }))
    const second = advance(first.state, ctxAt(T0 + 27 * MIN, { mode: 'overtime' }))
    expect(second.events).toHaveLength(0)
  })

  it('comptabilise le dépassement à l’arrêt manuel', () => {
    const state = running({ mode: 'overtime' })
    const overtime = advance(state, ctxAt(T0 + 26 * MIN, { mode: 'overtime' })).state
    const [record] = endedRecords(
      finish(overtime, ctxAt(T0 + 32 * MIN, { mode: 'overtime' }), 'completed').events,
    )
    expect(record?.overtimeMs).toBe(7 * MIN)
    expect(record?.actualMs).toBe(32 * MIN)
  })
})

describe('mode flowtime', () => {
  it('démarre un focus sans échéance', () => {
    const state = running({ mode: 'flowtime' })
    expect(state.endsAt).toBeNull()
    expect(remainingMs(state, T0 + 90 * MIN)).toBeNull()
    expect(elapsedMs(state, T0 + 90 * MIN)).toBe(90 * MIN)
    expect(advance(state, ctxAt(T0 + 90 * MIN, { mode: 'flowtime' })).events).toHaveLength(0)
  })

  it('propose une pause proportionnelle au temps travaillé', () => {
    const state = running({ mode: 'flowtime' })
    const result = finish(state, ctxAt(T0 + 50 * MIN, { mode: 'flowtime' }), 'completed')
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.plannedMs).toBe(10 * MIN)
  })

  it('n’enferme jamais l’utilisateur dans une pause d’une seconde', () => {
    const state = running({ mode: 'flowtime' })
    const result = finish(state, ctxAt(T0 + 30_000, { mode: 'flowtime' }), 'completed')
    expect(result.state.plannedMs).toBe(60_000)
  })
})

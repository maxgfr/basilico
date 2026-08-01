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
  focusUntilLongBreak,
  reset,
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

/** Starts a focus session at T0 with the given settings. */
function running(overrides: Partial<Settings> = {}): TimerState {
  const ctx = ctxAt(T0, overrides)
  return startPhase(createTimerState(ctx.settings), ctx)
}

function endedRecords(events: ReturnType<typeof advance>['events']): SessionRecord[] {
  return events.flatMap((e) => (e.type === 'session-ended' ? [e.record] : []))
}

describe('countdown', () => {
  it('derives the remaining time from the absolute deadline', () => {
    const state = running()
    expect(remainingMs(state, T0)).toBe(25 * MIN)
    expect(remainingMs(state, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(progress(state, T0 + 5 * MIN)).toBeCloseTo(0.2)
  })

  it('does not drift when no tick happened for 24 minutes', () => {
    const state = running()
    // Backgrounded tab: the clock moved on, no callback ran.
    expect(remainingMs(state, T0 + 24 * MIN)).toBe(1 * MIN)
    expect(advance(state, ctxAt(T0 + 24 * MIN)).events).toHaveLength(0)
  })

  it('never reports negative elapsed time when the clock goes backwards', () => {
    const state = running()
    expect(elapsedMs(state, T0 - 5 * MIN)).toBe(0)
    expect(progress(state, T0 - 5 * MIN)).toBe(0)
  })
})

describe('pausing', () => {
  it('freezes the countdown and pushes the deadline by the paused time', () => {
    let state = running()
    state = pause(state, ctxAt(T0 + 10 * MIN))

    // The remaining time stops moving while paused, even as the clock runs.
    expect(remainingMs(state, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(remainingMs(state, T0 + 13 * MIN)).toBe(15 * MIN)

    state = resume(state, ctxAt(T0 + 13 * MIN))
    expect(state.status).toBe('running')
    expect(remainingMs(state, T0 + 13 * MIN)).toBe(15 * MIN)
    expect(state.pausedTotalMs).toBe(3 * MIN)
  })

  it('excludes paused time from the time actually worked', () => {
    let state = running()
    state = pause(state, ctxAt(T0 + 10 * MIN))
    state = resume(state, ctxAt(T0 + 13 * MIN))
    const { events } = finish(state, ctxAt(T0 + 20 * MIN), 'skipped')
    const [record] = endedRecords(events)
    expect(record?.actualMs).toBe(17 * MIN)
  })

  it('a long pause costs no working time', () => {
    let state = running()
    state = pause(state, ctxAt(T0 + 10 * MIN))
    state = resume(state, ctxAt(T0 + 60 * MIN))
    // 50 minutes paused: the deadline slid by the same amount, 15 minutes remain.
    expect(state.status).toBe('running')
    expect(remainingMs(state, T0 + 60 * MIN)).toBe(15 * MIN)
  })

  it('stays in overtime after pausing past the deadline', () => {
    const opts = { mode: 'overtime' } as const
    let state = advance(running(opts), ctxAt(T0 + 26 * MIN, opts)).state
    expect(state.status).toBe('overtime')
    state = pause(state, ctxAt(T0 + 27 * MIN, opts))
    state = resume(state, ctxAt(T0 + 29 * MIN, opts))
    expect(state.status).toBe('overtime')
  })
})

describe('session end and chaining', () => {
  it('ends at the deadline, not when we notice', () => {
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

  it('chains the break automatically when the end just happened', () => {
    const result = advance(running(), ctxAt(T0 + 25 * MIN))
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.status).toBe('running')
    // The break started when the focus ended, not a second later.
    expect(result.state.startedAt).toBe(T0 + 25 * MIN)
  })

  it('hands control back when a break has been due for too long', () => {
    // Endless off: coming back to a break that was due an hour ago should not
    // hand over a timer that already expired.
    const settings = { autoStartFocus: false } as const
    const late = T0 + 25 * MIN + CATCH_UP_GRACE_MS + 1
    const result = advance(running(settings), ctxAt(late, settings))
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.status).toBe('idle')
  })

  it('keeps the cycle running after an absence when it must never stop', () => {
    // Endless is the default: an absence is not a reason to break the cycle,
    // only an explicit stop is.
    const late = T0 + 3 * 60 * MIN
    const result = advance(running(), ctxAt(late))

    expect(result.state.status).toBe('running')
    expect(result.state.mode).toBe('shortBreak')
    // Started now, not back-dated: dating it to the old end would hand over an
    // already-expired phase, and the next tick would close that one too.
    expect(result.state.startedAt).toBe(late)
    expect(remainingMs(result.state, late)).toBe(5 * MIN)
  })

  it('still reports how late the finished session was', () => {
    const late = T0 + 3 * 60 * MIN
    const ended = advance(running(), ctxAt(late)).events.find((e) => e.type === 'session-ended')
    // The banner needs this even though the cycle carried on without us.
    expect(ended?.type === 'session-ended' && ended.lateByMs).toBe(155 * MIN)
  })

  it('gives a long break every four focus sessions', () => {
    let state = running()
    const modes: string[] = []

    for (let i = 0; i < 4; i++) {
      const at = (state.endsAt ?? 0) + 1
      state = advance(state, ctxAt(at)).state
      modes.push(state.mode)
      // Skipping the break hands the next focus back already running.
      state = finish(state, ctxAt(at + 1), 'skipped').state
    }

    expect(modes).toEqual(['shortBreak', 'shortBreak', 'shortBreak', 'longBreak'])
  })

  it('chains the next phase on an explicit skip, whatever the auto-start settings', () => {
    // The reported bug: Start, Skip, Skip and the timer sat there on "Start".
    // Asking for the next phase by hand *is* the request to carry on; the
    // auto-start settings only govern what happens unattended.
    const settings = { autoStartBreaks: false, autoStartFocus: false } as const
    let state = running(settings)

    state = finish(state, ctxAt(T0 + MIN, settings), 'skipped').state
    expect(state.mode).toBe('shortBreak')
    expect(state.status).toBe('running')

    state = finish(state, ctxAt(T0 + 2 * MIN, settings), 'skipped').state
    expect(state.mode).toBe('focus')
    expect(state.status).toBe('running')
  })

  it('resets back to a focus phase, never onto a break', () => {
    // Ending a session hands over the break already running, so Reset is the
    // click right after it. Leaving the mode alone stranded you there: the next
    // Start ran a break, and a reload came back to one.
    const afterFocus = finish(running(), ctxAt(T0 + 25 * MIN), 'completed').state
    expect(afterFocus.mode).toBe('shortBreak')

    const back = reset(afterFocus, ctxAt(T0 + 26 * MIN))
    expect(back.mode).toBe('focus')
    expect(back.status).toBe('idle')
    expect(remainingMs(back, T0 + 26 * MIN)).toBe(25 * MIN)
  })

  it('keeps a long break that was due across a reset', () => {
    const state: TimerState = { ...running(), focusSinceLongBreak: 4 }
    const back = reset(state, ctxAt(T0 + MIN))
    expect(back.focusSinceLongBreak).toBe(4)
    // Still due: `nextMode` compares with `>=`, not a modulo.
    expect(
      finish(startPhase(back, ctxAt(T0 + 2 * MIN)), ctxAt(T0 + 3 * MIN), 'completed').state.mode,
    ).toBe('longBreak')
  })

  it('says how many focus sessions are left before the long break', () => {
    const settings = ctxAt(T0).settings
    expect(focusUntilLongBreak(running(), settings)).toBe(4)

    const result = finish(running(), ctxAt(T0 + 20 * MIN), 'completed')
    expect(focusUntilLongBreak(result.state, settings)).toBe(3)

    // A long break already owed reads as zero rather than going negative:
    // a reset preserves the counter, so it can sit past the threshold.
    const owed: TimerState = { ...running(), focusSinceLongBreak: 6 }
    expect(focusUntilLongBreak(owed, settings)).toBe(0)
  })

  it('counts the pomodoro when a focus session is ended by hand', () => {
    const result = finish(running(), ctxAt(T0 + 20 * MIN), 'completed')
    expect(endedRecords(result.events)[0]?.outcome).toBe('completed')
    expect(result.state.focusSinceLongBreak).toBe(1)
    // And the break it hands over is a real one, not an idle placeholder.
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.status).toBe('running')
  })

  it('resets the counter after the long break', () => {
    let state: TimerState = { ...running(), focusSinceLongBreak: 4 }
    state = advance(state, ctxAt(T0 + 25 * MIN)).state
    expect(state.mode).toBe('longBreak')
    state = finish(state, ctxAt(T0 + 26 * MIN), 'completed').state
    expect(state.focusSinceLongBreak).toBe(0)
    expect(state.mode).toBe('focus')
  })

  it('does not count a voided focus, and does not lose the long break that is due', () => {
    // Three focus sessions done, the fourth is voided: the long break stays due.
    let state: TimerState = { ...running(), focusSinceLongBreak: 3 }
    const voided = finish(state, ctxAt(T0 + 3 * MIN), 'voided')
    state = voided.state
    expect(endedRecords(voided.events)[0]?.outcome).toBe('voided')
    expect(state.focusSinceLongBreak).toBe(3)
    expect(state.mode).toBe('shortBreak')

    // The next one does count: the long break duly arrives.
    state = startPhase({ ...state, mode: 'focus', status: 'idle' }, ctxAt(T0 + 5 * MIN))
    state = advance(state, ctxAt(T0 + 30 * MIN)).state
    expect(state.mode).toBe('longBreak')
  })

  it('records interruptions on the session', () => {
    let state = addInterruption(running(), 'internal')
    state = addInterruption(state, 'external')
    state = addInterruption(state, 'internal')
    const [record] = endedRecords(finish(state, ctxAt(T0 + 5 * MIN), 'voided').events)
    expect(record?.interruptions).toEqual({ internal: 2, external: 1 })
  })
})

describe('overtime mode', () => {
  it('keeps counting past zero instead of finishing', () => {
    const state = running({ mode: 'overtime' })
    const result = advance(state, ctxAt(T0 + 25 * MIN + 1, { mode: 'overtime' }))

    expect(result.state.status).toBe('overtime')
    expect(result.events).toEqual([{ type: 'overtime-started', mode: 'focus' }])
    expect(remainingMs(result.state, T0 + 30 * MIN)).toBe(-5 * MIN)
  })

  it('emits the overtime event only once', () => {
    const state = running({ mode: 'overtime' })
    const first = advance(state, ctxAt(T0 + 26 * MIN, { mode: 'overtime' }))
    const second = advance(first.state, ctxAt(T0 + 27 * MIN, { mode: 'overtime' }))
    expect(second.events).toHaveLength(0)
  })

  it('records the overshoot when stopped by hand', () => {
    const state = running({ mode: 'overtime' })
    const overtime = advance(state, ctxAt(T0 + 26 * MIN, { mode: 'overtime' })).state
    const [record] = endedRecords(
      finish(overtime, ctxAt(T0 + 32 * MIN, { mode: 'overtime' }), 'completed').events,
    )
    expect(record?.overtimeMs).toBe(7 * MIN)
    expect(record?.actualMs).toBe(32 * MIN)
  })
})

describe('flowtime mode', () => {
  it('starts a focus session with no deadline', () => {
    const state = running({ mode: 'flowtime' })
    expect(state.endsAt).toBeNull()
    expect(remainingMs(state, T0 + 90 * MIN)).toBeNull()
    expect(elapsedMs(state, T0 + 90 * MIN)).toBe(90 * MIN)
    expect(advance(state, ctxAt(T0 + 90 * MIN, { mode: 'flowtime' })).events).toHaveLength(0)
  })

  it('offers a break proportional to the time worked', () => {
    const state = running({ mode: 'flowtime' })
    const result = finish(state, ctxAt(T0 + 50 * MIN, { mode: 'flowtime' }), 'completed')
    expect(result.state.mode).toBe('shortBreak')
    expect(result.state.plannedMs).toBe(10 * MIN)
  })

  it('never traps the user in a one-second break', () => {
    const state = running({ mode: 'flowtime' })
    const result = finish(state, ctxAt(T0 + 30_000, { mode: 'flowtime' }), 'completed')
    expect(result.state.plannedMs).toBe(60_000)
  })
})

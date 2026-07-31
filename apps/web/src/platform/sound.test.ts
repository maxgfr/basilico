import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sound } from './sound'

/**
 * jsdom has no Web Audio, so the whole graph is faked. What matters here is not
 * the waveform but the bookkeeping: which oscillators `cancel()` is allowed to
 * stop, and when they were told to start.
 */
type FakeOsc = {
  startedAt: number | null
  stoppedAt: number | null
  frequency: { value: number }
  type: string
  connect: () => void
  start: (at: number) => void
  stop: (at?: number) => void
  addEventListener: () => void
}

let created: FakeOsc[] = []

/** What the fake records for a bare `stop()` — an immediate, unscheduled kill. */
const STOPPED_NOW = -1

function installFakeAudio() {
  created = []
  const param = () => ({
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  })

  class FakeAudioContext {
    state = 'running'
    currentTime = 100
    resume = () => Promise.resolve()
    destination = {}
    createGain = () => ({ gain: param(), connect: () => {} })
    createOscillator = (): FakeOsc => {
      const osc: FakeOsc = {
        startedAt: null,
        stoppedAt: null,
        frequency: { value: 0 },
        type: 'sine',
        connect: () => {},
        start: (at: number) => {
          osc.startedAt = at
        },
        stop: (at?: number) => {
          osc.stoppedAt = at ?? STOPPED_NOW
        },
        addEventListener: () => {},
      }
      created.push(osc)
      return osc
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext)
}

describe('SoundPlayer', () => {
  beforeEach(async () => {
    installFakeAudio()
    sound.cancel()
    await sound.unlock()
    created = []
  })

  // The reported bug: picking an alarm writes the setting, which re-runs the
  // scheduling effect, which cancels — microseconds after the preview was
  // scheduled 10 ms out. Stopping an oscillator before its start time means it
  // never sounds at all, so choosing a sound was silent every single time.
  it('does not let a re-schedule silence a preview that just started', () => {
    sound.playNow('bell', 0.6)
    const preview = [...created]
    expect(preview.length).toBeGreaterThan(0)

    sound.schedule('bell', 60_000, 0.6)

    // Every voice is given a natural stop at the end of its envelope. What must
    // not happen is a bare `stop()` landing before the note has started.
    expect(preview.every((osc) => osc.stoppedAt! > osc.startedAt!)).toBe(true)
  })

  it('still cancels the alarm it scheduled', () => {
    sound.schedule('chime', 60_000, 0.6)
    const alarm = [...created]
    expect(alarm.length).toBeGreaterThan(0)

    sound.cancel()

    // `stop()` with no argument: STOPPED_NOW in the fake.
    expect(alarm.every((osc) => osc.stoppedAt === STOPPED_NOW)).toBe(true)
  })

  it('falls back to the chime rather than throwing on an unknown alarm', () => {
    // `sound.alarm` is a plain string in the schema, so an edited backup or a
    // future rename must not throw from inside a React effect.
    expect(() => sound.playNow('gong' as 'chime', 0.6)).not.toThrow()
    expect(created.length).toBe(3)
  })

  it('plays nothing at all at zero volume', () => {
    sound.playNow('chime', 0)
    expect(created.length).toBe(0)
  })
})

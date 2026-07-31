/**
 * Alarm scheduled on the audio clock.
 *
 * `AudioContext.currentTime` is a hardware clock, independent of the event loop:
 * a sound scheduled with `start(when)` fires on time even when the main thread
 * is throttled in the background, or frozen by Energy Saver. It is the only
 * alerting mechanism that survives that without a server, hence the care here.
 *
 * The context is created and unlocked on the first user gesture: built any
 * earlier it would be born `suspended` and the alarm would be silent.
 */

export type AlarmName = 'chime' | 'bell' | 'blip'

export const ALARMS: AlarmName[] = ['chime', 'bell', 'blip']

/** A voice the scheduler may cancel, versus one that must be left to ring. */
type VoiceTrack = 'cancellable' | 'oneshot'

const PARTIALS: Record<AlarmName, { freq: number; at: number; length: number }[]> = {
  chime: [
    { freq: 880, at: 0, length: 1.4 },
    { freq: 1318.5, at: 0.16, length: 1.4 },
    { freq: 1760, at: 0.32, length: 1.6 },
  ],
  bell: [
    { freq: 523.25, at: 0, length: 2.2 },
    { freq: 1046.5, at: 0.005, length: 1.6 },
    { freq: 1567.98, at: 0.01, length: 0.9 },
  ],
  blip: [
    { freq: 1200, at: 0, length: 0.12 },
    { freq: 1200, at: 0.18, length: 0.12 },
  ],
}

class SoundPlayer {
  private ctx: AudioContext | null = null
  private scheduled: OscillatorNode[] = []
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private tickedUntil = 0

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /** Call from a user-gesture handler, never on page load. */
  async unlock(): Promise<void> {
    try {
      this.ctx ??= new AudioContext()
      // Safari moves the context to `interrupted` when the tab goes background.
      if (this.ctx.state !== 'running') await this.ctx.resume()
    } catch {
      // No audio available: the app stays perfectly usable.
    }
  }

  /**
   * `track` decides whether `cancel()` may kill these voices.
   *
   * A previewed alarm must not be: choosing one in the settings writes the
   * setting, which re-runs the scheduling effect, which cancels — a few hundred
   * microseconds after the preview was scheduled ten milliseconds out. Stopping
   * an oscillator before its start time means it never sounds at all, so the
   * preview was silent every single time, and picking a sound looked broken.
   */
  private voice(name: AlarmName, at: number, volume: number, track: VoiceTrack) {
    const ctx = this.ctx
    if (!ctx) return

    // The stored id is a plain string: an edited backup must not throw from
    // inside a React effect.
    for (const partial of PARTIALS[name] ?? PARTIALS.chime) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = at + partial.at
      const peak = Math.max(0.0001, volume * 0.5)

      osc.type = 'sine'
      osc.frequency.value = partial.freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + partial.length)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + partial.length + 0.05)
      if (track === 'cancellable') {
        osc.addEventListener('ended', () => {
          this.scheduled = this.scheduled.filter((o) => o !== osc)
        })
        this.scheduled.push(osc)
      }
    }
  }

  /** Schedules the alarm for `delayMs` from now, accurate to the millisecond. */
  schedule(name: AlarmName, delayMs: number, volume: number): void {
    if (!this.ctx || volume <= 0) return
    this.cancel()
    this.voice(name, this.ctx.currentTime + Math.max(0, delayMs) / 1000, volume, 'cancellable')
  }

  /** Plays one now and lets it finish: a preview, or the phase-end fallback. */
  playNow(name: AlarmName, volume: number): void {
    if (!this.ctx || volume <= 0) return
    this.voice(name, this.ctx.currentTime + 0.01, volume, 'oneshot')
  }

  /** Cancels a scheduled alarm: pause, reset, or ending the phase by hand. */
  cancel(): void {
    for (const osc of this.scheduled) {
      try {
        osc.stop()
      } catch {
        // Already stopped.
      }
    }
    this.scheduled = []
  }

  /**
   * Ticking. Scheduled a few seconds ahead and topped up while the page is
   * visible: no point running it in a tab nobody is looking at.
   */
  startTicking(volume: number): void {
    if (!this.ctx || this.tickTimer !== null || volume <= 0) return
    const ctx = this.ctx
    this.tickedUntil = ctx.currentTime

    const feed = () => {
      const horizon = ctx.currentTime + 3
      while (this.tickedUntil < horizon) {
        this.tickedUntil += 1
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = 2000
        gain.gain.setValueAtTime(0.0001, this.tickedUntil)
        gain.gain.exponentialRampToValueAtTime(volume * 0.06, this.tickedUntil + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, this.tickedUntil + 0.03)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(this.tickedUntil)
        osc.stop(this.tickedUntil + 0.05)
      }
    }

    feed()
    this.tickTimer = setInterval(feed, 1500)
  }

  stopTicking(): void {
    if (this.tickTimer === null) return
    clearInterval(this.tickTimer)
    this.tickTimer = null
  }
}

export const sound = new SoundPlayer()

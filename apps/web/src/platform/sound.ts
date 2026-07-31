/**
 * Sonnerie planifiée sur l'horloge audio.
 *
 * `AudioContext.currentTime` est une horloge matérielle, indépendante de la boucle
 * d'événements : une sonnerie programmée avec `start(when)` part à l'heure même si
 * le thread principal est ralenti par le throttling d'arrière-plan, voire gelé par
 * l'économiseur d'énergie. C'est le seul mécanisme d'alerte qui survit à ça sans
 * serveur, d'où le soin qu'on y met.
 *
 * Le contexte est créé et débloqué au premier geste utilisateur : construit plus
 * tôt, il naîtrait `suspended` et la sonnerie serait muette.
 */

export type AlarmName = 'chime' | 'bell' | 'blip'

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

  /** À appeler depuis un handler de geste utilisateur, jamais au chargement. */
  async unlock(): Promise<void> {
    try {
      this.ctx ??= new AudioContext()
      // Safari passe le contexte en `interrupted` quand l'onglet part en arrière-plan.
      if (this.ctx.state !== 'running') await this.ctx.resume()
    } catch {
      // Pas d'audio disponible : l'app reste parfaitement utilisable.
    }
  }

  private voice(name: AlarmName, at: number, volume: number) {
    const ctx = this.ctx
    if (!ctx) return

    for (const partial of PARTIALS[name]) {
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
      osc.addEventListener('ended', () => {
        this.scheduled = this.scheduled.filter((o) => o !== osc)
      })
      this.scheduled.push(osc)
    }
  }

  /** Programme la sonnerie pour dans `delayMs`. Précision à la milliseconde près. */
  schedule(name: AlarmName, delayMs: number, volume: number): void {
    if (!this.ctx || volume <= 0) return
    this.cancel()
    this.voice(name, this.ctx.currentTime + Math.max(0, delayMs) / 1000, volume)
  }

  playNow(name: AlarmName, volume: number): void {
    if (!this.ctx || volume <= 0) return
    this.voice(name, this.ctx.currentTime + 0.01, volume)
  }

  /** Annule une sonnerie programmée : pause, reset, ou fin manuelle de la phase. */
  cancel(): void {
    for (const osc of this.scheduled) {
      try {
        osc.stop()
      } catch {
        // Déjà arrêté.
      }
    }
    this.scheduled = []
  }

  /**
   * Tic-tac. Programmé quelques secondes à l'avance et réalimenté tant que la page
   * est visible : inutile de le faire tourner dans un onglet qu'on ne regarde pas.
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

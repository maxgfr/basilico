/** Les trois phases d'un cycle. */
export type Mode = 'focus' | 'shortBreak' | 'longBreak'

/**
 * Statut du minuteur.
 * `overtime` n'existe que si le réglage `mode` l'autorise : le compteur a dépassé
 * zéro et continue à monter au lieu de s'arrêter.
 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'overtime'

export type InterruptionKind = 'internal' | 'external'

export type Interruptions = {
  internal: number
  external: number
}

/**
 * Ce qui est persisté du minuteur. Aucune durée restante n'est stockée : seule
 * l'échéance absolue `endsAt` l'est, et le restant se recalcule à partir de l'horloge.
 * Persister un « restant » ressusciterait un minuteur périmé au rechargement.
 */
export type TimerState = {
  status: TimerStatus
  mode: Mode
  /** Durée planifiée de la phase courante, en ms. */
  plannedMs: number
  /** Début de la phase (ms epoch), `null` tant qu'elle n'a pas démarré. */
  startedAt: number | null
  /** Échéance absolue (ms epoch). `null` à l'arrêt et en pause. */
  endsAt: number | null
  /** Instant de mise en pause, `null` si le minuteur n'est pas en pause. */
  pausedAt: number | null
  /** Cumul des temps de pause de la phase courante, en ms. */
  pausedTotalMs: number
  /** Focus terminés depuis la dernière longue pause : pilote l'arrivée de celle-ci. */
  focusSinceLongBreak: number
  interruptions: Interruptions
  /** Tâche à laquelle la phase courante est rattachée. */
  taskId: string | null
  /** Intention notée avant de démarrer la phase. */
  intention: string | null
}

export type SessionOutcome = 'completed' | 'voided' | 'skipped'

/** Enregistrement immuable d'une session terminée. Le journal est append-only. */
export type SessionRecord = {
  id: string
  mode: Mode
  startedAt: number
  endedAt: number
  plannedMs: number
  /** Temps réellement passé, hors pauses. */
  actualMs: number
  /** Temps travaillé au-delà de zéro (mode overtime), 0 sinon. */
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
}

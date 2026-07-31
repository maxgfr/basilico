import { elapsedMs, progress as progressOf, remainingMs } from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import {
  MODE_LABEL,
  formatAgo,
  formatApproximate,
  formatClock,
  formatSigned,
} from '../../lib/format'
import { CyclePips } from './CyclePips'
import { TimerRing } from './TimerRing'
import { useNow } from './runtime'
import { ActiveTaskBar } from '../tasks/ActiveTaskBar'
import { PipTimer } from './PipTimer'
import { usePictureInPicture } from '../../platform/pip'

export function TimerScreen() {
  const timer = useApp((s) => s.timer)
  const settings = useApp((s) => s.settings)
  const lastEnded = useApp((s) => s.lastEnded)
  const toggle = useApp((s) => s.toggle)
  const skipPhase = useApp((s) => s.skipPhase)
  const resetPhase = useApp((s) => s.resetPhase)
  const voidPhase = useApp((s) => s.voidPhase)
  const interrupt = useApp((s) => s.interrupt)
  const dismissEnded = useApp((s) => s.dismissEnded)

  const live = timer.status === 'running' || timer.status === 'overtime'
  const now = useNow(live)
  const pip = usePictureInPicture()

  const remaining = remainingMs(timer, now)
  const elapsed = elapsedMs(timer, now)
  const isFocus = timer.mode === 'focus'
  const isOvertime = timer.status === 'overtime'
  const countingUp = remaining === null

  const value = countingUp ? elapsed : remaining
  const display = renderTime(settings.display, value, timer.plannedMs, countingUp)

  // Un rattrapage : la session s'est terminée pendant que l'onglet dormait.
  const missed = lastEnded && lastEnded.lateByMs > 60_000 ? lastEnded : null

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      {missed && (
        <div
          role="status"
          className="border-ink-800 bg-ink-900 text-ink-300 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm"
        >
          <span>
            Ton {MODE_LABEL[missed.record.mode].toLowerCase()} s’est terminé{' '}
            <strong className="text-ink-100 font-medium">{formatAgo(missed.lateByMs)}</strong>. La
            session a bien été enregistrée à la bonne heure.
          </span>
          <Button variant="ghost" size="sm" onClick={dismissEnded}>
            OK
          </Button>
        </div>
      )}

      <TimerRing
        mode={timer.mode}
        progress={countingUp ? 0 : progressOf(timer, now)}
        overtime={isOvertime}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            role="timer"
            aria-label={`${MODE_LABEL[timer.mode]}, ${formatApproximate(Math.max(0, value))}`}
            className="tabular text-ink-100 text-5xl leading-none font-light tracking-tight sm:text-6xl"
          >
            {display}
          </div>
          <div className="text-ink-600 flex items-center gap-3 text-sm">
            <span>{MODE_LABEL[timer.mode]}</span>
            <CyclePips done={timer.focusSinceLongBreak} total={settings.longBreakEvery} />
          </div>
        </div>
      </TimerRing>

      {/* Les changements d'état sont annoncés, pas chaque seconde qui passe. */}
      <p aria-live="polite" className="sr-only">
        {MODE_LABEL[timer.mode]} — {statusLabel(timer.status)}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="lg" onClick={() => toggle(Date.now())}>
          {timer.status === 'idle' && 'Démarrer'}
          {timer.status === 'running' && 'Pause'}
          {timer.status === 'overtime' && 'Arrêter'}
          {timer.status === 'paused' && 'Reprendre'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => skipPhase(Date.now())}
          disabled={timer.status === 'idle'}
        >
          Passer
        </Button>
        <Button
          variant="ghost"
          onClick={() => resetPhase(Date.now())}
          disabled={timer.status === 'idle'}
        >
          Réinitialiser
        </Button>
        {pip.supported && (
          <Button variant="ghost" onClick={() => void pip.toggle()}>
            {pip.window ? 'Fermer la fenêtre flottante' : 'Fenêtre flottante'}
          </Button>
        )}
      </div>

      {pip.window && <PipTimer target={pip.window} />}

      {isFocus && timer.status !== 'idle' && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-ink-600 text-xs">Interruption</span>
            <Button variant="ghost" size="sm" onClick={() => interrupt('internal')}>
              Interne{' '}
              <span className="text-ink-600 tabular">{timer.interruptions.internal || ''}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => interrupt('external')}>
              Externe{' '}
              <span className="text-ink-600 tabular">{timer.interruptions.external || ''}</span>
            </Button>
          </div>
          <p className="text-ink-600 max-w-sm text-center text-xs">
            Les interruptions se comptent sans arrêter le minuteur. Un focus définitivement
            interrompu, lui, s’annule : il ne compte pas comme un pomodoro, mais le temps passé
            reste dans tes statistiques.
          </p>
          <Button variant="danger" size="sm" onClick={() => voidPhase(Date.now())}>
            Annuler ce focus
          </Button>
        </div>
      )}

      <ActiveTaskBar />
    </div>
  )
}

function renderTime(
  mode: 'exact' | 'approximate' | 'percent' | 'hidden',
  value: number,
  planned: number,
  countingUp: boolean,
): string {
  if (mode === 'hidden') return '···'
  if (mode === 'percent') {
    const done = planned > 0 ? (countingUp ? value / planned : 1 - value / planned) : 0
    return `${Math.min(100, Math.max(0, Math.round(done * 100)))} %`
  }
  if (mode === 'approximate') return formatApproximate(Math.max(0, value))
  return countingUp ? formatClock(value) : formatSigned(value)
}

function statusLabel(status: string): string {
  if (status === 'running') return 'en cours'
  if (status === 'paused') return 'en pause'
  if (status === 'overtime') return 'temps dépassé'
  return 'à l’arrêt'
}

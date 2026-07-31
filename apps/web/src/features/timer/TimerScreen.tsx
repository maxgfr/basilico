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
import { IntentionField, SessionLog } from './SessionNotes'

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

  // A catch-up: the session ended while the tab was asleep.
  const missed = lastEnded && lastEnded.lateByMs > 60_000 ? lastEnded : null

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      {missed && (
        <div
          role="status"
          className="border-ink-800 bg-ink-900 text-ink-300 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm"
        >
          <span>
            Your {MODE_LABEL[missed.record.mode].toLowerCase()} ended{' '}
            <strong className="text-ink-100 font-medium">{formatAgo(missed.lateByMs)}</strong>. The
            session was recorded at the right time.
          </span>
          <Button variant="ghost" size="sm" onClick={dismissEnded}>
            Got it
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

      {/* State changes are announced, not every passing second. */}
      <p aria-live="polite" className="sr-only">
        {MODE_LABEL[timer.mode]} — {statusLabel(timer.status)}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="lg" onClick={() => toggle(Date.now())}>
          {timer.status === 'idle' && 'Start'}
          {timer.status === 'running' && 'Pause'}
          {timer.status === 'overtime' && 'Stop'}
          {timer.status === 'paused' && 'Resume'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => skipPhase(Date.now())}
          disabled={timer.status === 'idle'}
        >
          Skip
        </Button>
        <Button
          variant="ghost"
          onClick={() => resetPhase(Date.now())}
          disabled={timer.status === 'idle'}
        >
          Reset
        </Button>
        {pip.supported && (
          <Button variant="ghost" onClick={() => void pip.toggle()}>
            {pip.window ? 'Close floating window' : 'Floating window'}
          </Button>
        )}
      </div>

      {pip.window && <PipTimer target={pip.window} />}

      {isFocus && timer.status !== 'idle' && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-ink-600 text-xs">Interruption</span>
            <Button variant="ghost" size="sm" onClick={() => interrupt('internal')}>
              Internal{' '}
              <span className="text-ink-600 tabular">{timer.interruptions.internal || ''}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => interrupt('external')}>
              External{' '}
              <span className="text-ink-600 tabular">{timer.interruptions.external || ''}</span>
            </Button>
          </div>
          <p className="text-ink-600 max-w-sm text-center text-xs">
            Logging an interruption doesn’t stop the timer. Voiding a focus session does: it won’t
            count as a pomodoro, but the time you spent still shows up in your stats.
          </p>
          <Button variant="danger" size="sm" onClick={() => voidPhase(Date.now())}>
            Void this focus
          </Button>
        </div>
      )}

      <IntentionField />
      <SessionLog />
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
    return `${Math.min(100, Math.max(0, Math.round(done * 100)))}%`
  }
  if (mode === 'approximate') return formatApproximate(Math.max(0, value))
  return countingUp ? formatClock(value) : formatSigned(value)
}

function statusLabel(status: string): string {
  if (status === 'running') return 'running'
  if (status === 'paused') return 'paused'
  if (status === 'overtime') return 'past the deadline'
  return 'stopped'
}

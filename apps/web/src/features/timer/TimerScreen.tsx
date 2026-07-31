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
import { sound } from '../../platform/sound'
import { IntentionField, SessionLog } from './SessionNotes'
import { InterruptionMenu } from './InterruptionMenu'

export function TimerScreen() {
  const timer = useApp((s) => s.timer)
  const settings = useApp((s) => s.settings)
  const lastEnded = useApp((s) => s.lastEnded)
  const toggle = useApp((s) => s.toggle)
  const skipPhase = useApp((s) => s.skipPhase)
  const donePhase = useApp((s) => s.donePhase)
  const voidPhase = useApp((s) => s.voidPhase)
  const resetPhase = useApp((s) => s.resetPhase)
  const dismissEnded = useApp((s) => s.dismissEnded)

  const live = timer.status === 'running' || timer.status === 'overtime'
  const now = useNow(live)
  const pip = usePictureInPicture()

  const remaining = remainingMs(timer, now)
  const elapsed = elapsedMs(timer, now)
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
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            // The one reliable user gesture on the mouse path: without it the
            // AudioContext is never created and no alarm can ever ring.
            void sound.unlock()
            toggle(Date.now())
          }}
        >
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
        <InterruptionMenu />
      </div>

      {/*
        The two ways a focus session ends by hand, on their own line rather than
        in the control row or inside the interruption menu: they end the session
        instead of annotating it, so they are neither siblings of Pause nor a
        third kind of interruption — and the one that throws a pomodoro away
        should take a deliberate look to find.

        "Done" is hidden in overtime, where the primary button already reads
        "Stop" and does exactly this: two "end it and count it" actions on screen
        at once is one too many.
      */}
      {timer.mode === 'focus' && timer.status !== 'idle' && (
        <div className="flex flex-col items-center gap-4">
          {timer.status !== 'overtime' && (
            <div className="flex flex-col items-center gap-1">
              <Button variant="primary" size="sm" onClick={() => donePhase(Date.now())}>
                Done — count it
              </Button>
              <p className="text-ink-600 max-w-xs text-center text-xs">
                Ends the session now and counts the pomodoro, crediting the task.
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <Button variant="danger" size="sm" onClick={() => voidPhase(Date.now())}>
              Abandon this one
            </Button>
            <p className="text-ink-600 max-w-xs text-center text-xs">
              For when the interruption won. The time still counts in your stats; the pomodoro
              doesn’t.
            </p>
          </div>
        </div>
      )}

      {pip.window && <PipTimer target={pip.window} />}

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

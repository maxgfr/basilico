import { createPortal } from 'react-dom'
import { remainingMs, elapsedMs, progress as progressOf } from '@basilico/core'
import { useApp } from '../../store/app'
import { MODE_LABEL, formatClock, formatSigned } from '../../lib/format'
import { TimerRing } from './TimerRing'
import { useNow } from './runtime'

/**
 * Le minuteur dans la fenêtre flottante.
 *
 * Volontairement réduit à l'essentiel — le temps, le mode, démarrer/pause : une
 * fenêtre de 300 px posée par-dessus le travail de quelqu'un n'est pas l'endroit
 * où caser la liste des tâches.
 */
export function PipTimer({ target }: { target: Window }) {
  const timer = useApp((s) => s.timer)
  const toggle = useApp((s) => s.toggle)
  const live = timer.status === 'running' || timer.status === 'overtime'
  const now = useNow(live)

  const remaining = remainingMs(timer, now)
  const countingUp = remaining === null
  const value = countingUp ? elapsedMs(timer, now) : remaining

  return createPortal(
    <div className="bg-ink-950 text-ink-100 grid h-full w-full place-items-center">
      <button
        type="button"
        onClick={() => toggle(Date.now())}
        className="focus-visible:outline-ink-300 grid place-items-center focus-visible:outline-2"
        aria-label={timer.status === 'running' ? 'Mettre en pause' : 'Démarrer'}
      >
        <TimerRing
          mode={timer.mode}
          progress={countingUp ? 0 : progressOf(timer, now)}
          overtime={timer.status === 'overtime'}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="tabular text-3xl leading-none font-light">
              {countingUp ? formatClock(value) : formatSigned(value)}
            </span>
            <span className="text-ink-600 text-[11px]">
              {timer.status === 'paused' ? 'En pause' : MODE_LABEL[timer.mode]}
            </span>
          </div>
        </TimerRing>
      </button>
    </div>,
    target.document.body,
  )
}

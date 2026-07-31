import type { Mode } from '@basilico/core'

// viewBox units: the SVG is fluid, only the CSS box decides the real size.
const SIZE = 280
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Static classes: Tailwind cannot detect class names built at runtime. */
const HUE: Record<Mode, string> = {
  focus: 'text-focus',
  shortBreak: 'text-short',
  longBreak: 'text-long',
}

type Props = {
  mode: Mode
  /** 0 to 1. Past the deadline the ring simply stays full. */
  progress: number
  /** The ring pulses gently once the time is up. */
  overtime?: boolean
  children: React.ReactNode
}

export function TimerRing({ mode, progress, overtime = false, children }: Props) {
  return (
    <div className={`relative aspect-square w-[min(17.5rem,72vw)] ${HUE[mode]}`}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className={`h-full w-full ${overtime ? 'motion-safe:animate-pulse' : ''}`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-ink-800"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)))}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="transition-[stroke-dashoffset,stroke] duration-200 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

import type { Mode } from '@basilico/core'

// Unités du viewBox : le SVG est fluide, seule la boîte CSS décide de la taille réelle.
const SIZE = 280
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Classes statiques : Tailwind ne détecte pas les noms de classes construits. */
const HUE: Record<Mode, string> = {
  focus: 'text-focus',
  shortBreak: 'text-short',
  longBreak: 'text-long',
}

type Props = {
  mode: Mode
  /** 0 à 1. Au-delà de l'échéance, l'anneau reste plein. */
  progress: number
  /** L'anneau pulse doucement quand le temps est dépassé. */
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

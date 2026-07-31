import { useId, type ReactNode } from 'react'

export function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="border-ink-800 scroll-mt-24 border-t py-8 first:border-t-0 first:pt-0"
    >
      <div className="grid gap-6 md:grid-cols-[14rem_1fr] md:gap-10">
        <div>
          <h2 className="text-sm font-medium tracking-wide uppercase">{title}</h2>
          {description && <p className="text-ink-600 mt-1.5 text-sm">{description}</p>}
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-ink-100 block text-sm">
          {label}
        </label>
        {hint && <p className="text-ink-600 mt-0.5 text-xs">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
}) {
  const id = useId()
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`focus-visible:outline-ink-300 relative h-6 w-11 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${
          checked ? 'bg-focus' : 'bg-ink-800'
        }`}
      >
        <span
          className={`bg-ink-100 absolute top-1 size-4 rounded-full transition-transform duration-150 motion-reduce:transition-none ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </Row>
  )
}

export function NumberField({
  value,
  onChange,
  label,
  hint,
  min = 1,
  max = 240,
  suffix,
}: {
  value: number
  onChange: (next: number) => void
  label: string
  hint?: string
  min?: number
  max?: number
  suffix?: string
}) {
  const id = useId()
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))))
          }}
          className="border-ink-800 bg-ink-900 tabular focus:border-ink-600 h-9 w-20 rounded-lg border px-3 text-right text-sm outline-none"
        />
        {suffix && <span className="text-ink-600 w-12 text-xs">{suffix}</span>}
      </div>
    </Row>
  )
}

export function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
  hint,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
  label: string
  hint?: string
}) {
  return (
    <Row label={label} hint={hint}>
      <div role="radiogroup" aria-label={label} className="bg-ink-900 flex rounded-lg p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${
              value === option.value
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-600 hover:text-ink-300 hover:bg-ink-800/60'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Row>
  )
}

/**
 * A choice rendered as cards, each carrying its own explanation.
 *
 * A segmented control paired with a hint that changes on click forces you to
 * select an option to find out what it does. Here all three descriptions are
 * visible at once: you compare before you choose.
 */
export function OptionCards<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string; description: string }[]
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`focus-visible:outline-ink-300 rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${
              selected
                ? 'border-focus bg-ink-900'
                : 'border-ink-800 hover:border-ink-600 hover:bg-ink-900/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 rounded-full border ${
                  selected ? 'border-focus bg-focus' : 'border-ink-600'
                }`}
              />
              <span className="text-sm font-medium">{option.label}</span>
            </span>
            <span className="text-ink-600 mt-1.5 block text-xs leading-relaxed">
              {option.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

type PillTone = 'ok' | 'warn' | 'muted'

const PILL: Record<PillTone, string> = {
  ok: 'bg-focus/15 text-focus',
  warn: 'bg-danger-soft/60 text-danger',
  muted: 'bg-ink-800 text-ink-300',
}

/** State of a permission or capability, at a glance. */
export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PILL[tone]}`}>{children}</span>
  )
}

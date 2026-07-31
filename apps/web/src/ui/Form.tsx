import { useId, type ReactNode } from 'react'

export function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-ink-800 border-t py-8 first:border-t-0 first:pt-0">
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
        {suffix && <span className="text-ink-600 w-8 text-xs">{suffix}</span>}
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

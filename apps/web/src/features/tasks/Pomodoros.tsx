type Props = { done: number; estimated: number }

/**
 * `●●●○○ 3/5`: the dots read at a glance, the number stays to remove the
 * ambiguity once the estimate is exceeded (extra filled dots).
 */
export function Pomodoros({ done, estimated }: Props) {
  const slots = Math.max(estimated, done)
  const label = `${done} of ${estimated} estimated pomodoro${estimated > 1 ? 's' : ''}`

  return (
    <span className="flex items-center gap-1.5" title={label}>
      <span className="flex items-center gap-1" role="img" aria-label={label}>
        {Array.from({ length: Math.min(slots, 8) }, (_, i) => (
          <span
            key={i}
            className={
              i < done
                ? 'bg-focus h-1.5 w-1.5 rounded-full'
                : 'border-ink-600 h-1.5 w-1.5 rounded-full border'
            }
          />
        ))}
        {slots > 8 && <span className="text-ink-600 text-[10px]">…</span>}
      </span>
      <span className="text-ink-600 tabular text-xs" aria-hidden="true">
        {done}/{estimated}
      </span>
    </span>
  )
}

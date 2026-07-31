type Props = { done: number; total: number }

/**
 * Position in the cycle, as dots rather than "2/4": readable at a glance without
 * reading a number. The textual label stays available to screen readers, and
 * colour alone never carries the information.
 */
export function CyclePips({ done, total }: Props) {
  const filled = Math.min(done, total)
  return (
    <span
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${done} of ${total} focus sessions before the long break`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i < filled
              ? 'h-1.5 w-1.5 rounded-full bg-current'
              : 'border-ink-600 h-1.5 w-1.5 rounded-full border'
          }
        />
      ))}
    </span>
  )
}

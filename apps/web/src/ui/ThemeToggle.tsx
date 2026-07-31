import type { Settings } from '@basilico/core'
import { useApp } from '../store/app'

type Theme = Settings['theme']

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'Auto',
    icon: <path d="M3 4.5h10v6H3zM6 13h4M8 10.5V13" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    value: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="8" cy="8" r="3" />
        <path
          d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <path d="M13 9.3A5.6 5.6 0 0 1 6.7 3a5.6 5.6 0 1 0 6.3 6.3Z" strokeLinejoin="round" />,
  },
]

/**
 * Light / dark / auto switch, right in the header.
 *
 * The theme is the setting people change most often and most quickly; hunting
 * for it inside a settings page is needless friction. It stays there too, with
 * its explanations.
 */
export function ThemeToggle() {
  const theme = useApp((s) => s.settings.theme)
  const update = useApp((s) => s.updateSettings)

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-ink-900 flex items-center gap-0.5 rounded-lg p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => update({ theme: option.value })}
          className={`grid size-7 place-items-center rounded-md transition-colors duration-150 motion-reduce:transition-none ${
            theme === option.value
              ? 'bg-ink-800 text-ink-100'
              : 'text-ink-600 hover:text-ink-300 hover:bg-ink-800/60'
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            {option.icon}
          </svg>
        </button>
      ))}
    </div>
  )
}

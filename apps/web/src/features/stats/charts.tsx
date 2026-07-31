import type { DayBucket } from '@basilico/core'
import { formatDuration } from '../../lib/format'

const WEEKDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Barres journalières. Rien d'autre que des rectangles : aucune bibliothèque requise. */
export function DailyBars({ data }: { data: DayBucket[] }) {
  const max = Math.max(...data.map((d) => d.focusMs), 1)

  return (
    <div aria-hidden="true" className="flex h-40 items-end gap-1.5">
      {data.map((day) => {
        const height = (day.focusMs / max) * 100
        const date = new Date(day.ts)
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end">
              <div
                className={`w-full rounded-sm transition-[height] duration-200 motion-reduce:transition-none ${
                  day.focusMs > 0 ? 'bg-focus' : 'bg-ink-800'
                }`}
                style={{ height: `${Math.max(height, day.focusMs > 0 ? 4 : 2)}%` }}
                title={`${day.date} — ${formatDuration(day.focusMs)}`}
              />
            </div>
            <span className="text-ink-600 text-[10px]">
              {WEEKDAY[(date.getDay() + 6) % 7]}
              <span className="tabular ml-0.5">{date.getDate()}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

const LEVELS = ['bg-ink-800', 'bg-focus/25', 'bg-focus/50', 'bg-focus/75', 'bg-focus']

/** Palier de couleur d'une case. Le premier palier reste distinct du vide. */
function levelOf(ms: number, max: number): number {
  if (ms <= 0) return 0
  const ratio = ms / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

/**
 * Heatmap façon graphe de contributions : 53 colonnes de 7 cases. C'est la vue
 * qu'aucun minuteur open source ne propose, et celle qui donne le plus envie de
 * ne pas casser sa série.
 */
export function Heatmap({ data }: { data: DayBucket[] }) {
  const max = Math.max(...data.map((d) => d.focusMs), 1)

  // On commence la grille au lundi précédant le premier jour affiché.
  const first = data[0]
  if (!first) return null
  const offset = (new Date(first.ts).getDay() + 6) % 7
  const cells: (DayBucket | null)[] = [...Array.from({ length: offset }, () => null), ...data]
  const columns = Math.ceil(cells.length / 7)

  return (
    <div aria-hidden="true" className="flex gap-1">
      <div className="text-ink-600 mr-1 flex flex-col justify-between py-0.5 text-[9px]">
        <span>M</span>
        <span>W</span>
        <span>F</span>
        <span>S</span>
      </div>
      {Array.from({ length: columns }, (_col, column) => (
        <div key={column} className="flex flex-col gap-1">
          {Array.from({ length: 7 }, (_row, row) => {
            const cell = cells[column * 7 + row]
            if (!cell) return <span key={`empty-${column}-${row}`} className="size-2.5" />
            return (
              <span
                key={cell.date}
                className={`size-2.5 rounded-[2px] ${LEVELS[levelOf(cell.focusMs, max)]}`}
                title={`${cell.date} — ${formatDuration(cell.focusMs)}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Profil horaire : quand travailles-tu vraiment. */
export function HourProfile({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1)
  return (
    <div aria-hidden="true" className="flex h-24 items-end gap-px">
      {hours.map((ms, hour) => (
        <div key={hour} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-16 w-full items-end">
            <div
              className={`w-full rounded-t-[2px] ${ms > 0 ? 'bg-short' : 'bg-ink-800'}`}
              style={{ height: `${Math.max((ms / max) * 100, ms > 0 ? 6 : 2)}%` }}
              title={`${hour}:00 — ${formatDuration(ms)}`}
            />
          </div>
          {hour % 6 === 0 && <span className="text-ink-600 tabular text-[9px]">{hour}h</span>}
        </div>
      ))}
    </div>
  )
}

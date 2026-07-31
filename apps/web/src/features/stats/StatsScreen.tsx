import { useMemo } from 'react'
import {
  byHour,
  byTag,
  currentStreak,
  dailySeries,
  estimationAccuracy,
  sessionsBetween,
  startOfDay,
  summarize,
} from '@basilico/core'
import { useApp } from '../../store/app'
import { formatDuration } from '../../lib/format'
import { Figure } from './Figure'
import { DailyBars, Heatmap, HourProfile } from './charts'

export function StatsScreen() {
  const sessions = useApp((s) => s.sessions)
  const tasks = useApp((s) => s.tasks)
  const goalMinutes = useApp((s) => s.settings.dailyGoalMinutes)

  const stats = useMemo(() => {
    const now = Date.now()
    const dayStart = startOfDay(now)
    const today = summarize(sessionsBetween(sessions, dayStart, dayStart + 86_400_000 * 2))
    return {
      now,
      today,
      all: summarize(sessions),
      fortnight: dailySeries(sessions, 14, now),
      year: dailySeries(sessions, 364, now),
      hours: byHour(sessions),
      tags: byTag(sessions),
      streak: currentStreak(sessions, now),
      estimation: estimationAccuracy(tasks),
    }
  }, [sessions, tasks])

  if (sessions.length === 0) return <EmptyStats />

  const goalMs = goalMinutes * 60_000
  const goalRatio = goalMs > 0 ? Math.min(1, stats.today.focusMs / goalMs) : 0

  return (
    <div className="flex flex-col gap-6 py-6">
      <h1 className="sr-only">Stats</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Focus today" value={formatDuration(stats.today.focusMs)}>
          {goalMs > 0 && (
            <div className="bg-ink-800 mt-3 h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-focus h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${goalRatio * 100}%` }}
              />
            </div>
          )}
        </Stat>
        <Stat label="Pomodoros today" value={String(stats.today.completedFocus)} />
        <Stat
          label="Current streak"
          value={stats.streak > 0 ? `${stats.streak} d` : '—'}
          hint={stats.streak > 1 ? 'consecutive days' : undefined}
        />
        <Stat
          label="All time"
          value={formatDuration(stats.all.focusMs)}
          hint={`${stats.all.completedFocus} pomodoros`}
        />
      </div>

      <Figure
        title="Last fourteen days"
        summary={`Focus minutes per day. Total ${formatDuration(
          stats.fortnight.reduce((n, d) => n + d.focusMs, 0),
        )}.`}
        columns={['Day', 'Focus']}
        rows={stats.fortnight.map((d) => [d.date, formatDuration(d.focusMs)])}
      >
        <DailyBars data={stats.fortnight} />
      </Figure>

      <Figure
        title="Across the year"
        summary="One cell per day; the lighter the cell, the less focus that day."
        columns={['Day', 'Focus']}
        rows={stats.year
          .filter((d) => d.focusMs > 0)
          .map((d) => [d.date, formatDuration(d.focusMs)])}
      >
        <Heatmap data={stats.year} />
      </Figure>

      <div className="grid gap-6 lg:grid-cols-2">
        <Figure
          title="Your productive hours"
          summary="How your focus time spreads across the 24 hours of the day."
          columns={['Hour', 'Focus']}
          rows={stats.hours
            .map((ms, hour): [string, string] => [`${hour}:00`, formatDuration(ms)])
            .filter(([, value]) => value !== '—')}
        >
          <HourProfile hours={stats.hours} />
        </Figure>

        <Figure
          title="Interruptions"
          summary={`${stats.all.interruptions.internal} internal and ${stats.all.interruptions.external} external so far.`}
          columns={['Kind', 'Count']}
          rows={[
            ['Internal', String(stats.all.interruptions.internal)],
            ['External', String(stats.all.interruptions.external)],
            ['Voided focus sessions', String(stats.all.voidedFocus)],
          ]}
        >
          <dl aria-hidden="true" className="grid grid-cols-3 gap-4 pt-2">
            <Metric label="Internal" value={stats.all.interruptions.internal} />
            <Metric label="External" value={stats.all.interruptions.external} />
            <Metric label="Voided" value={stats.all.voidedFocus} />
          </dl>
          <p className="text-ink-600 mt-4 text-xs">
            Internal ones come from you, external ones from other people. Counting them is the first
            step to having fewer of them.
          </p>
        </Figure>
      </div>

      {stats.estimation.rows.length > 0 && (
        <Figure
          title="How accurate your estimates are"
          summary={
            stats.estimation.overall === null
              ? 'No completed task yet.'
              : `On average your tasks take ${formatRatio(stats.estimation.overall)} of what you plan.`
          }
          columns={['Task', 'Actual / estimated']}
          rows={stats.estimation.rows.map((r) => [r.title, `${r.actual} / ${r.estimated}`])}
        >
          <ul aria-hidden="true" className="flex flex-col gap-2 text-sm">
            {stats.estimation.rows.slice(0, 8).map((row) => (
              <li key={row.taskId} className="flex items-center justify-between gap-4">
                <span className="text-ink-300 truncate">{row.title}</span>
                <span
                  className={`tabular shrink-0 text-xs ${row.ratio > 1 ? 'text-long' : 'text-focus'}`}
                >
                  {row.actual} / {row.estimated} · {formatRatio(row.ratio)}
                </span>
              </li>
            ))}
          </ul>
        </Figure>
      )}

      {stats.tags.length > 0 && (
        <Figure
          title="By tag"
          summary="How your focus time splits between tags."
          columns={['Tag', 'Focus']}
          rows={stats.tags.map((t) => [t.key, formatDuration(t.focusMs)])}
        >
          <ul aria-hidden="true" className="flex flex-col gap-2 text-sm">
            {stats.tags.slice(0, 8).map((tag) => (
              <li key={tag.key} className="flex items-center gap-3">
                <span className="text-ink-300 w-32 shrink-0 truncate">#{tag.key}</span>
                <span className="bg-ink-800 h-1.5 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-focus block h-full rounded-full"
                    style={{
                      width: `${(tag.focusMs / (stats.tags[0]?.focusMs ?? 1)) * 100}%`,
                    }}
                  />
                </span>
                <span className="text-ink-600 tabular w-16 shrink-0 text-right text-xs">
                  {formatDuration(tag.focusMs)}
                </span>
              </li>
            ))}
          </ul>
        </Figure>
      )}
    </div>
  )
}

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function Stat({
  label,
  value,
  hint,
  children,
}: {
  label: string
  value: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border-ink-800 bg-ink-900/40 rounded-xl border p-4">
      <div className="text-ink-600 text-xs">{label}</div>
      <div className="tabular mt-1 text-2xl font-light">{value}</div>
      {hint && <div className="text-ink-600 mt-0.5 text-xs">{hint}</div>}
      {children}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-ink-600 text-xs">{label}</dt>
      <dd className="tabular mt-1 text-xl font-light">{value}</dd>
    </div>
  )
}

function EmptyStats() {
  return (
    <div className="border-ink-800 mx-auto mt-16 max-w-md rounded-xl border border-dashed p-8 text-center">
      <h1 className="text-lg font-medium">Nothing to show yet</h1>
      <p className="text-ink-600 mt-3 text-sm">
        Finish your first focus session and this page fills up: minutes per day, your streak, the
        hours you actually get things done, interruptions, and the gap between what you estimate and
        what you really spend.
      </p>
    </div>
  )
}

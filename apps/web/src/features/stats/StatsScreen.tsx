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
      <h1 className="sr-only">Statistiques</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Focus aujourd’hui" value={formatDuration(stats.today.focusMs)}>
          {goalMs > 0 && (
            <div className="bg-ink-800 mt-3 h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-focus h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${goalRatio * 100}%` }}
              />
            </div>
          )}
        </Stat>
        <Stat label="Pomodoros aujourd’hui" value={String(stats.today.completedFocus)} />
        <Stat
          label="Série en cours"
          value={stats.streak > 0 ? `${stats.streak} j` : '—'}
          hint={stats.streak > 1 ? 'jours consécutifs' : undefined}
        />
        <Stat
          label="Total"
          value={formatDuration(stats.all.focusMs)}
          hint={`${stats.all.completedFocus} pomodoros`}
        />
      </div>

      <Figure
        title="Quatorze derniers jours"
        summary={`Minutes de focus par jour. Total ${formatDuration(
          stats.fortnight.reduce((n, d) => n + d.focusMs, 0),
        )}.`}
        columns={['Jour', 'Focus']}
        rows={stats.fortnight.map((d) => [d.date, formatDuration(d.focusMs)])}
      >
        <DailyBars data={stats.fortnight} />
      </Figure>

      <Figure
        title="Sur un an"
        summary="Une case par jour, plus la case est claire moins il y a eu de focus."
        columns={['Jour', 'Focus']}
        rows={stats.year
          .filter((d) => d.focusMs > 0)
          .map((d) => [d.date, formatDuration(d.focusMs)])}
      >
        <Heatmap data={stats.year} />
      </Figure>

      <div className="grid gap-6 lg:grid-cols-2">
        <Figure
          title="Tes heures productives"
          summary="Répartition du temps de focus sur les 24 heures de la journée."
          columns={['Heure', 'Focus']}
          rows={stats.hours
            .map((ms, hour): [string, string] => [`${hour} h`, formatDuration(ms)])
            .filter(([, value]) => value !== '—')}
        >
          <HourProfile hours={stats.hours} />
        </Figure>

        <Figure
          title="Interruptions"
          summary={`${stats.all.interruptions.internal} internes et ${stats.all.interruptions.external} externes depuis le début.`}
          columns={['Type', 'Nombre']}
          rows={[
            ['Internes', String(stats.all.interruptions.internal)],
            ['Externes', String(stats.all.interruptions.external)],
            ['Focus annulés', String(stats.all.voidedFocus)],
          ]}
        >
          <dl aria-hidden="true" className="grid grid-cols-3 gap-4 pt-2">
            <Metric label="Internes" value={stats.all.interruptions.internal} />
            <Metric label="Externes" value={stats.all.interruptions.external} />
            <Metric label="Focus annulés" value={stats.all.voidedFocus} />
          </dl>
          <p className="text-ink-600 mt-4 text-xs">
            Les internes viennent de toi, les externes des autres. Les compter est la première étape
            pour les faire baisser.
          </p>
        </Figure>
      </div>

      {stats.estimation.rows.length > 0 && (
        <Figure
          title="Précision de tes estimations"
          summary={
            stats.estimation.overall === null
              ? 'Pas encore de tâche terminée.'
              : `En moyenne, tes tâches prennent ${formatRatio(stats.estimation.overall)} de ce que tu prévois.`
          }
          columns={['Tâche', 'Réel / estimé']}
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
          title="Par tag"
          summary="Répartition du temps de focus entre tes tags."
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
  return `${Math.round(ratio * 100)} %`
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
      <h1 className="text-lg font-medium">Rien à montrer pour l’instant</h1>
      <p className="text-ink-600 mt-3 text-sm">
        Termine un premier focus et cette page se remplira : minutes par jour, série de jours,
        heures les plus productives, interruptions, et l’écart entre ce que tu estimes et ce que tu
        passes réellement.
      </p>
    </div>
  )
}

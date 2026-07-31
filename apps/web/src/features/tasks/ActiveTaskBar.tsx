import { useApp } from '../../store/app'
import { Pomodoros } from './Pomodoros'

/**
 * Rappel de ce sur quoi la session en cours est imputée. Sans ça, les statistiques
 * par tâche se remplissent de sessions rattachées à la mauvaise chose.
 */
export function ActiveTaskBar() {
  const activeTaskId = useApp((s) => s.activeTaskId)
  const task = useApp((s) => s.tasks.find((t) => t.id === s.activeTaskId) ?? null)

  if (!activeTaskId || !task) {
    return (
      <p className="text-ink-600 px-4 text-center text-sm">
        No active task — this session won’t be attributed to anything.
      </p>
    )
  }

  return (
    <div className="text-ink-300 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 text-center text-sm">
      <span className="text-ink-600">Working on</span>
      <span className="text-ink-100 max-w-full truncate font-medium">{task.title}</span>
      <Pomodoros done={task.completedPomodoros} estimated={task.estimatedPomodoros} />
    </div>
  )
}

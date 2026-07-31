import type { Task, TaskStatus } from './types'

export type NewTask = {
  title: string
  estimatedPomodoros?: number
  tag?: string | null
  notes?: string | null
}

export function createTask(tasks: readonly Task[], input: NewTask, now: number, id: string): Task {
  const maxOrder = tasks.reduce((max, t) => (t.order > max ? t.order : max), -1)
  return {
    id,
    title: input.title.trim(),
    notes: input.notes ?? null,
    tag: input.tag ?? null,
    estimatedPomodoros: Math.max(1, Math.round(input.estimatedPomodoros ?? 1)),
    completedPomodoros: 0,
    status: 'active',
    order: maxOrder + 1,
    createdAt: now,
    completedAt: null,
  }
}

export function updateTask(tasks: readonly Task[], id: string, patch: Partial<Task>): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t))
}

export function setTaskStatus(
  tasks: readonly Task[],
  id: string,
  status: TaskStatus,
  now: number,
): Task[] {
  return tasks.map((t) =>
    t.id === id ? { ...t, status, completedAt: status === 'done' ? now : null } : t,
  )
}

export function removeTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id)
}

/**
 * Incrémente le compteur de pomodoros d'une tâche. Appelé à la **fin** d'un focus
 * terminé, jamais à son démarrage : un focus commencé n'est pas un focus fait.
 */
export function creditPomodoro(tasks: readonly Task[], id: string | null): Task[] {
  if (id === null) return [...tasks]
  return tasks.map((t) =>
    t.id === id ? { ...t, completedPomodoros: t.completedPomodoros + 1 } : t,
  )
}

/** Réordonne par glisser-déposer : déplace `id` à l'index `to` parmi les tâches actives. */
export function reorderTasks(tasks: readonly Task[], id: string, to: number): Task[] {
  const ordered = tasks.toSorted((a, b) => a.order - b.order)
  const from = ordered.findIndex((t) => t.id === id)
  if (from === -1) return [...tasks]

  const target = Math.min(Math.max(0, to), ordered.length - 1)
  const [moved] = ordered.splice(from, 1)
  if (!moved) return [...tasks]
  ordered.splice(target, 0, moved)

  return ordered.map((t, index) => ({ ...t, order: index }))
}

export function visibleTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter((t) => t.status !== 'archived').toSorted((a, b) => a.order - b.order)
}

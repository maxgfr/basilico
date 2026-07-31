import type { Task, TaskStatus } from './types'

/**
 * Pulls `#tags` out of a typed title.
 *
 * Typing "Write the core #basilico" beats a second input box: the task form
 * lives in a 20 rem column where a dedicated tag field pushed everything onto a
 * second line, and this is the convention people already use everywhere else.
 * Only the first tag is kept — a session belongs to one bucket, not several.
 */
export function parseTaskInput(raw: string): { title: string; tag: string | null } {
  const tags = [...raw.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1] ?? '')
  const title = raw
    .replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tag = tags[0] ?? null
  // A title made only of tags would leave an empty row: keep the raw text then.
  return { title: title === '' ? raw.trim() : title, tag: title === '' ? null : tag }
}

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

/** Renames a task, re-reading any `#tag` typed into the new title. */
export function renameTask(tasks: readonly Task[], id: string, raw: string): Task[] {
  const { title, tag } = parseTaskInput(raw)
  if (title === '') return [...tasks]
  return tasks.map((t) => (t.id === id ? { ...t, title, tag: tag ?? t.tag } : t))
}

/** Every tag in use, most recent first — feeds the input's suggestions. */
export function knownTags(tasks: readonly Task[]): string[] {
  const seen = new Set<string>()
  for (const task of [...tasks].reverse()) {
    if (task.tag) seen.add(task.tag)
  }
  return [...seen]
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
 * Increments a task's pomodoro counter. Called at the **end** of a completed
 * focus session, never at its start: a focus begun is not a focus done.
 */
export function creditPomodoro(tasks: readonly Task[], id: string | null): Task[] {
  if (id === null) return [...tasks]
  return tasks.map((t) =>
    t.id === id ? { ...t, completedPomodoros: t.completedPomodoros + 1 } : t,
  )
}

/** Reorders: moves `id` to index `to` among the active tasks. */
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

import { dayKey } from './stats'
import type { SessionRecord, Task, TaskStatus } from './types'

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
    // New tasks land on today's plan: you almost always add one because you are
    // about to do it. Pushing it to the backlog would mean a second click every
    // single time.
    plannedFor: dayKey(now),
  }
}

/**
 * Cirillo's rule: "If it takes more than 5-7 pomodoros, break it down."
 *
 * Past this size an estimate stops being an estimate — you cannot picture seven
 * uninterrupted stretches of work, so the number is a guess and the task is
 * really several tasks.
 */
export const BREAKDOWN_THRESHOLD = 7

export const needsBreakdown = (task: Task): boolean => task.estimatedPomodoros > BREAKDOWN_THRESHOLD

/** Puts a task on a day's plan, or back in the backlog with `null`. */
export function planTask(tasks: readonly Task[], id: string, day: string | null): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, plannedFor: day } : t))
}

/**
 * Rolls unfinished work forward.
 *
 * A task still planned for a past day is not a plan any more, it is a leftover —
 * and leaving it dated yesterday would quietly hide it from today's list. Done
 * and archived ones keep their date: that is the record of when they were done.
 */
export function carryOver(tasks: readonly Task[], today: string): Task[] {
  return tasks.map((t) =>
    t.status === 'active' && t.plannedFor !== null && t.plannedFor < today
      ? { ...t, plannedFor: today }
      : t,
  )
}

/** Tasks on a given day's plan, in order. */
export function plannedFor(tasks: readonly Task[], day: string): Task[] {
  return tasks
    .filter((t) => t.plannedFor === day && t.status !== 'archived')
    .toSorted((a, b) => a.order - b.order)
}

/** Everything still waiting in the inventory, never scheduled. */
export function backlog(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((t) => t.plannedFor === null && t.status === 'active')
    .toSorted((a, b) => a.order - b.order)
}

/**
 * Everything archived, newest first.
 *
 * Archiving is meant to be the reversible way out — the one that keeps a task's
 * history where deleting drops it. That only holds if you can still see what you
 * archived: without this the tasks sat in storage and in the export, and nowhere
 * in the app.
 */
export function archivedTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter((t) => t.status === 'archived').toSorted((a, b) => b.createdAt - a.createdAt)
}

export type DayLoad = {
  estimated: number
  completed: number
  /** Estimated pomodoros still to do, i.e. excluding finished tasks. */
  remaining: number
}

/** What the day's plan actually adds up to, in pomodoros. */
export function dayLoad(tasks: readonly Task[], day: string): DayLoad {
  let estimated = 0
  let completed = 0
  let remaining = 0

  for (const task of plannedFor(tasks, day)) {
    estimated += task.estimatedPomodoros
    completed += task.completedPomodoros
    if (task.status !== 'done') {
      remaining += Math.max(0, task.estimatedPomodoros - task.completedPomodoros)
    }
  }

  return { estimated, completed, remaining }
}

/** Focus time actually spent per task, keyed by task id. */
export function timeByTask(sessions: readonly SessionRecord[]): Map<string, number> {
  const spent = new Map<string, number>()
  for (const session of sessions) {
    if (session.mode !== 'focus' || session.taskId === null) continue
    spent.set(session.taskId, (spent.get(session.taskId) ?? 0) + session.actualMs)
  }
  return spent
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

/**
 * Fills in fields added after a task was stored. Without this, tasks saved
 * before the day plan existed would have `plannedFor` undefined and vanish from
 * both lists — present in storage, invisible in the app.
 */
export function normalizeTask(task: Task): Task {
  return { ...task, plannedFor: task.plannedFor ?? null }
}

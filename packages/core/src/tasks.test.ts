import { describe, expect, it } from 'vitest'
import {
  backlog,
  carryOver,
  createTask,
  creditPomodoro,
  dayLoad,
  needsBreakdown,
  normalizeTask,
  planTask,
  plannedFor,
  timeByTask,
  knownTags,
  parseTaskInput,
  renameTask,
  reorderTasks,
  setTaskStatus,
  updateTask,
  visibleTasks,
} from './tasks'
import type { Task } from './types'

function seed(): Task[] {
  let tasks: Task[] = []
  tasks = [...tasks, createTask(tasks, { title: 'A' }, 0, 'a')]
  tasks = [...tasks, createTask(tasks, { title: 'B', estimatedPomodoros: 3 }, 0, 'b')]
  tasks = [...tasks, createTask(tasks, { title: 'C' }, 0, 'c')]
  return tasks
}

describe('tasks', () => {
  it('appends new tasks at the end', () => {
    expect(seed().map((t) => t.order)).toEqual([0, 1, 2])
  })

  it('enforces at least one estimated pomodoro', () => {
    const t = createTask([], { title: 'X', estimatedPomodoros: 0 }, 0, 'x')
    expect(t.estimatedPomodoros).toBe(1)
  })

  it('reorders and renumbers cleanly', () => {
    const moved = reorderTasks(seed(), 'c', 0)
    expect(moved.map((t) => t.id)).toEqual(['c', 'a', 'b'])
    expect(moved.map((t) => t.order)).toEqual([0, 1, 2])
  })

  it('stays in bounds when the target index is absurd', () => {
    expect(reorderTasks(seed(), 'a', 99).map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('credits a pomodoro to the active task, and tolerates having none', () => {
    const credited = creditPomodoro(seed(), 'b')
    expect(credited.find((t) => t.id === 'b')?.completedPomodoros).toBe(1)
    expect(creditPomodoro(credited, null)).toEqual(credited)
  })

  it('hides archived tasks and keeps completed ones visible', () => {
    let tasks = setTaskStatus(seed(), 'a', 'done', 500)
    tasks = setTaskStatus(tasks, 'b', 'archived', 500)
    expect(visibleTasks(tasks).map((t) => t.id)).toEqual(['a', 'c'])
    expect(tasks.find((t) => t.id === 'a')?.completedAt).toBe(500)
  })
})

describe('typed input', () => {
  it('pulls a #tag out of the title', () => {
    expect(parseTaskInput('Write the core #basilico')).toEqual({
      title: 'Write the core',
      tag: 'basilico',
    })
  })

  it('keeps only the first tag: a session belongs to one bucket', () => {
    expect(parseTaskInput('Ship it #work #urgent').tag).toBe('work')
    expect(parseTaskInput('Ship it #work #urgent').title).toBe('Ship it')
  })

  it('accepts a tag anywhere and squeezes the leftover spaces', () => {
    expect(parseTaskInput('Review  #work  the PR')).toEqual({
      title: 'Review the PR',
      tag: 'work',
    })
  })

  it('accepts non-ascii letters and digits in a tag', () => {
    expect(parseTaskInput('Notes #naïve2').tag).toBe('naïve2')
  })

  it('leaves a bare tag as the title rather than an empty row', () => {
    expect(parseTaskInput('#work')).toEqual({ title: '#work', tag: null })
  })

  it('is a no-op on a title without a tag', () => {
    expect(parseTaskInput('  Plain title  ')).toEqual({ title: 'Plain title', tag: null })
  })
})

describe('renaming', () => {
  it('re-reads a tag typed into the new title', () => {
    const tasks = renameTask(seed(), 'a', 'Renamed #work')
    const task = tasks.find((t) => t.id === 'a')
    expect(task?.title).toBe('Renamed')
    expect(task?.tag).toBe('work')
  })

  it('keeps the existing tag when the new title has none', () => {
    let tasks = updateTask(seed(), 'a', { tag: 'kept' })
    tasks = renameTask(tasks, 'a', 'Renamed')
    expect(tasks.find((t) => t.id === 'a')?.tag).toBe('kept')
  })

  it('refuses to blank out a title', () => {
    const tasks = renameTask(seed(), 'a', '   ')
    expect(tasks.find((t) => t.id === 'a')?.title).toBe('A')
  })
})

describe('known tags', () => {
  it('lists tags in use, most recent first, without duplicates', () => {
    let tasks = updateTask(seed(), 'a', { tag: 'work' })
    tasks = updateTask(tasks, 'b', { tag: 'home' })
    tasks = updateTask(tasks, 'c', { tag: 'work' })
    expect(knownTags(tasks)).toEqual(['work', 'home'])
  })
})

describe('the day plan', () => {
  const TODAY = '2026-07-31'
  const YESTERDAY = '2026-07-30'

  it('puts a new task on today rather than in the backlog', () => {
    const task = createTask([], { title: 'Now' }, new Date(2026, 6, 31, 10).getTime(), 'n')
    // You almost always add a task because you are about to do it; sending it to
    // the backlog would mean a second click every single time.
    expect(task.plannedFor).toBe(TODAY)
  })

  it('separates the plan from the inventory', () => {
    let tasks: Task[] = seed().map((t) => ({ ...t, plannedFor: null }))
    tasks = planTask(tasks, 'b', TODAY)
    expect(plannedFor(tasks, TODAY).map((t) => t.id)).toEqual(['b'])
    expect(backlog(tasks).map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('sends a task back to the inventory', () => {
    let tasks = planTask(seed(), 'a', TODAY)
    tasks = planTask(tasks, 'a', null)
    expect(backlog(tasks).map((t) => t.id)).toContain('a')
  })

  it('rolls unfinished work forward to today', () => {
    let tasks: Task[] = seed().map((t) => ({ ...t, plannedFor: YESTERDAY }))
    tasks = setTaskStatus(tasks, 'b', 'done', 0)
    tasks = carryOver(tasks, TODAY)

    // Leftovers move: dated yesterday, they would quietly vanish from today.
    expect(tasks.find((t) => t.id === 'a')?.plannedFor).toBe(TODAY)
    // A finished task keeps its date — that is the record of when it was done.
    expect(tasks.find((t) => t.id === 'b')?.plannedFor).toBe(YESTERDAY)
  })

  it('leaves the backlog alone when carrying over', () => {
    const tasks = carryOver(
      seed().map((t) => ({ ...t, plannedFor: null })),
      TODAY,
    )
    expect(backlog(tasks)).toHaveLength(3)
  })

  it('adds up what the day actually asks of you', () => {
    let tasks: Task[] = seed().map((t) => ({ ...t, plannedFor: TODAY }))
    tasks = updateTask(tasks, 'b', { completedPomodoros: 2 })
    tasks = setTaskStatus(tasks, 'c', 'done', 0)

    // a: 1 estimated, b: 3 estimated with 2 done, c: done so nothing remains.
    expect(dayLoad(tasks, TODAY)).toEqual({ estimated: 5, completed: 2, remaining: 2 })
  })

  it('flags a task too big to be one task', () => {
    expect(needsBreakdown({ ...seed()[0]!, estimatedPomodoros: 7 })).toBe(false)
    expect(needsBreakdown({ ...seed()[0]!, estimatedPomodoros: 8 })).toBe(true)
  })

  it('fills in the day field for tasks stored before it existed', () => {
    const { plannedFor: _dropped, ...legacy } = seed()[0]!
    // Left undefined it would match neither list and disappear from the app.
    expect(normalizeTask(legacy as Task).plannedFor).toBeNull()
  })
})

describe('time spent', () => {
  it('totals focus time per task and ignores breaks', () => {
    const session = (taskId: string | null, mode: 'focus' | 'shortBreak', minutes: number) => ({
      id: `s-${taskId}-${mode}-${minutes}`,
      mode,
      startedAt: 0,
      endedAt: 0,
      plannedMs: 0,
      actualMs: minutes * 60_000,
      overtimeMs: 0,
      outcome: 'completed' as const,
      taskId,
      tag: null,
      interruptions: { internal: 0, external: 0 },
      intention: null,
      note: null,
      rating: null,
    })

    const spent = timeByTask([
      session('a', 'focus', 25),
      session('a', 'focus', 10),
      session('a', 'shortBreak', 5),
      session(null, 'focus', 25),
    ])

    expect(spent.get('a')).toBe(35 * 60_000)
    expect(spent.size).toBe(1)
  })
})

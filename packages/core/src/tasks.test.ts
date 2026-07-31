import { describe, expect, it } from 'vitest'
import {
  createTask,
  creditPomodoro,
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

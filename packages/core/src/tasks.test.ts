import { describe, expect, it } from 'vitest'
import { createTask, creditPomodoro, reorderTasks, setTaskStatus, visibleTasks } from './tasks'
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

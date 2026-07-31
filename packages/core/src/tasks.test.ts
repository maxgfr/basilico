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

describe('tâches', () => {
  it('empile les nouvelles tâches à la fin', () => {
    expect(seed().map((t) => t.order)).toEqual([0, 1, 2])
  })

  it('impose au moins un pomodoro estimé', () => {
    const t = createTask([], { title: 'X', estimatedPomodoros: 0 }, 0, 'x')
    expect(t.estimatedPomodoros).toBe(1)
  })

  it('réordonne et renumérote proprement', () => {
    const moved = reorderTasks(seed(), 'c', 0)
    expect(moved.map((t) => t.id)).toEqual(['c', 'a', 'b'])
    expect(moved.map((t) => t.order)).toEqual([0, 1, 2])
  })

  it('ne sort pas des bornes quand la cible est absurde', () => {
    expect(reorderTasks(seed(), 'a', 99).map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('crédite un pomodoro à la tâche active, et ignore l’absence de tâche', () => {
    const credited = creditPomodoro(seed(), 'b')
    expect(credited.find((t) => t.id === 'b')?.completedPomodoros).toBe(1)
    expect(creditPomodoro(credited, null)).toEqual(credited)
  })

  it('masque les archivées et garde les terminées visibles', () => {
    let tasks = setTaskStatus(seed(), 'a', 'done', 500)
    tasks = setTaskStatus(tasks, 'b', 'archived', 500)
    expect(visibleTasks(tasks).map((t) => t.id)).toEqual(['a', 'c'])
    expect(tasks.find((t) => t.id === 'a')?.completedAt).toBe(500)
  })
})

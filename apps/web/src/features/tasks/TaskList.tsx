import { useState, type FormEvent } from 'react'
import { visibleTasks, type Task } from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { Pomodoros } from './Pomodoros'

export function TaskList() {
  const tasks = useApp((s) => s.tasks)
  const activeTaskId = useApp((s) => s.activeTaskId)
  const addTask = useApp((s) => s.addTask)
  const setActiveTask = useApp((s) => s.setActiveTask)

  const visible = visibleTasks(tasks)
  const open = visible.filter((t) => t.status === 'active')
  const done = visible.filter((t) => t.status === 'done')

  return (
    <section aria-labelledby="tasks-heading" className="flex w-full flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="tasks-heading" className="text-sm font-medium tracking-wide uppercase">
          Tasks
        </h2>
        {open.length > 0 && (
          <span className="text-ink-600 tabular text-xs">
            {open.reduce((n, t) => n + t.completedPomodoros, 0)} /{' '}
            {open.reduce((n, t) => n + t.estimatedPomodoros, 0)} pomodoros
          </span>
        )}
      </div>

      <AddTaskForm onAdd={(input) => addTask(input, Date.now())} />

      {open.length === 0 && done.length === 0 ? (
        <EmptyTasks />
      ) : (
        <ul className="flex flex-col gap-1">
          {open.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              index={index}
              count={open.length}
              active={task.id === activeTaskId}
              onActivate={() => setActiveTask(task.id)}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="text-ink-600 text-sm">
          <summary className="hover:text-ink-300 cursor-pointer select-none">
            {done.length} done
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {done.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                count={done.length}
                active={false}
                onActivate={() => setActiveTask(task.id)}
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function EmptyTasks() {
  return (
    <div className="border-ink-800 text-ink-600 rounded-xl border border-dashed p-6 text-sm">
      <p className="text-ink-300">Nothing to work on yet.</p>
      <p className="mt-2">
        Add a task and estimate it in pomodoros. Each finished focus credits the active task —
        that’s what fills your stats and tells you how accurate your estimates really are.
      </p>
    </div>
  )
}

type RowProps = {
  task: Task
  index: number
  count: number
  active: boolean
  onActivate: () => void
}

function TaskRow({ task, index, count, active, onActivate }: RowProps) {
  const setStatus = useApp((s) => s.setStatus)
  const dropTask = useApp((s) => s.dropTask)
  const moveTask = useApp((s) => s.moveTask)
  const isDone = task.status === 'done'

  return (
    <li
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ${
        active ? 'bg-ink-900 ring-focus/40 ring-1' : 'hover:bg-ink-900'
      }`}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => setStatus(task.id, isDone ? 'active' : 'done', Date.now())}
        aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className="accent-focus size-4 shrink-0 cursor-pointer"
      />

      <button
        type="button"
        onClick={onActivate}
        className="focus-visible:outline-ink-300 min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-pressed={active}
      >
        <span className={`block truncate text-sm ${isDone ? 'text-ink-600 line-through' : ''}`}>
          {task.title}
        </span>
        {task.tag && <span className="text-ink-600 text-xs">#{task.tag}</span>}
      </button>

      <Pomodoros done={task.completedPomodoros} estimated={task.estimatedPomodoros} />

      {/*
        Actions sit on top of the row rather than beside it: in a narrow column,
        keeping them in the flow clipped task titles down to "R...". The gradient
        blends the overlay into the row background.
      */}
      <div className="from-ink-900 via-ink-900 absolute inset-y-0 right-0 hidden items-center rounded-r-lg bg-gradient-to-l to-transparent pr-1 pl-8 group-focus-within:flex group-hover:flex">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move ${task.title} up`}
          disabled={index === 0}
          onClick={() => moveTask(task.id, index - 1)}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move ${task.title} down`}
          disabled={index === count - 1}
          onClick={() => moveTask(task.id, index + 1)}
        >
          ↓
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Archive ${task.title}`}
          onClick={() => setStatus(task.id, 'archived', Date.now())}
        >
          Archive
        </Button>
        <Button
          variant="danger"
          size="sm"
          aria-label={`Delete ${task.title}`}
          onClick={() => dropTask(task.id)}
        >
          ✕
        </Button>
      </div>
    </li>
  )
}

function AddTaskForm({
  onAdd,
}: {
  onAdd: (input: { title: string; estimatedPomodoros: number }) => void
}) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState(1)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (trimmed === '') return
    onAdd({ title: trimmed, estimatedPomodoros: estimate })
    setTitle('')
    setEstimate(1)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What are you working on?"
        aria-label="Task title"
        className="border-ink-800 bg-ink-900 placeholder:text-ink-600 focus:border-ink-600 h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
      />
      <input
        type="number"
        min={1}
        max={20}
        value={estimate}
        onChange={(e) => setEstimate(Math.max(1, Number(e.target.value) || 1))}
        aria-label="Estimated pomodoros"
        title="Estimated pomodoros"
        className="border-ink-800 bg-ink-900 tabular focus:border-ink-600 h-10 w-12 shrink-0 rounded-lg border px-1 text-center text-sm outline-none"
      />
      {/* Compact button: in a 20 rem column, spelling out "Add" pushed the form
          onto a second line. */}
      <Button
        type="submit"
        variant="secondary"
        aria-label="Add"
        disabled={title.trim() === ''}
        className="shrink-0 px-3 text-lg"
      >
        +
      </Button>
    </form>
  )
}

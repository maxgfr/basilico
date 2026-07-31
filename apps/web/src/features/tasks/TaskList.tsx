import { useRef, useState, type FormEvent } from 'react'
import { knownTags, visibleTasks, type Task } from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { Pomodoros } from './Pomodoros'
import { useHoverCapable } from '../../platform/media'

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

      <AddTaskForm
        tags={knownTags(tasks)}
        onAdd={(raw, estimate) => addTask(raw, estimate, Date.now())}
      />

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

/**
 * The row's actions, rendered in two places: over the row on pointer devices,
 * and inside a disclosure on touch ones. Same buttons, so they cannot drift.
 */
function RowActions({
  task,
  index,
  count,
  onEdit,
}: {
  task: Task
  index: number
  count: number
  onEdit: () => void
}) {
  const setStatus = useApp((s) => s.setStatus)
  const dropTask = useApp((s) => s.dropTask)
  const moveTask = useApp((s) => s.moveTask)

  return (
    <>
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
      <Button variant="ghost" size="sm" aria-label={`Rename ${task.title}`} onClick={onEdit}>
        Rename
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
    </>
  )
}

function TaskRow({ task, index, count, active, onActivate }: RowProps) {
  const setStatus = useApp((s) => s.setStatus)
  const rename = useApp((s) => s.renameTask)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const hoverCapable = useHoverCapable()
  const isDone = task.status === 'done'
  const panelId = `actions-${task.id}`

  // Focus moved by hand rather than with `autoFocus`: the attribute is a usability
  // problem when a page loads with it, but here the field only appears because
  // the user asked to rename, and leaving focus behind would strand the keyboard.
  const focusInput = (node: HTMLInputElement | null) => {
    node?.focus()
    node?.select()
  }

  if (editing) {
    return (
      <li className="bg-ink-900 rounded-lg px-3 py-2">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const value = new FormData(event.currentTarget).get('title')
            if (typeof value === 'string') rename(task.id, value)
            setEditing(false)
          }}
        >
          <input
            name="title"
            defaultValue={task.tag ? `${task.title} #${task.tag}` : task.title}
            aria-label={`Rename ${task.title}`}
            // Escape must abandon the edit: committing on blur alone would make
            // a mistyped rename impossible to back out of.
            onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
            onBlur={(event) => {
              rename(task.id, event.target.value)
              setEditing(false)
            }}
            ref={focusInput}
            className="border-ink-800 bg-ink-950 focus:border-ink-600 h-8 w-full rounded border px-2 text-sm outline-none"
          />
        </form>
      </li>
    )
  }

  return (
    <li
      className={`group relative rounded-lg px-3 py-2 transition-colors duration-150 ${
        active ? 'bg-ink-900 ring-focus/40 ring-1' : 'hover:bg-ink-900'
      }`}
    >
      <div className="flex items-center gap-3">
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
          Touch devices have no hover, so the overlay would only ever appear after
          tapping the row — reachable, but nobody would ever find it. They get a
          permanent disclosure instead. Showing all five buttons inline was the
          other option, and it clipped the titles all over again.
        */}
        {!hoverCapable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`Actions for ${task.title}`}
            className="text-ink-600 hover:text-ink-100 focus-visible:outline-ink-300 inline-flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none focus-visible:outline-2"
          >
            ⋯
          </button>
        )}
      </div>

      {!hoverCapable && open && (
        <div id={panelId} className="mt-1 flex flex-wrap items-center gap-1">
          <RowActions
            task={task}
            index={index}
            count={count}
            onEdit={() => {
              setOpen(false)
              setEditing(true)
            }}
          />
        </div>
      )}

      {/*
        Actions sit on top of the row rather than beside it: in a narrow column,
        keeping them in the flow clipped task titles down to "R...". The gradient
        blends the overlay into the row background.
      */}
      {hoverCapable && (
        <div className="from-ink-900 via-ink-900 absolute inset-y-0 right-0 hidden items-center rounded-r-lg bg-gradient-to-l to-transparent pr-1 pl-8 group-focus-within:flex group-hover:flex">
          <RowActions task={task} index={index} count={count} onEdit={() => setEditing(true)} />
        </div>
      )}
    </li>
  )
}

function AddTaskForm({
  tags,
  onAdd,
}: {
  tags: string[]
  onAdd: (raw: string, estimatedPomodoros: number) => void
}) {
  const [raw, setRaw] = useState('')
  const [estimate, setEstimate] = useState(1)
  const listId = useRef(`tags-${Math.random().toString(36).slice(2)}`).current

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (raw.trim() === '') return
    onAdd(raw, estimate)
    setRaw('')
    setEstimate(1)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="What are you working on?"
          aria-label="Task title"
          aria-describedby={`${listId}-hint`}
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
          disabled={raw.trim() === ''}
          className="shrink-0 px-3 text-lg"
        >
          +
        </Button>
      </div>
      <p id={`${listId}-hint`} className="text-ink-600 text-xs">
        Add <span className="text-ink-300">#a-tag</span> to group it — tags drive the per-tag stats.
      </p>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              // Clickable chips rather than a datalist: they are visible without
              // opening anything, and a datalist option carries no label a
              // screen reader can announce.
              onClick={() =>
                setRaw((current) => `${current.replace(/\s*#\S*$/, '')} #${tag}`.trim())
              }
              className="border-ink-800 text-ink-600 hover:border-ink-600 hover:text-ink-300 rounded-full border px-2 py-0.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}

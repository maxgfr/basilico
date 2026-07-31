import { useRef, useState, type FormEvent } from 'react'
import {
  backlog,
  dayKey,
  dayLoad,
  knownTags,
  needsBreakdown,
  plannedFor,
  timeByTask,
  type Task,
} from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { Pomodoros } from './Pomodoros'
import { formatDuration } from '../../lib/format'
import { useHoverCapable } from '../../platform/media'

export function TaskList() {
  const tasks = useApp((s) => s.tasks)
  const sessions = useApp((s) => s.sessions)
  const activeTaskId = useApp((s) => s.activeTaskId)
  const goalMinutes = useApp((s) => s.settings.dailyGoalMinutes)
  const focusMinutes = useApp((s) => s.settings.durations.focus)
  const addTask = useApp((s) => s.addTask)
  const setActiveTask = useApp((s) => s.setActiveTask)

  const today = dayKey(Date.now())
  const plan = plannedFor(tasks, today)
  const open = plan.filter((t) => t.status === 'active')
  const done = plan.filter((t) => t.status === 'done')
  const waiting = backlog(tasks)
  const load = dayLoad(tasks, today)
  const spent = timeByTask(sessions)

  return (
    <div className="flex w-full flex-col gap-8">
      <section aria-labelledby="today-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="today-heading" className="text-sm font-medium tracking-wide uppercase">
            Today
          </h2>
          {load.estimated > 0 && (
            <span className="text-ink-600 tabular text-xs">
              {load.completed} / {load.estimated} pomodoros
            </span>
          )}
        </div>

        <AddTaskForm
          tags={knownTags(tasks)}
          onAdd={(raw, estimate) => addTask(raw, estimate, Date.now())}
        />

        {open.length === 0 && done.length === 0 ? (
          <EmptyTasks hasBacklog={waiting.length > 0} />
        ) : (
          <ul className="flex flex-col gap-1">
            {open.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                count={open.length}
                spentMs={spent.get(task.id) ?? 0}
                active={task.id === activeTaskId}
                onActivate={() => setActiveTask(task.id)}
              />
            ))}
          </ul>
        )}

        {load.remaining > 0 && (
          <DayLoadNote remaining={load.remaining} focusMinutes={focusMinutes} goal={goalMinutes} />
        )}

        {done.length > 0 && (
          <details className="text-ink-600 text-sm">
            <summary className="hover:text-ink-300 cursor-pointer select-none">
              {done.length} done today
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {done.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={index}
                  count={done.length}
                  spentMs={spent.get(task.id) ?? 0}
                  active={false}
                  onActivate={() => setActiveTask(task.id)}
                />
              ))}
            </ul>
          </details>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="backlog-heading" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="backlog-heading" className="text-sm font-medium tracking-wide uppercase">
              Backlog
            </h2>
            <span className="text-ink-600 text-xs">{waiting.length} waiting</span>
          </div>
          <ul className="flex flex-col gap-1">
            {waiting.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                count={waiting.length}
                spentMs={spent.get(task.id) ?? 0}
                active={task.id === activeTaskId}
                onActivate={() => setActiveTask(task.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * What the plan actually asks of you, in time rather than in counters.
 *
 * A row of estimates says nothing until you convert it: five pomodoros left is
 * a little over two hours, and that is the number that tells you whether the
 * day is plausible.
 */
function DayLoadNote({
  remaining,
  focusMinutes,
  goal,
}: {
  remaining: number
  focusMinutes: number
  goal: number
}) {
  const remainingMs = remaining * focusMinutes * 60_000
  const overGoal = goal > 0 && remaining * focusMinutes > goal

  return (
    <p className="text-ink-600 text-xs">
      {remaining} pomodoro{remaining > 1 ? 's' : ''} left to plan —{' '}
      <span className="text-ink-300">about {formatDuration(remainingMs)}</span> of focus.
      {overGoal && ' That is past your daily goal; consider moving something to the backlog.'}
    </p>
  )
}

function EmptyTasks({ hasBacklog }: { hasBacklog: boolean }) {
  return (
    <div className="border-ink-800 text-ink-600 rounded-xl border border-dashed p-6 text-sm">
      <p className="text-ink-300">Nothing planned for today.</p>
      <p className="mt-2">
        {hasBacklog
          ? 'Pull something up from the backlog below, or add a task and estimate it in pomodoros.'
          : 'Add a task and estimate it in pomodoros. Each finished focus credits the active task — that’s what fills your stats and tells you how accurate your estimates really are.'}
      </p>
    </div>
  )
}

type RowProps = {
  task: Task
  index: number
  count: number
  spentMs: number
  active: boolean
  onActivate: () => void
}

/**
 * The row's actions, rendered in two places: over the row on pointer devices,
 * and inside a disclosure on touch ones. One list, so they cannot drift.
 *
 * The overlay is `icons`, because six text buttons measured ~385 px inside a
 * 320 px column: the bar shrank to its min-content, spilled out of the aside and
 * over the timer, and "To backlog" broke onto a second line inside a 32 px
 * button. Glyphs bring the same six actions down to ~216 px, which fits. The
 * disclosure keeps the words: it has a whole row's width and no hover to explain
 * a symbol.
 */
type RowAction = {
  key: string
  label: string
  icon: string
  hint: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

function useRowActions(task: Task, index: number, count: number, onEdit: () => void): RowAction[] {
  const setStatus = useApp((s) => s.setStatus)
  const dropTask = useApp((s) => s.dropTask)
  const moveTask = useApp((s) => s.moveTask)
  const plan = useApp((s) => s.planTask)
  const planned = task.plannedFor !== null

  return [
    {
      key: 'plan',
      label: planned ? 'To backlog' : 'Today',
      icon: planned ? '↩' : '↪',
      hint: planned ? `Move ${task.title} to the backlog` : `Plan ${task.title} for today`,
      onClick: () => plan(task.id, planned ? null : dayKey(Date.now())),
    },
    {
      key: 'up',
      label: 'Move up',
      icon: '↑',
      hint: `Move ${task.title} up`,
      disabled: index === 0,
      onClick: () => moveTask(task.id, index - 1),
    },
    {
      key: 'down',
      label: 'Move down',
      icon: '↓',
      hint: `Move ${task.title} down`,
      disabled: index === count - 1,
      onClick: () => moveTask(task.id, index + 1),
    },
    {
      key: 'rename',
      label: 'Rename',
      icon: '✎',
      hint: `Rename ${task.title}`,
      onClick: onEdit,
    },
    {
      key: 'archive',
      label: 'Archive',
      icon: '⧉',
      hint: `Archive ${task.title}`,
      onClick: () => setStatus(task.id, 'archived', Date.now()),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: '✕',
      hint: `Delete ${task.title}`,
      danger: true,
      onClick: () => dropTask(task.id),
    },
  ]
}

function RowActions({ actions, as }: { actions: RowAction[]; as: 'icons' | 'labels' }) {
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.key}
          variant={action.danger ? 'danger' : 'ghost'}
          size={as === 'icons' ? 'icon' : 'sm'}
          aria-label={action.hint}
          title={as === 'icons' ? action.hint : undefined}
          // `aria-disabled`, not `disabled`: moving a task to the top disables
          // the very button holding focus, the browser drops focus to <body>,
          // and the bar this button lives in vanishes mid-click.
          aria-disabled={action.disabled || undefined}
          className={action.disabled ? 'cursor-not-allowed opacity-40' : ''}
          onClick={() => {
            if (action.disabled) return
            action.onClick()
          }}
        >
          {as === 'icons' ? <span aria-hidden="true">{action.icon}</span> : action.label}
        </Button>
      ))}
    </>
  )
}

function TaskRow({ task, index, count, spentMs, active, onActivate }: RowProps) {
  const setStatus = useApp((s) => s.setStatus)
  const rename = useApp((s) => s.renameTask)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const hoverCapable = useHoverCapable()
  const isDone = task.status === 'done'
  const panelId = `actions-${task.id}`

  // Two lists rather than one: the disclosure has to close itself on rename,
  // the overlay has nothing to close.
  const hoverActions = useRowActions(task, index, count, () => setEditing(true))
  const touchActions = useRowActions(task, index, count, () => {
    setOpen(false)
    setEditing(true)
  })

  // Focus moved by hand rather than with `autoFocus`: the attribute is a usability
  // problem when a page loads with it, but here the field only appears because
  // the user asked to rename, and leaving focus behind would strand the keyboard.
  const focusInput = (node: HTMLInputElement | null) => {
    node?.focus()
    node?.select()
  }

  if (editing) {
    return (
      <li className="bg-ink-900 flex min-h-13 items-center rounded-lg px-3 py-2">
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
    // `min-h`: the meta line only exists on some rows, and "12m spent" appears
    // mid-session — without a floor the row grew 16 px under the cursor and the
    // whole list jumped. It also matches the rename row, so editing sits still.
    <li
      className={`group relative flex min-h-13 flex-col justify-center rounded-lg px-3 py-2 transition-colors duration-150 motion-reduce:transition-none ${
        active
          ? 'bg-ink-900 ring-focus/40 ring-1'
          : 'hover:bg-ink-900 has-[:focus-visible]:bg-ink-900'
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
          {/* Rendered only when it has something to say: an empty flex box still
              costs its own line box, and the row would size differently for no
              visible reason. */}
          {(task.tag || spentMs > 0 || needsBreakdown(task)) && (
            <span className="text-ink-600 flex flex-wrap items-center gap-x-2 text-xs">
              {task.tag && <span>#{task.tag}</span>}
              {spentMs > 0 && <span className="tabular">{formatDuration(spentMs)} spent</span>}
              {needsBreakdown(task) && (
                <span
                  className="text-long"
                  title="Cirillo: more than 5-7 pomodoros means it is really several tasks"
                >
                  too big — break it down
                </span>
              )}
            </span>
          )}
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
          <RowActions actions={touchActions} as="labels" />
        </div>
      )}

      {/*
        Actions sit on top of the row rather than beside it: in a narrow column,
        keeping them in the flow clipped task titles down to "R...". The gradient
        blends the overlay into the row background.

        Mounted always and faded with opacity rather than flipped from `hidden`:
        `display` cannot transition, so the opaque panel used to land instantly
        on a row background still 150 ms into its own fade — a seam that read as
        a glitch. `pointer-events-none` while hidden keeps the title clickable.

        `has-[:focus-visible]` rather than `focus-within`: the latter fires on
        click focus too, so selecting a task left the bar pinned over the title
        it had just covered. Keyboard focus still opens it.
      */}
      {hoverCapable && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-stretch opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none">
          {/* The fade is its own fixed-width strip rather than a gradient across
              the whole bar: spread over the buttons, its midpoint fell under the
              first two icons and the task title read straight through them. */}
          <span aria-hidden="true" className="from-ink-900/0 to-ink-900 w-8 bg-gradient-to-r" />
          <span className="bg-ink-900 flex items-center gap-1 rounded-r-lg pr-1">
            <RowActions actions={hoverActions} as="icons" />
          </span>
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

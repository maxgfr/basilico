import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
import { MenuItem, MenuSeparator, useMenu } from '../../ui/Menu'
import { Pomodoros } from './Pomodoros'
import { formatDuration } from '../../lib/format'

/**
 * The shared field shape — colours, border and type, never a size.
 *
 * Sizing stays at the call site on purpose: two Tailwind utilities for the same
 * property are resolved by their order in the generated stylesheet, not by the
 * order they are written in, so a `w-full` baked in here silently beat the
 * `w-14` meant to override it and the field covered the button beside it.
 *
 * `text-base` is not a style choice: iOS zooms the whole page in when a focused
 * input's text is under 16px, and every field here used to be 14.
 */
const FIELD =
  'border-ink-800 bg-ink-950 placeholder:text-ink-600 focus:border-ink-600 min-w-0 rounded-lg border px-3 text-base outline-none'

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
 * Every row action, behind one menu, on every device.
 *
 * There used to be two: a bar of icons that appeared on hover, and a disclosure
 * for touch. The icons were the problem — six of them in a 20 rem column with no
 * room for labels, and a glyph nobody reads the same way twice. A menu costs one
 * tap more and says what each action does, which is what the icons never could.
 * One branch also means one set of actions in the DOM, so nothing is announced
 * twice and no overlay can sit on top of the control meant to open it.
 */
function RowMenu({
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
  const plan = useApp((s) => s.planTask)
  const menu = useMenu('end')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const planned = task.plannedFor !== null
  const label = `Actions for ${task.title}`

  /** Closes first, then acts: the row may not survive the action. */
  const run = (fn: () => void, refocus = true) => {
    menu.close(refocus)
    setConfirmingDelete(false)
    fn()
  }

  return (
    <div ref={menu.container} className="shrink-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        {...menu.triggerProps}
        onClick={() => {
          // Reopening must never land on a half-confirmed delete.
          setConfirmingDelete(false)
          menu.triggerProps.onClick()
        }}
      >
        <span aria-hidden="true">⋯</span>
      </Button>

      {menu.open && (
        <div {...menu.panelProps} aria-label={label}>
          <MenuItem
            label="Edit"
            meaning="Title, description and estimate."
            onClick={() => run(onEdit, false)}
          />
          <MenuItem
            label={planned ? 'Move to the backlog' : 'Plan for today'}
            meaning={
              planned
                ? 'Off today’s plan, still on the inventory.'
                : 'Onto today’s plan, where it counts towards the day.'
            }
            onClick={() => run(() => plan(task.id, planned ? null : dayKey(Date.now())))}
          />

          <MenuSeparator>Order</MenuSeparator>
          <MenuItem
            label="Move up"
            disabled={index === 0}
            onClick={() => index > 0 && run(() => moveTask(task.id, index - 1))}
          />
          <MenuItem
            label="Move down"
            disabled={index === count - 1}
            onClick={() => index < count - 1 && run(() => moveTask(task.id, index + 1))}
          />

          <MenuSeparator>Remove</MenuSeparator>
          <MenuItem
            label="Archive"
            meaning="Out of the lists, kept in your history."
            onClick={() => run(() => setStatus(task.id, 'archived', Date.now()), false)}
          />
          {/* Two steps, like erasing the data: a menu is one tap away from a
              thumb, and this is the only row action nothing can undo. */}
          {confirmingDelete ? (
            <>
              <MenuItem
                label="Yes, delete it"
                meaning="Gone for good. Sessions already recorded stay in the stats."
                danger
                onClick={() => run(() => dropTask(task.id), false)}
              />
              <MenuItem label="Cancel" onClick={() => setConfirmingDelete(false)} />
            </>
          ) : (
            <MenuItem
              label="Delete"
              meaning="Cannot be undone."
              danger
              onClick={() => setConfirmingDelete(true)}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Title, description and estimate in one form.
 *
 * It replaces a single rename field that committed on blur. Blur cannot commit a
 * form with three controls — moving between them would save twice and leave no
 * way back out — so this one says Save and Cancel, which is also the only thing
 * that reads as safe under a thumb.
 */
function TaskEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const rename = useApp((s) => s.renameTask)
  const editTask = useApp((s) => s.editTask)

  const [title, setTitle] = useState(task.tag ? `${task.title} #${task.tag}` : task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [estimate, setEstimate] = useState(task.estimatedPomodoros)

  // Focus moved by hand rather than with `autoFocus`: the attribute is a
  // usability problem when a page loads with it, but here the field only appears
  // because the user asked to edit, and leaving focus behind strands the
  // keyboard.
  //
  // The callback must be stable. An inline one is a new function every render,
  // so React re-runs it on every keystroke — which re-selected the title under
  // the cursor, and pulled focus out of the description after one character.
  const focusInput = useCallback((node: HTMLInputElement | null) => {
    node?.focus()
    node?.select()
  }, [])

  // Escape abandons the edit from anywhere in the form, including the buttons —
  // a mistyped rename has to be backed out of without hunting for Cancel. On the
  // document rather than the form: a form is not an interactive element, and
  // handlers hung on one only fire while focus is inside it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDone])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (title.trim() === '') return
    rename(task.id, title)
    editTask(task.id, {
      notes: notes.trim() === '' ? null : notes.trim(),
      estimatedPomodoros: Math.max(1, Math.round(estimate) || 1),
    })
    onDone()
  }

  return (
    <li className="bg-ink-900 ring-ink-800 rounded-xl p-3 ring-1">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={`Title of ${task.title}`}
          ref={focusInput}
          className={`${FIELD} h-11 w-full`}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Description — anything you need at hand when you start (optional)"
          aria-label={`Description of ${task.title}`}
          className={`${FIELD} w-full resize-y py-2 leading-relaxed`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-ink-600 flex items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              max={20}
              value={estimate}
              onChange={(e) => setEstimate(Math.max(1, Number(e.target.value) || 1))}
              aria-label={`Estimated pomodoros for ${task.title}`}
              className={`${FIELD} tabular h-11 w-16 px-2 text-center`}
            />
            pomodoros
          </label>
          <span className="flex-1" />
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={title.trim() === ''}>
            Save
          </Button>
        </div>
      </form>
    </li>
  )
}

function TaskRow({ task, index, count, spentMs, active, onActivate }: RowProps) {
  const setStatus = useApp((s) => s.setStatus)
  const [editing, setEditing] = useState(false)
  const isDone = task.status === 'done'
  // Stable: the editor hangs a document listener on it.
  const stopEditing = useCallback(() => setEditing(false), [])

  if (editing) return <TaskEditor task={task} onDone={stopEditing} />

  const hasMeta = Boolean(task.tag) || spentMs > 0 || needsBreakdown(task)

  return (
    <li
      className={`rounded-xl px-1 py-1 transition-colors duration-150 motion-reduce:transition-none ${
        active
          ? 'bg-ink-900 ring-focus/40 ring-1'
          : 'hover:bg-ink-900 has-[:focus-visible]:bg-ink-900'
      }`}
    >
      <div className="flex items-center gap-1">
        {/* The box is 20px but its target is 44: a checkbox is the control most
            often missed by a thumb, and the padding costs nothing visually. */}
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={isDone}
            onChange={() => setStatus(task.id, isDone ? 'active' : 'done', Date.now())}
            aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className="accent-focus size-5 cursor-pointer"
          />
        </label>

        <button
          type="button"
          onClick={onActivate}
          className="focus-visible:outline-ink-300 min-w-0 flex-1 rounded-lg py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-pressed={active}
        >
          <span className={`block truncate ${isDone ? 'text-ink-600 line-through' : ''}`}>
            {task.title}
          </span>
        </button>

        <RowMenu task={task} index={index} count={count} onEdit={() => setEditing(true)} />
      </div>

      {/* Everything secondary on one line under the title, aligned to it. The
          title used to share its row with the dots and the counter, which is
          what left it three words wide on a phone. */}
      <div className="text-ink-600 flex flex-wrap items-center gap-x-2 gap-y-1 pr-2 pl-12 text-xs">
        <Pomodoros done={task.completedPomodoros} estimated={task.estimatedPomodoros} />
        {hasMeta && <span aria-hidden="true">·</span>}
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
      </div>

      {task.notes && (
        <p className="text-ink-600 line-clamp-2 pr-2 pl-12 text-xs leading-relaxed">{task.notes}</p>
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
          className={`${FIELD} bg-ink-900 h-11 flex-1`}
        />
        <input
          type="number"
          min={1}
          max={20}
          value={estimate}
          onChange={(e) => setEstimate(Math.max(1, Number(e.target.value) || 1))}
          aria-label="Estimated pomodoros"
          title="Estimated pomodoros"
          className={`${FIELD} bg-ink-900 tabular h-11 w-12 shrink-0 px-1 text-center`}
        />
        {/* Compact button: in a 20 rem column, spelling out "Add" pushed the form
            onto a second line. */}
        <Button
          type="submit"
          variant="secondary"
          size="icon"
          aria-label="Add"
          disabled={raw.trim() === ''}
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

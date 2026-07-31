import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { STORAGE_KEY, useApp } from './store/app'
import { createTimerState, defaultSettings } from '@basilico/core'

/** Resets the store and storage: tests must not contaminate each other. */
function resetApp() {
  localStorage.clear()
  useApp.setState({
    settings: defaultSettings,
    timer: createTimerState(defaultSettings),
    sessions: [],
    tasks: [],
    activeTaskId: null,
    lastEnded: null,
    pending: [],
  })
}

beforeEach(resetApp)
afterEach(() => {
  window.location.hash = ''
})

describe('main screen', () => {
  it('shows the timer ready to start', () => {
    render(<App />)
    expect(screen.getByRole('timer')).toHaveTextContent('25:00')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('starts then pauses', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(useApp.getState().timer.status).toBe('running')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(useApp.getState().timer.status).toBe('paused')
  })

  it('adds a task, makes it active and attributes the session to it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Task title'), 'Write the core')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const tasks = useApp.getState().tasks
    expect(tasks).toHaveLength(1)
    expect(useApp.getState().activeTaskId).toBe(tasks[0]?.id)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(useApp.getState().timer.taskId).toBe(tasks[0]?.id)
  })

  it('persists state under a project-prefixed key', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start' }))

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const saved = JSON.parse(raw ?? '{}') as { state: { timer: { endsAt: number | null } } }
    // The absolute deadline is what gets persisted, never a "remaining time"
    // that would resurrect a stale timer on reload.
    expect(saved.state.timer.endsAt).toBeTypeOf('number')
    expect(JSON.stringify(saved)).not.toContain('remainingMs')
  })
})

describe('tasks', () => {
  it('pulls a #tag out of what you type and offers it back as a chip', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Task title'), 'Write the core #basilico')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const task = useApp.getState().tasks[0]
    expect(task?.title).toBe('Write the core')
    expect(task?.tag).toBe('basilico')
    expect(screen.getByRole('button', { name: '#basilico' })).toBeInTheDocument()
  })

  it('edits title, tag and description in one form', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Task title'), 'Old name')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Actions for Old name' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const title = screen.getByLabelText('Title of Old name')
    await user.clear(title)
    await user.type(title, 'New name #work')
    await user.type(screen.getByLabelText('Description of Old name'), 'The parser, not the printer')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const task = useApp.getState().tasks[0]
    expect(task?.title).toBe('New name')
    expect(task?.tag).toBe('work')
    expect(task?.notes).toBe('The parser, not the printer')
  })

  it('shows the description on the row once it has one', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Task title'), 'Ship it')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Actions for Ship it' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Description of Ship it'), 'Behind the flag first')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Behind the flag first')).toBeInTheDocument()
  })

  it('keeps an archived task reachable, and restores it to the backlog', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Task title'), 'Someday')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Actions for Someday' }))
    await user.click(screen.getByRole('button', { name: 'Archive' }))

    // Archiving used to be a one-way trip out of the interface.
    expect(screen.getByText('1 archived')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    const task = useApp.getState().tasks[0]
    expect(task?.status).toBe('active')
    // Back to the inventory, not to a day that has already gone by.
    expect(task?.plannedFor).toBeNull()
    expect(screen.getByRole('region', { name: 'Backlog' })).toBeInTheDocument()
  })

  it('asks twice before deleting a task', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Task title'), 'Fragile')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Actions for Fragile' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    // One tap is not enough: this is the only row action nothing can undo.
    expect(useApp.getState().tasks).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    expect(useApp.getState().tasks).toHaveLength(0)
  })

  it('carries the active task tag onto the session', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Task title'), 'Tagged #work')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    // Without this the per-tag stats could never fill up from real usage.
    expect(useApp.getState().timer.tag).toBe('work')
  })
})

describe('session notes', () => {
  it('records an intention before starting', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session intention'), 'Ship the parser')
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(useApp.getState().timer.intention).toBe('Ship the parser')
  })

  it('annotates the session that just ended, without touching its durations', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Abandon this one' }))

    await user.click(screen.getByRole('radio', { name: '4 out of 5' }))
    await user.type(screen.getByLabelText('Session note'), 'Kept getting pinged')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const logged = useApp.getState().sessions.at(-1)
    expect(logged?.rating).toBe(4)
    expect(logged?.note).toBe('Kept getting pinged')
    expect(logged?.outcome).toBe('voided')
  })

  it('offers the same note panel after a session ended with Done', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Done — count it' }))

    await user.click(screen.getByRole('radio', { name: '5 out of 5' }))

    const logged = useApp.getState().sessions.at(-1)
    expect(logged?.outcome).toBe('completed')
    expect(logged?.rating).toBe(5)
  })
})

describe('ending a session by hand', () => {
  it('counts the pomodoro and credits the active task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Task title'), 'Write the core')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Write the core' }))

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Done — count it' }))

    const state = useApp.getState()
    expect(state.sessions.at(-1)?.outcome).toBe('completed')
    expect(state.timer.focusSinceLongBreak).toBe(1)
    expect(state.tasks.at(0)?.completedPomodoros).toBe(1)
  })

  it('abandoning records the time without counting a pomodoro', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Abandon this one' }))

    const state = useApp.getState()
    expect(state.sessions.at(-1)?.outcome).toBe('voided')
    expect(state.timer.focusSinceLongBreak).toBe(0)
  })

  // The reported bug: the cycle stopped dead on the second skip.
  it('keeps chaining phases however many times you skip', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      expect(useApp.getState().timer.status).toBe('running')
    }
  })
})

describe('stats', () => {
  it('explains what to do while there is no session yet', () => {
    window.location.hash = '#/stats'
    render(<App />)
    expect(screen.getByRole('heading', { name: /Nothing to show/ })).toBeInTheDocument()
  })
})

describe('number fields', () => {
  it('lets you clear the field and type a fresh value', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/settings'
    render(<App />)

    const focus = screen.getByLabelText('Focus')
    await user.clear(focus)
    // Clamping on every keystroke used to snap this back to the minimum, which
    // made the next digits append to the old value and hit the maximum: typing
    // "50" landed on 240.
    expect(focus).toHaveValue(null)

    await user.type(focus, '50')
    expect(useApp.getState().settings.durations.focus).toBe(50)
  })

  it('clamps out-of-range input on blur rather than mid-typing', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/settings'
    render(<App />)

    const focus = screen.getByLabelText('Focus')
    await user.clear(focus)
    await user.type(focus, '999')
    await user.tab()
    expect(useApp.getState().settings.durations.focus).toBe(240)
  })

  it('reverts an unparseable draft instead of guessing', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/settings'
    render(<App />)

    const focus = screen.getByLabelText('Focus')
    await user.clear(focus)
    await user.tab()
    expect(useApp.getState().settings.durations.focus).toBe(25)
  })
})

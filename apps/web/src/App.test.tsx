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

  it('renames in place and re-reads the tag', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Task title'), 'Old name')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Rename Old name' }))
    const field = screen.getByLabelText('Rename Old name')
    await user.clear(field)
    await user.type(field, 'New name #work{Enter}')

    const task = useApp.getState().tasks[0]
    expect(task?.title).toBe('New name')
    expect(task?.tag).toBe('work')
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
    await user.click(screen.getByRole('button', { name: 'Void this focus' }))

    await user.click(screen.getByRole('radio', { name: '4 out of 5' }))
    await user.type(screen.getByLabelText('Session note'), 'Kept getting pinged')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const logged = useApp.getState().sessions.at(-1)
    expect(logged?.rating).toBe(4)
    expect(logged?.note).toBe('Kept getting pinged')
    expect(logged?.outcome).toBe('voided')
  })
})

describe('stats', () => {
  it('explains what to do while there is no session yet', () => {
    window.location.hash = '#/stats'
    render(<App />)
    expect(screen.getByRole('heading', { name: /Nothing to show/ })).toBeInTheDocument()
  })
})

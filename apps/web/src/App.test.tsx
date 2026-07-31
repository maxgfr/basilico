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

describe('stats', () => {
  it('explains what to do while there is no session yet', () => {
    window.location.hash = '#/stats'
    render(<App />)
    expect(screen.getByRole('heading', { name: /Nothing to show/ })).toBeInTheDocument()
  })
})

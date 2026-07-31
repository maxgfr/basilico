import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { STORAGE_KEY, useApp } from './store/app'
import { createTimerState, defaultSettings } from '@basilico/core'

/** Remet le store et le stockage à zéro : les tests ne doivent pas se contaminer. */
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

describe('écran principal', () => {
  it('affiche le minuteur prêt à démarrer', () => {
    render(<App />)
    expect(screen.getByRole('timer')).toHaveTextContent('25:00')
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
  })

  it('démarre puis met en pause', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Démarrer' }))
    expect(useApp.getState().timer.status).toBe('running')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(useApp.getState().timer.status).toBe('paused')
  })

  it('ajoute une tâche, la rend active et la rattache à la session', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Titre de la tâche'), 'Écrire le noyau')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    const tasks = useApp.getState().tasks
    expect(tasks).toHaveLength(1)
    expect(useApp.getState().activeTaskId).toBe(tasks[0]?.id)

    await user.click(screen.getByRole('button', { name: 'Démarrer' }))
    expect(useApp.getState().timer.taskId).toBe(tasks[0]?.id)
  })

  it('persiste l’état dans une clé préfixée par le projet', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Démarrer' }))

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const saved = JSON.parse(raw ?? '{}') as { state: { timer: { endsAt: number | null } } }
    // C'est l'échéance absolue qui est persistée, jamais un « temps restant »
    // qui ressusciterait un minuteur périmé au rechargement.
    expect(saved.state.timer.endsAt).toBeTypeOf('number')
    expect(JSON.stringify(saved)).not.toContain('remainingMs')
  })
})

describe('statistiques', () => {
  it('explique quoi faire tant qu’aucune session n’existe', () => {
    window.location.hash = '#/stats'
    render(<App />)
    expect(screen.getByRole('heading', { name: /Rien à montrer/ })).toBeInTheDocument()
  })
})

import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup, toCsv, toOpenPomodoro } from './backup'
import { defaultSettings, mergeSettings, parseSettings } from './settings'
import type { SessionRecord, Task } from './types'

const session: SessionRecord = {
  id: 's1',
  mode: 'focus',
  startedAt: Date.UTC(2026, 6, 31, 8, 0, 0),
  endedAt: Date.UTC(2026, 6, 31, 8, 25, 0),
  plannedMs: 1_500_000,
  actualMs: 1_500_000,
  overtimeMs: 0,
  outcome: 'completed',
  taskId: 't1',
  tag: 'boulot',
  interruptions: { internal: 1, external: 0 },
  intention: 'Écrire le noyau',
  note: null,
  rating: null,
}

const task: Task = {
  id: 't1',
  title: 'Noyau de domaine',
  notes: null,
  tag: 'boulot',
  estimatedPomodoros: 3,
  completedPomodoros: 1,
  status: 'active',
  order: 0,
  createdAt: 0,
  completedAt: null,
}

describe('réglages', () => {
  it('fait apparaître les nouveaux champs imbriqués chez les anciens utilisateurs', () => {
    // Une sauvegarde d'une version où `sound.ticking` n'existait pas encore.
    const old = { schemaVersion: 1, sound: { enabled: false, alarm: 'bell', volume: 0.2 } }
    const settings = parseSettings(old)
    expect(settings.sound.enabled).toBe(false)
    expect(settings.sound.alarm).toBe('bell')
    // Une fusion superficielle aurait laissé ce champ indéfini à vie.
    expect(settings.sound.ticking).toBe(false)
    expect(settings.durations.focus).toBe(25)
  })

  it('ne laisse pas des réglages corrompus empêcher le démarrage', () => {
    expect(parseSettings({ durations: { focus: -5 } })).toEqual(defaultSettings)
    expect(parseSettings('nope')).toEqual(defaultSettings)
    expect(parseSettings(null)).toEqual(defaultSettings)
  })

  it('ignore les clés inconnues au lieu de les recopier', () => {
    const merged = mergeSettings(defaultSettings, { inconnu: 42, longBreakEvery: 3 })
    expect(merged).not.toHaveProperty('inconnu')
    expect(merged.longBreakEvery).toBe(3)
  })
})

describe('sauvegarde', () => {
  it('fait un aller-retour sans perte', () => {
    const backup = createBackup(defaultSettings, [session], [task], 1_000)
    const result = parseBackup(JSON.stringify(backup))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.sessions).toEqual([session])
    expect(result.backup.tasks).toEqual([task])
    expect(result.backup.settings).toEqual(defaultSettings)
  })

  it('complète les champs absents d’une sauvegarde plus ancienne', () => {
    const legacy = {
      app: 'basilico',
      version: 1,
      exportedAt: 0,
      settings: {},
      tasks: [],
      sessions: [
        {
          id: 's1',
          mode: 'focus',
          startedAt: 0,
          endedAt: 1,
          plannedMs: 1,
          actualMs: 1,
          outcome: 'completed',
        },
      ],
    }
    const result = parseBackup(legacy)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.sessions[0]?.overtimeMs).toBe(0)
    expect(result.backup.sessions[0]?.interruptions).toEqual({ internal: 0, external: 0 })
  })

  it('explique pourquoi un fichier est refusé plutôt que de l’avaler', () => {
    expect(parseBackup('{pas du json')).toEqual({
      ok: false,
      error: "Ce fichier n'est pas du JSON valide.",
    })

    const wrongApp = parseBackup({
      app: 'autre',
      version: 1,
      exportedAt: 0,
      sessions: [],
      tasks: [],
    })
    expect(wrongApp.ok).toBe(false)

    const future = parseBackup({
      app: 'basilico',
      version: 99,
      exportedAt: 0,
      settings: {},
      sessions: [],
      tasks: [],
    })
    expect(future.ok).toBe(false)
    if (future.ok) return
    expect(future.error).toContain('v99')
  })
})

describe('exports', () => {
  it('échappe les virgules et guillemets en CSV', () => {
    const csv = toCsv([{ ...session, intention: 'Écrire "le", noyau' }])
    const [header, row] = csv.split('\n')
    expect(header).toContain('interruptions_internal')
    expect(row).toContain('"Écrire ""le"", noyau"')
    expect(row).toContain('25')
  })

  it('n’exporte que des pomodoros réellement faits au format Open Pomodoro', () => {
    const output = JSON.parse(
      toOpenPomodoro([session, { ...session, id: 's2', outcome: 'voided' }]),
    ) as { pomodoros: { start_time: string; duration: number; tags: string[] }[] }

    expect(output.pomodoros).toHaveLength(1)
    expect(output.pomodoros[0]).toEqual({
      start_time: '2026-07-31T08:00:00.000Z',
      description: 'Écrire le noyau',
      duration: 25,
      tags: ['boulot'],
    })
  })
})

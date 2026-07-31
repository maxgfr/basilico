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
  intention: 'Write the core',
  note: null,
  rating: null,
}

const task: Task = {
  id: 't1',
  title: 'Domain core',
  notes: null,
  tag: 'boulot',
  estimatedPomodoros: 3,
  completedPomodoros: 1,
  status: 'active',
  order: 0,
  createdAt: 0,
  completedAt: null,
}

describe('settings', () => {
  it('surfaces newly nested fields for existing users', () => {
    // A backup from a version where `sound.ticking` did not exist yet.
    const old = { schemaVersion: 1, sound: { enabled: false, alarm: 'bell', volume: 0.2 } }
    const settings = parseSettings(old)
    expect(settings.sound.enabled).toBe(false)
    expect(settings.sound.alarm).toBe('bell')
    // A shallow merge would have left this field undefined forever.
    expect(settings.sound.ticking).toBe(false)
    expect(settings.durations.focus).toBe(25)
  })

  it('does not let corrupted settings block startup', () => {
    expect(parseSettings({ durations: { focus: -5 } })).toEqual(defaultSettings)
    expect(parseSettings('nope')).toEqual(defaultSettings)
    expect(parseSettings(null)).toEqual(defaultSettings)
  })

  it('ignores unknown keys instead of copying them through', () => {
    const merged = mergeSettings(defaultSettings, { inconnu: 42, longBreakEvery: 3 })
    expect(merged).not.toHaveProperty('inconnu')
    expect(merged.longBreakEvery).toBe(3)
  })
})

describe('backup', () => {
  it('round-trips without loss', () => {
    const backup = createBackup(defaultSettings, [session], [task], 1_000)
    const result = parseBackup(JSON.stringify(backup))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.sessions).toEqual([session])
    expect(result.backup.tasks).toEqual([task])
    expect(result.backup.settings).toEqual(defaultSettings)
  })

  it('fills in fields missing from an older backup', () => {
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

  it('explains why a file is rejected instead of swallowing it', () => {
    expect(parseBackup('{not json')).toEqual({
      ok: false,
      error: 'This file is not valid JSON.',
    })

    const wrongApp = parseBackup({
      app: 'other',
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
  it('escapes commas and quotes in CSV', () => {
    const csv = toCsv([{ ...session, intention: 'Write "the", core' }])
    const [header, row] = csv.split('\n')
    expect(header).toContain('interruptions_internal')
    expect(row).toContain('"Write ""the"", core"')
    expect(row).toContain('25')
  })

  it('only exports pomodoros that really happened in Open Pomodoro format', () => {
    const output = JSON.parse(
      toOpenPomodoro([session, { ...session, id: 's2', outcome: 'voided' }]),
    ) as { pomodoros: { start_time: string; duration: number; tags: string[] }[] }

    expect(output.pomodoros).toHaveLength(1)
    expect(output.pomodoros[0]).toEqual({
      start_time: '2026-07-31T08:00:00.000Z',
      description: 'Write the core',
      duration: 25,
      tags: ['boulot'],
    })
  })
})

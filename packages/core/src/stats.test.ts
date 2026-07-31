import { describe, expect, it } from 'vitest'
import {
  addDays,
  byHour,
  byTag,
  currentStreak,
  dailySeries,
  dayKey,
  estimationAccuracy,
  startOfDay,
  summarize,
} from './stats'
import type { SessionRecord, Task } from './types'

const MIN = 60_000

let seq = 0
function focus(
  startedAt: number,
  minutes: number,
  over: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id: `s${++seq}`,
    mode: 'focus',
    startedAt,
    endedAt: startedAt + minutes * MIN,
    plannedMs: 25 * MIN,
    actualMs: minutes * MIN,
    overtimeMs: 0,
    outcome: 'completed',
    taskId: null,
    tag: null,
    interruptions: { internal: 0, external: 0 },
    intention: null,
    note: null,
    rating: null,
    ...over,
  }
}

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h, 0, 0).getTime()

describe('jours locaux', () => {
  it('découpe les jours sur l’heure locale, pas sur UTC', () => {
    // 23 h 30 locales le 31 : encore le 31, même si c'est déjà le 1er en UTC ailleurs.
    expect(dayKey(at(2026, 7, 31, 23))).toBe('2026-07-31')
    expect(dayKey(at(2026, 8, 1, 0))).toBe('2026-08-01')
  })

  it('traverse le changement d’heure sans décaler les jours', () => {
    // Nuit du 25 octobre 2026 en Europe/Paris : cette journée-là fait 25 heures.
    const before = startOfDay(at(2026, 10, 24, 12))
    expect(dayKey(addDays(before, 1))).toBe('2026-10-25')
    expect(dayKey(addDays(before, 2))).toBe('2026-10-26')
    // Une addition naïve de 24 h retomberait sur le 25 une seconde fois.
    expect(dayKey(startOfDay(at(2026, 10, 25, 12)) + 24 * 3_600_000)).not.toBe('2026-10-27')
  })
})

describe('résumé', () => {
  it('compte le temps d’un focus annulé mais pas le pomodoro', () => {
    const s = summarize([
      focus(at(2026, 7, 31), 25),
      focus(at(2026, 7, 31, 12), 8, { outcome: 'voided' }),
    ])
    expect(s.completedFocus).toBe(1)
    expect(s.voidedFocus).toBe(1)
    expect(s.focusMs).toBe(33 * MIN)
    expect(s.completionRate).toBe(0.5)
  })

  it('sépare le temps de pause du temps de focus', () => {
    const s = summarize([
      focus(at(2026, 7, 31), 25),
      focus(at(2026, 7, 31, 11), 5, { mode: 'shortBreak' }),
    ])
    expect(s.focusMs).toBe(25 * MIN)
    expect(s.breakMs).toBe(5 * MIN)
  })

  it('additionne les interruptions', () => {
    const s = summarize([
      focus(at(2026, 7, 31), 25, { interruptions: { internal: 2, external: 1 } }),
      focus(at(2026, 7, 31, 12), 25, { interruptions: { internal: 1, external: 3 } }),
    ])
    expect(s.interruptions).toEqual({ internal: 3, external: 4 })
  })

  it('ne rend pas de taux de complétion sans focus', () => {
    expect(summarize([]).completionRate).toBeNull()
  })
})

describe('série journalière', () => {
  it('remplit les jours vides', () => {
    const series = dailySeries([focus(at(2026, 7, 29), 25)], 3, at(2026, 7, 31))
    expect(series.map((d) => d.date)).toEqual(['2026-07-29', '2026-07-30', '2026-07-31'])
    expect(series.map((d) => d.focusMs)).toEqual([25 * MIN, 0, 0])
  })
})

describe('série de jours (streak)', () => {
  it('compte les jours consécutifs avec au moins un focus terminé', () => {
    const sessions = [
      focus(at(2026, 7, 29), 25),
      focus(at(2026, 7, 30), 25),
      focus(at(2026, 7, 31), 25),
    ]
    expect(currentStreak(sessions, at(2026, 7, 31, 20))).toBe(3)
  })

  it('ne casse pas la série tant que la journée en cours n’est pas finie', () => {
    const sessions = [focus(at(2026, 7, 29), 25), focus(at(2026, 7, 30), 25)]
    // Le 31 au matin, rien n'a encore été fait : la série d'hier tient toujours.
    expect(currentStreak(sessions, at(2026, 7, 31, 9))).toBe(2)
  })

  it('retombe à zéro après deux jours sans rien', () => {
    const sessions = [focus(at(2026, 7, 28), 25)]
    expect(currentStreak(sessions, at(2026, 7, 31))).toBe(0)
  })

  it('ignore les focus annulés', () => {
    const sessions = [focus(at(2026, 7, 31), 10, { outcome: 'voided' })]
    expect(currentStreak(sessions, at(2026, 7, 31, 20))).toBe(0)
  })
})

describe('répartitions', () => {
  it('classe par tag, du plus travaillé au moins travaillé', () => {
    const rows = byTag([
      focus(at(2026, 7, 31), 25, { tag: 'perso' }),
      focus(at(2026, 7, 31, 12), 50, { tag: 'boulot' }),
      focus(at(2026, 7, 31, 14), 25, { tag: 'boulot' }),
    ])
    expect(rows.map((r) => r.key)).toEqual(['boulot', 'perso'])
    expect(rows[0]?.focusMs).toBe(75 * MIN)
  })

  it('répartit sur 24 heures locales', () => {
    const hours = byHour([focus(at(2026, 7, 31, 9), 25), focus(at(2026, 7, 31, 9), 25)])
    expect(hours).toHaveLength(24)
    expect(hours[9]).toBe(50 * MIN)
    expect(hours[10]).toBe(0)
  })
})

const task = (over: Partial<Task>): Task => ({
  id: 't1',
  title: 'Tâche',
  notes: null,
  tag: null,
  estimatedPomodoros: 4,
  completedPomodoros: 6,
  status: 'done',
  order: 0,
  createdAt: 0,
  completedAt: 1,
  ...over,
})

describe('précision d’estimation', () => {
  it('révèle la sous-estimation', () => {
    const { rows, overall } = estimationAccuracy([task({})])
    expect(rows[0]?.ratio).toBe(1.5)
    expect(overall).toBe(1.5)
  })

  it('ignore les tâches non terminées', () => {
    const { rows, overall } = estimationAccuracy([task({ status: 'active' })])
    expect(rows).toHaveLength(0)
    expect(overall).toBeNull()
  })
})

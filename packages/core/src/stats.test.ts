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

describe('local days', () => {
  it('slices days on local time, not UTC', () => {
    // 23:00 local on the 31st: still the 31st, even where UTC says the 1st.
    expect(dayKey(at(2026, 7, 31, 23))).toBe('2026-07-31')
    expect(dayKey(at(2026, 8, 1, 0))).toBe('2026-08-01')
  })

  it('crosses the daylight-saving change without shifting days', () => {
    // The night of 25 October 2026 in Europe/Paris: that day lasts 25 hours.
    const before = startOfDay(at(2026, 10, 24, 12))
    expect(dayKey(addDays(before, 1))).toBe('2026-10-25')
    expect(dayKey(addDays(before, 2))).toBe('2026-10-26')
    // A naive +24h would land on the 25th a second time.
    expect(dayKey(startOfDay(at(2026, 10, 25, 12)) + 24 * 3_600_000)).not.toBe('2026-10-27')
  })
})

describe('summary', () => {
  it('counts the time of a voided focus but not the pomodoro', () => {
    const s = summarize([
      focus(at(2026, 7, 31), 25),
      focus(at(2026, 7, 31, 12), 8, { outcome: 'voided' }),
    ])
    expect(s.completedFocus).toBe(1)
    expect(s.voidedFocus).toBe(1)
    expect(s.focusMs).toBe(33 * MIN)
    expect(s.completionRate).toBe(0.5)
  })

  it('separates break time from focus time', () => {
    const s = summarize([
      focus(at(2026, 7, 31), 25),
      focus(at(2026, 7, 31, 11), 5, { mode: 'shortBreak' }),
    ])
    expect(s.focusMs).toBe(25 * MIN)
    expect(s.breakMs).toBe(5 * MIN)
  })

  it('adds up interruptions', () => {
    const s = summarize([
      focus(at(2026, 7, 31), 25, { interruptions: { internal: 2, external: 1 } }),
      focus(at(2026, 7, 31, 12), 25, { interruptions: { internal: 1, external: 3 } }),
    ])
    expect(s.interruptions).toEqual({ internal: 3, external: 4 })
  })

  it('reports no completion rate without any focus session', () => {
    expect(summarize([]).completionRate).toBeNull()
  })
})

describe('daily series', () => {
  it('fills in empty days', () => {
    const series = dailySeries([focus(at(2026, 7, 29), 25)], 3, at(2026, 7, 31))
    expect(series.map((d) => d.date)).toEqual(['2026-07-29', '2026-07-30', '2026-07-31'])
    expect(series.map((d) => d.focusMs)).toEqual([25 * MIN, 0, 0])
  })
})

describe('streak', () => {
  it('counts consecutive days with at least one completed focus', () => {
    const sessions = [
      focus(at(2026, 7, 29), 25),
      focus(at(2026, 7, 30), 25),
      focus(at(2026, 7, 31), 25),
    ]
    expect(currentStreak(sessions, at(2026, 7, 31, 20))).toBe(3)
  })

  it('does not break the streak while today is not over', () => {
    const sessions = [focus(at(2026, 7, 29), 25), focus(at(2026, 7, 30), 25)]
    // On the morning of the 31st nothing is done yet: yesterday's streak holds.
    expect(currentStreak(sessions, at(2026, 7, 31, 9))).toBe(2)
  })

  it('falls back to zero after two empty days', () => {
    const sessions = [focus(at(2026, 7, 28), 25)]
    expect(currentStreak(sessions, at(2026, 7, 31))).toBe(0)
  })

  it('ignores voided focus sessions', () => {
    const sessions = [focus(at(2026, 7, 31), 10, { outcome: 'voided' })]
    expect(currentStreak(sessions, at(2026, 7, 31, 20))).toBe(0)
  })
})

describe('distributions', () => {
  it('ranks tags from most worked to least', () => {
    const rows = byTag([
      focus(at(2026, 7, 31), 25, { tag: 'personal' }),
      focus(at(2026, 7, 31, 12), 50, { tag: 'work' }),
      focus(at(2026, 7, 31, 14), 25, { tag: 'work' }),
    ])
    expect(rows.map((r) => r.key)).toEqual(['work', 'personal'])
    expect(rows[0]?.focusMs).toBe(75 * MIN)
  })

  it('spreads across 24 local hours', () => {
    const hours = byHour([focus(at(2026, 7, 31, 9), 25), focus(at(2026, 7, 31, 9), 25)])
    expect(hours).toHaveLength(24)
    expect(hours[9]).toBe(50 * MIN)
    expect(hours[10]).toBe(0)
  })
})

const task = (over: Partial<Task>): Task => ({
  id: 't1',
  title: 'Task',
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

describe('estimation accuracy', () => {
  it('reveals underestimation', () => {
    const { rows, overall } = estimationAccuracy([task({})])
    expect(rows[0]?.ratio).toBe(1.5)
    expect(overall).toBe(1.5)
  })

  it('ignores unfinished tasks', () => {
    const { rows, overall } = estimationAccuracy([task({ status: 'active' })])
    expect(rows).toHaveLength(0)
    expect(overall).toBeNull()
  })
})

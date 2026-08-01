import { describe, expect, it } from 'vitest'
import { RUN_GAP_MS, isRunOpen } from './runs'

const NOW = Date.UTC(2026, 6, 31, 15, 0, 0)

describe('run boundaries', () => {
  it('has no run before the first start', () => {
    expect(isRunOpen({ runStartedAt: null, idle: true, lastEndedAt: null, now: NOW })).toBe(false)
  })

  it('never closes a run while a phase is live', () => {
    // Flowtime: a focus session can run for hours without closing anything, so
    // reading the log alone would call this stale while the work is happening.
    const started = NOW - 5 * RUN_GAP_MS
    expect(isRunOpen({ runStartedAt: started, idle: false, lastEndedAt: null, now: NOW })).toBe(
      true,
    )
  })

  it('closes a run left idle past the gap', () => {
    const probe = {
      runStartedAt: NOW - 4 * RUN_GAP_MS,
      idle: true,
      lastEndedAt: NOW - RUN_GAP_MS - 1,
      now: NOW,
    }
    expect(isRunOpen(probe)).toBe(false)
  })

  it('keeps a run that is idle but still within the gap', () => {
    const probe = {
      runStartedAt: NOW - 4 * RUN_GAP_MS,
      idle: true,
      lastEndedAt: NOW - RUN_GAP_MS,
      now: NOW,
    }
    expect(isRunOpen(probe)).toBe(true)
  })

  it('measures the gap from the start when nothing has been recorded yet', () => {
    // Started, then reset before any phase closed: there is no session to read.
    const fresh = { runStartedAt: NOW - 60_000, idle: true, lastEndedAt: null, now: NOW }
    expect(isRunOpen(fresh)).toBe(true)

    const stale = { ...fresh, runStartedAt: NOW - RUN_GAP_MS - 1 }
    expect(isRunOpen(stale)).toBe(false)
  })

  it('ignores a session older than the run that follows it', () => {
    // The log keeps yesterday's sessions; only the current run's start matters.
    const probe = {
      runStartedAt: NOW - 60_000,
      idle: true,
      lastEndedAt: NOW - 30 * RUN_GAP_MS,
      now: NOW,
    }
    expect(isRunOpen(probe)).toBe(true)
  })
})

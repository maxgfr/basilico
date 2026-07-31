import { describe, expect, it } from 'vitest'
import { formatAgo, formatApproximate, formatClock, formatDuration, formatSigned } from './format'

describe('time formatting', () => {
  it('rounds up so 00:00 never shows before the end', () => {
    // 500 ms left must read 00:01, not 00:00: otherwise the timer looks finished
    // a second before it rings.
    expect(formatClock(500)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-5000)).toBe('00:00')
  })

  it('switches to hours past 60 minutes', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00')
    expect(formatClock(65 * 60_000)).toBe('1:05:00')
  })

  it('shows the overshoot as a positive value', () => {
    expect(formatSigned(-90_000)).toBe('+01:30')
    expect(formatSigned(90_000)).toBe('01:30')
  })

  it('stays vague in rough mode', () => {
    expect(formatApproximate(24 * 60_000)).toBe('about 24 minutes')
    expect(formatApproximate(30_000)).toBe('less than a minute')
    expect(formatApproximate(0)).toBe('done')
    expect(formatApproximate(120 * 60_000)).toBe('about 2h')
  })

  it('summarises stat durations', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(45 * 60_000)).toBe('45 min')
    expect(formatDuration(125 * 60_000)).toBe('2h 05')
    expect(formatDuration(120 * 60_000)).toBe('2h')
  })

  it('says how long ago a session ended', () => {
    expect(formatAgo(20_000)).toBe('just now')
    expect(formatAgo(12 * 60_000)).toBe('12 minutes ago')
    expect(formatAgo(60 * 60_000)).toBe('an hour ago')
  })
})

import { describe, expect, it } from 'vitest'
import { SETTINGS_VERSION, defaultSettings, parseSettings } from './settings'

describe('parseSettings', () => {
  it('falls back to the defaults on anything unreadable', () => {
    expect(parseSettings(null)).toEqual(defaultSettings)
    expect(parseSettings('nonsense')).toEqual(defaultSettings)
    expect(parseSettings({ durations: 'wrong' })).toEqual(defaultSettings)
  })

  it('keeps the fields it can read and fills in the rest', () => {
    const parsed = parseSettings({ schemaVersion: SETTINGS_VERSION, longBreakEvery: 3 })
    expect(parsed.longBreakEvery).toBe(3)
    expect(parsed.durations).toEqual(defaultSettings.durations)
  })

  describe('1 → 2: the endless cycle that stopped', () => {
    // `autoStartFocus` became `true` by default without a version bump, and
    // stored settings win over the defaults — so profiles written before that
    // kept `false` and the cycle stopped after every break.
    const v1 = {
      schemaVersion: 1,
      autoStartBreaks: true,
      autoStartFocus: false,
      longBreakEvery: 3,
    }

    it('repairs the old default pair', () => {
      const parsed = parseSettings(v1)
      expect(parsed.autoStartFocus).toBe(true)
      expect(parsed.autoStartBreaks).toBe(true)
      expect(parsed.schemaVersion).toBe(SETTINGS_VERSION)
    })

    it('leaves the rest of the profile alone', () => {
      expect(parseSettings(v1).longBreakEvery).toBe(3)
    })

    it('does not touch a profile that stopped both on purpose', () => {
      const parsed = parseSettings({ ...v1, autoStartBreaks: false })
      expect(parsed.autoStartFocus).toBe(false)
      expect(parsed.autoStartBreaks).toBe(false)
    })

    it('does not run again on a profile already at the current version', () => {
      const parsed = parseSettings({
        ...v1,
        schemaVersion: SETTINGS_VERSION,
      })
      expect(parsed.autoStartFocus).toBe(false)
    })
  })
})

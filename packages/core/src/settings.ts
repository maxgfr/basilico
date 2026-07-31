import { z } from 'zod'

export const SETTINGS_VERSION = 1

/**
 * A preset only sets the durations: everything else stays as the user left it.
 * 25/5 is the Cirillo canon; 50/10 and 52/17 are the two rhythms most asked for
 * by people whose flow a 25-minute stop breaks.
 *
 * By default the cycle loops: breaks **and** focus sessions start themselves, so
 * you never press "start" again.
 */
export const DURATION_PRESETS = {
  classic: { label: '25 / 5', focus: 25, shortBreak: 5, longBreak: 15 },
  long: { label: '50 / 10', focus: 50, shortBreak: 10, longBreak: 30 },
  desktime: { label: '52 / 17', focus: 52, shortBreak: 17, longBreak: 30 },
} as const

export type PresetName = keyof typeof DURATION_PRESETS

export const settingsSchema = z.object({
  schemaVersion: z.number().int(),
  durations: z.object({
    focus: z.number().int().min(1).max(240),
    shortBreak: z.number().int().min(1).max(120),
    longBreak: z.number().int().min(1).max(240),
  }),
  longBreakEvery: z.number().int().min(1).max(12),
  autoStartBreaks: z.boolean(),
  autoStartFocus: z.boolean(),
  /**
   * `classic` stops at zero. `overtime` keeps counting past it.
   * `flowtime` starts with no deadline and offers a proportional break.
   */
  mode: z.enum(['classic', 'overtime', 'flowtime']),
  /** Worked-time to proposed-break ratio in flowtime (1/5 by default). */
  flowtimeBreakRatio: z.number().min(0.05).max(1),
  display: z.enum(['exact', 'approximate', 'percent', 'hidden']),
  dailyGoalMinutes: z.number().int().min(0).max(1440),
  sound: z.object({
    enabled: z.boolean(),
    alarm: z.string(),
    volume: z.number().min(0).max(1),
    ticking: z.boolean(),
  }),
  notifications: z.object({
    enabled: z.boolean(),
    /** Heads-up 60 s before a focus ends and 30 s before a break does. */
    staged: z.boolean(),
  }),
  wakeLock: z.boolean(),
  pip: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
})

export type Settings = z.infer<typeof settingsSchema>

export const defaultSettings: Settings = {
  schemaVersion: SETTINGS_VERSION,
  durations: { focus: 25, shortBreak: 5, longBreak: 15 },
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: true,
  mode: 'classic',
  flowtimeBreakRatio: 0.2,
  display: 'exact',
  dailyGoalMinutes: 120,
  sound: { enabled: true, alarm: 'chime', volume: 0.6, ticking: false },
  notifications: { enabled: true, staged: false },
  wakeLock: false,
  pip: false,
  theme: 'system',
}

type Plain = Record<string, unknown>

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Deep-merges stored settings into the defaults.
 *
 * Essential: a shallow merge would drop any field added later inside a nested
 * object (`sound`, `notifications`) for existing users — they would keep a
 * truncated version forever.
 */
export function mergeSettings<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return base
  const out: Plain = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in out)) continue
    const current = out[key]
    out[key] =
      isPlainObject(current) && isPlainObject(value) ? mergeSettings(current, value) : value
  }
  return out as T
}

/** Successive migrations, applied in order from the stored version. */
const migrations: Record<number, (input: Plain) => Plain> = {
  // 0 → 1: first published version, nothing to transform.
  0: (input) => input,
}

/**
 * Reads settings coming from storage or an import. Never throws: unreadable
 * settings must not stop the app from starting.
 */
export function parseSettings(input: unknown): Settings {
  if (!isPlainObject(input)) return defaultSettings

  let data: Plain = { ...input }
  const from = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  for (let v = from; v < SETTINGS_VERSION; v++) {
    const migrate = migrations[v]
    if (migrate) data = migrate(data)
  }
  data.schemaVersion = SETTINGS_VERSION

  const merged = mergeSettings(defaultSettings, data)
  const result = settingsSchema.safeParse(merged)
  return result.success ? result.data : defaultSettings
}

export function applyPreset(settings: Settings, preset: PresetName): Settings {
  const { focus, shortBreak, longBreak } = DURATION_PRESETS[preset]
  return { ...settings, durations: { focus, shortBreak, longBreak } }
}

/** Planned duration of a phase, in milliseconds. */
export function plannedMsFor(
  settings: Settings,
  mode: 'focus' | 'shortBreak' | 'longBreak',
): number {
  return settings.durations[mode] * 60_000
}

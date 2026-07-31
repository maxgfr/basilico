import { z } from 'zod'

export const SETTINGS_VERSION = 1

/**
 * Un preset ne fixe que les durées : tout le reste des réglages reste celui de
 * l'utilisateur. 25/5 est le canon Cirillo ; 50/10 et 52/17 sont les deux
 * rythmes que réclament le plus les gens pour qui 25 minutes coupe le flow.
 *
 * Par défaut le cycle tourne en boucle : les pauses **et** les focus
 * s'enchaînent seuls, on ne represse jamais « démarrer ».
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
   * `classic` s'arrête à zéro. `overtime` continue de compter au-delà.
   * `flowtime` démarre sans échéance et propose une pause proportionnelle.
   */
  mode: z.enum(['classic', 'overtime', 'flowtime']),
  /** Ratio temps travaillé → pause proposée en flowtime (1/5 par défaut). */
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
    /** Alertes 60 s avant la fin d'un focus et 30 s avant la fin d'une pause. */
    staged: z.boolean(),
  }),
  wakeLock: z.boolean(),
  pip: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  hourFormat: z.union([z.literal(12), z.literal(24)]),
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
  weekStartsOn: 1,
  hourFormat: 24,
}

type Plain = Record<string, unknown>

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Fusion profonde des réglages persistés dans les défauts.
 *
 * Indispensable : une fusion superficielle ferait disparaître tout champ ajouté
 * plus tard dans un objet imbriqué (`sound`, `notifications`) pour les
 * utilisateurs existants — ils garderaient à vie une version amputée.
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

/** Migrations successives, appliquées dans l'ordre à partir de la version stockée. */
const migrations: Record<number, (input: Plain) => Plain> = {
  // 0 → 1 : première version publiée, rien à transformer.
  0: (input) => input,
}

/**
 * Lit des réglages venus du stockage ou d'un import. Ne jette jamais : des
 * réglages illisibles ne doivent pas empêcher l'app de démarrer.
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

/** Durée planifiée d'une phase, en millisecondes. */
export function plannedMsFor(
  settings: Settings,
  mode: 'focus' | 'shortBreak' | 'longBreak',
): number {
  return settings.durations[mode] * 60_000
}

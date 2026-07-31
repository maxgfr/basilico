import { z } from 'zod'
import { parseSettings, type Settings } from './settings'
import type { SessionRecord, Task } from './types'

export const BACKUP_VERSION = 1

export type Backup = {
  app: 'basilico'
  version: number
  exportedAt: number
  settings: Settings
  sessions: SessionRecord[]
  tasks: Task[]
}

const interruptionsSchema = z.object({
  internal: z.number().int().min(0),
  external: z.number().int().min(0),
})

const sessionSchema = z.object({
  id: z.string(),
  mode: z.enum(['focus', 'shortBreak', 'longBreak']),
  startedAt: z.number(),
  endedAt: z.number(),
  plannedMs: z.number(),
  actualMs: z.number(),
  overtimeMs: z.number().default(0),
  outcome: z.enum(['completed', 'voided', 'skipped']),
  taskId: z.string().nullable().default(null),
  tag: z.string().nullable().default(null),
  interruptions: interruptionsSchema.default({ internal: 0, external: 0 }),
  intention: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  rating: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .nullable()
    .default(null),
})

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable().default(null),
  tag: z.string().nullable().default(null),
  estimatedPomodoros: z.number().int().min(0),
  completedPomodoros: z.number().int().min(0),
  status: z.enum(['active', 'done', 'archived']),
  order: z.number(),
  createdAt: z.number(),
  completedAt: z.number().nullable().default(null),
})

const backupSchema = z.object({
  app: z.literal('basilico'),
  version: z.number().int(),
  exportedAt: z.number(),
  settings: z.unknown(),
  sessions: z.array(sessionSchema),
  tasks: z.array(taskSchema),
})

export function createBackup(
  settings: Settings,
  sessions: readonly SessionRecord[],
  tasks: readonly Task[],
  now: number,
): Backup {
  return {
    app: 'basilico',
    version: BACKUP_VERSION,
    exportedAt: now,
    settings,
    sessions: [...sessions],
    tasks: [...tasks],
  }
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

/**
 * Lit un fichier de sauvegarde. Ne jette jamais et ne remplace jamais
 * silencieusement des données : un import raté doit pouvoir être expliqué à
 * l'utilisateur, pas absorbé.
 */
export function parseBackup(input: unknown): ParseResult {
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      return { ok: false, error: 'This file is not valid JSON.' }
    }
  }

  const parsed = backupSchema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.join('.') ?? ''
    return {
      ok: false,
      error: where
        ? `Unreadable backup: the "${where}" field is invalid.`
        : 'This file is not a basilico backup.',
    }
  }

  if (parsed.data.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup comes from a newer version (v${parsed.data.version}). Update basilico before importing it.`,
    }
  }

  return {
    ok: true,
    backup: {
      ...parsed.data,
      settings: parseSettings(parsed.data.settings),
    },
  }
}

const CSV_COLUMNS = [
  'id',
  'mode',
  'started_at',
  'ended_at',
  'planned_minutes',
  'actual_minutes',
  'overtime_minutes',
  'outcome',
  'task_id',
  'tag',
  'interruptions_internal',
  'interruptions_external',
  'intention',
  'note',
  'rating',
] as const

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const toMinutes = (ms: number) => Math.round((ms / 60_000) * 100) / 100

export function toCsv(sessions: readonly SessionRecord[]): string {
  const rows = sessions.map((s) =>
    [
      s.id,
      s.mode,
      new Date(s.startedAt).toISOString(),
      new Date(s.endedAt).toISOString(),
      toMinutes(s.plannedMs),
      toMinutes(s.actualMs),
      toMinutes(s.overtimeMs),
      s.outcome,
      s.taskId,
      s.tag,
      s.interruptions.internal,
      s.interruptions.external,
      s.intention,
      s.note,
      s.rating,
    ]
      .map(csvCell)
      .join(','),
  )
  return [CSV_COLUMNS.join(','), ...rows].join('\n')
}

/**
 * Export au format Open Pomodoro (`open-pomodoro/go-openpomodoro`) : une
 * collection `pomodoros` dont chaque entrée porte `start_time` en RFC 3339,
 * `duration` en minutes entières, `description` et `tags`.
 *
 * Seuls les focus réellement terminés sont exportés : le format ne décrit que
 * des pomodoros faits, il n'a pas de notion de session annulée ni de pause.
 */
export function toOpenPomodoro(
  sessions: readonly SessionRecord[],
  titleOf: (taskId: string | null) => string | null = () => null,
): string {
  const pomodoros = sessions
    .filter((s) => s.mode === 'focus' && s.outcome === 'completed')
    .map((s) => ({
      start_time: new Date(s.startedAt).toISOString(),
      description: s.intention ?? titleOf(s.taskId) ?? '',
      duration: Math.max(1, Math.round(s.actualMs / 60_000)),
      tags: s.tag ? [s.tag] : [],
    }))
  return JSON.stringify({ pomodoros }, null, 2)
}

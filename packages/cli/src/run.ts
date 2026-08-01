import {
  activateTask,
  addTask,
  endPhase,
  exportCmd,
  importCmd,
  interruptCmd,
  listTasks,
  noteCmd,
  pauseCmd,
  planTaskCmd,
  reconcile,
  resetCmd,
  resumeCmd,
  start,
  stats,
  status,
  taskStatus,
  type Deps,
  type Result,
} from './commands'
import { render, statusLine } from './render'
import { parseData, type AppData } from './state'
import { runInstall } from './install'
import { dayKey } from '@basilico/core'

export const HELP = `basilico — a focus timer you can drive from a terminal.

  status [--line]            where you are: phase, cycle, this run, today
  start [--task <q>] [--intention <text>]
  pause | resume
  done                       end the phase and count it
  skip                       end it, keep the time, lose the pomodoro
  abandon                    same, for when the interruption won
  reset                      leave the cycle — records nothing
  interrupt internal|external
  note <text> [--rating 1-5] annotate the session that just ended

  tasks                      today's plan, the backlog, the archive
  tasks add <title> [--est n]
  tasks start <q>            make a task the active one
  tasks done|archive|restore <q>
  tasks plan <q> [--backlog]

  stats [--run|--today|--all]
  export                     a backup the web app imports as is
  import <file>

  install|uninstall --claude-code|--codex|--opencode|--all [--project]

Add --json to any of these to get the same answer as machine-readable JSON.
State lives in ~/.basilico/state.json, or wherever $BASILICO_STATE points.

There is no alarm: without a daemon, a command that is not running cannot ring.
\`status\` catches up instead — a phase that expired while you were away is
recorded at its real end time, not at the moment you asked.`

export type Io = {
  now: number
  uid: () => string
  readState: () => unknown
  writeState: (data: AppData) => void
  /** Reads a file the user named. Throws so `import` can report the failure. */
  readFile: (path: string) => string
  env: Record<string, string | undefined>
  home: string
  cwd: string
  /** Path to this engine, so the commands it writes can call back into it. */
  selfPath: string
  projectScope: boolean
  // Only the installer touches these: it is the one thing that writes outside
  // its own state file.
  readFileAt: (path: string) => string | null
  writeFileAt: (path: string, content: string) => void
  existsAt: (path: string) => boolean
  removeAt: (path: string) => void
}

export type Outcome = { stdout: string; stderr: string; code: number }

type Flags = { json: boolean; line: boolean; rest: string[]; opts: Map<string, string> }

/** Options that take a value; everything else starting with `--` is a switch. */
const VALUED = new Set(['--task', '--intention', '--rating', '--est', '--note'])

function parseArgs(argv: readonly string[]): Flags {
  const rest: string[] = []
  const opts = new Map<string, string>()
  let json = false
  let line = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    if (arg === '--json') json = true
    else if (arg === '--line') line = true
    else if (VALUED.has(arg)) opts.set(arg.slice(2), argv[++i] ?? '')
    else if (arg.startsWith('--')) opts.set(arg.slice(2), '')
    else rest.push(arg)
  }
  return { json, line, rest, opts }
}

export function run(argv: readonly string[], io: Io): Outcome {
  const flags = parseArgs(argv)
  const command = flags.rest[0] ?? 'status'

  if (command === 'help' || flags.opts.has('help')) {
    return { stdout: HELP, stderr: '', code: 0 }
  }
  if (command === 'install' || command === 'uninstall') {
    return runInstall(command, flags.opts, { ...io, projectScope: flags.opts.has('project') })
  }

  const deps: Deps = { now: io.now, uid: io.uid }
  // Every command starts by bringing the state up to date with the clock. The
  // state may well have moved on since the last one: acting on a stale reading
  // would close the wrong phase.
  const data = reconcile(parseData(io.readState(), io.now), deps)
  const result = dispatch(command, data, deps, flags, io)

  if (!result.ok) return { stdout: '', stderr: result.error, code: 1 }

  // Reconciliation alone can close a phase, so the state is always worth
  // writing back — even for a read-only-looking `status`.
  io.writeState(result.data)

  const text =
    flags.line && result.output.kind === 'view'
      ? statusLine(result.output.view)
      : render(result.output, flags.json)
  return { stdout: text, stderr: '', code: 0 }
}

function dispatch(command: string, data: AppData, deps: Deps, flags: Flags, io: Io): Result {
  const arg = (i: number) => flags.rest[i] ?? ''
  const num = (name: string, fallback: number) => {
    const raw = flags.opts.get(name)
    const parsed = raw === undefined || raw === '' ? Number.NaN : Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  switch (command) {
    case 'status':
      return status(data, deps)
    case 'start':
      return start(data, deps, {
        task: flags.opts.get('task'),
        intention: flags.opts.get('intention'),
      })
    case 'pause':
      return pauseCmd(data, deps)
    case 'resume':
      return resumeCmd(data, deps)
    case 'done':
      return endPhase(data, deps, 'completed')
    case 'skip':
      return endPhase(data, deps, 'skipped')
    case 'abandon':
      return endPhase(data, deps, 'voided')
    case 'reset':
      return resetCmd(data, deps)
    case 'interrupt':
      return interruptCmd(data, deps, arg(1))
    case 'note':
      return noteCmd(data, deps, arg(1), flags.opts.has('rating') ? num('rating', 0) : null)
    case 'tasks':
      return tasks(data, deps, flags, arg)
    case 'stats':
      return stats(data, deps, scopeOf(flags))
    case 'export':
      return exportCmd(data, deps)
    case 'import': {
      const path = arg(1)
      if (path === '') return { ok: false, error: 'Which file? `basilico import <file>`.' }
      try {
        return importCmd(io.readFile(path))
      } catch {
        return { ok: false, error: `Cannot read ${path}.` }
      }
    }
    default:
      return { ok: false, error: `Unknown command "${command}". Try \`basilico help\`.` }
  }
}

function tasks(data: AppData, deps: Deps, flags: Flags, arg: (i: number) => string): Result {
  const sub = arg(1)
  const query = arg(2)
  const needQuery = (): Result | null =>
    query === '' ? { ok: false, error: `Which task? \`basilico tasks ${sub} <title>\`.` } : null

  switch (sub) {
    case '':
    case 'list':
      return listTasks(data, deps)
    case 'add': {
      const raw = flags.rest.slice(2).join(' ')
      const est = flags.opts.has('est') ? Number(flags.opts.get('est')) : 1
      return addTask(data, deps, raw, Number.isFinite(est) ? est : 1)
    }
    case 'start':
      return needQuery() ?? activateTask(data, deps, query)
    case 'done':
      return needQuery() ?? taskStatus(data, deps, query, 'done')
    case 'archive':
      return needQuery() ?? taskStatus(data, deps, query, 'archived')
    case 'restore':
      return needQuery() ?? taskStatus(data, deps, query, 'active')
    case 'plan':
      return (
        needQuery() ??
        planTaskCmd(data, deps, query, flags.opts.has('backlog') ? null : dayKey(deps.now))
      )
    default:
      return { ok: false, error: `Unknown task command "${sub}". Try \`basilico help\`.` }
  }
}

function scopeOf(flags: Flags): 'run' | 'today' | 'all' {
  if (flags.opts.has('all')) return 'all'
  if (flags.opts.has('today')) return 'today'
  return 'run'
}

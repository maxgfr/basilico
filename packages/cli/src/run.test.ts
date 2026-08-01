import { describe, expect, it } from 'vitest'
import { run, type Io, type Outcome } from './run'
import { emptyData, type AppData } from './state'
import { defaultSettings } from '@basilico/core'

const T0 = Date.UTC(2026, 6, 31, 9, 0, 0)
const MIN = 60_000

/**
 * A whole CLI on a fake disk and a fake clock. Nothing here touches the real
 * home directory or `Date.now()` — the same discipline the core follows, and
 * the reason a timer can be tested at all.
 */
function harness(initial: AppData = emptyData()) {
  const files = new Map<string, string>()
  let stored: AppData = initial
  let seq = 0
  let now = T0

  const io = (): Io => ({
    now,
    uid: () => `id-${++seq}`,
    readState: () => JSON.parse(JSON.stringify(stored)) as unknown,
    writeState: (data) => {
      // Round-tripped through JSON on purpose: anything the real file cannot
      // carry must break here rather than in someone's terminal.
      stored = JSON.parse(JSON.stringify(data)) as AppData
    },
    readFile: (path) => {
      const found = files.get(path)
      if (found === undefined) throw new Error('missing')
      return found
    },
    env: {},
    home: '/home/test',
    cwd: '/repo',
    selfPath: '/skills/basilico/scripts/basilico.mjs',
    projectScope: false,
    readFileAt: (path) => files.get(path) ?? null,
    writeFileAt: (path, content) => void files.set(path, content),
    existsAt: (path) => files.has(path),
    removeAt: (path) => void files.delete(path),
  })

  return {
    files,
    at: (ms: number) => {
      now = ms
    },
    state: () => stored,
    run: (...argv: string[]): Outcome => run(argv, io()),
    json: (...argv: string[]): Record<string, unknown> => {
      const out = run([...argv, '--json'], io())
      expect(out.stderr).toBe('')
      return JSON.parse(out.stdout) as Record<string, unknown>
    },
  }
}

describe('driving a phase', () => {
  it('starts, reports where you are, and ends counting the pomodoro', () => {
    const cli = harness()

    expect(cli.run('start').code).toBe(0)
    expect(cli.state().timer.status).toBe('running')

    cli.at(T0 + 10 * MIN)
    const view = cli.json('status')
    expect(view.phase).toMatchObject({ mode: 'focus', status: 'running', remainingMs: 15 * MIN })
    expect(view.cycle).toMatchObject({ untilLongBreak: 4 })

    // Before the deadline: past it, reconciliation would have closed the phase
    // already and `done` would land on the break it handed over.
    cli.at(T0 + 20 * MIN)
    const done = cli.json('done')
    expect(cli.state().sessions.at(-1)?.outcome).toBe('completed')
    expect(done.today).toMatchObject({ done: 1 })
    // Ending by hand hands over the next phase running, whatever the settings.
    expect(cli.state().timer.mode).toBe('shortBreak')
    expect(cli.state().timer.status).toBe('running')
  })

  it('refuses to start twice rather than closing the wrong phase', () => {
    const cli = harness()
    cli.run('start')
    const second = cli.run('start')
    expect(second.code).toBe(1)
    expect(second.stderr).toMatch(/already under way/)
  })

  it('counts a skipped focus but not a skipped break', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + MIN)
    cli.run('skip') // focus
    cli.at(T0 + 2 * MIN)
    cli.run('skip') // the break it handed over

    const view = cli.json('status')
    expect(view.today).toMatchObject({ skipped: 1, done: 0 })
  })

  it('will not abandon a break, which costs no pomodoro', () => {
    const cli = harness()
    cli.run('start')
    cli.run('skip')
    const out = cli.run('abandon')
    expect(out.code).toBe(1)
    expect(out.stderr).toMatch(/Only a focus session/)
  })

  it('counts a reset the log deliberately does not record', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + 3 * MIN)
    expect(cli.run('reset').code).toBe(0)

    expect(cli.state().sessions).toHaveLength(0)
    expect(cli.json('status').today).toMatchObject({ resets: 1, done: 0 })
  })
})

describe('reconciling with the clock', () => {
  it('closes a phase that expired while nobody was looking, at its real end', () => {
    const cli = harness()
    cli.run('start')

    // Away for two hours. The focus was over at T0 + 25 min, not now.
    cli.at(T0 + 120 * MIN)
    const view = cli.json('status')

    const session = cli.state().sessions.at(-1)
    expect(session?.outcome).toBe('completed')
    expect(session?.endedAt).toBe(T0 + 25 * MIN)
    expect(view.catchUp).toMatch(/ended/)
    // Endless by default: it picked the cycle back up rather than sitting idle.
    expect(cli.state().timer.status).toBe('running')
  })

  it('never back-dates the phase it resumes', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + 120 * MIN)
    cli.run('status')

    // Dating the new phase back would hand over an already-expired one, and the
    // next call would close that too, and the one after it.
    expect(cli.state().timer.startedAt).toBe(T0 + 120 * MIN)
  })

  it('reconciles before it acts, so `done` cannot close a phase that is over', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + 120 * MIN)
    cli.run('done')

    const [first, second] = cli.state().sessions
    expect(first?.mode).toBe('focus')
    expect(first?.endedAt).toBe(T0 + 25 * MIN)
    // The `done` landed on the break that was actually running, not on the
    // focus session that had long since closed itself.
    expect(second?.mode).toBe('shortBreak')
  })
})

describe('the run, as opposed to the day', () => {
  it('opens on the first start and survives a reset', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + MIN)
    cli.run('reset')

    const view = cli.json('status')
    expect(view.run).toMatchObject({ resets: 1 })
  })

  it('closes after an hour away, while today keeps counting', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + 25 * MIN)
    cli.run('done')
    cli.at(T0 + 26 * MIN)
    cli.run('reset') // back to idle, nothing running

    cli.at(T0 + 26 * MIN + 61 * MIN)
    const view = cli.json('status')
    expect(view.run).toBeNull()
    expect(view.today).toMatchObject({ done: 1 })
  })
})

describe('tasks', () => {
  it('adds a task, attributes the session to it and credits it', () => {
    const cli = harness()
    cli.run('tasks', 'add', 'Write', 'the', 'core', '--est', '3')
    cli.run('start', '--task', 'core')

    expect(cli.state().timer.taskId).not.toBeNull()

    cli.at(T0 + 25 * MIN)
    cli.run('done')
    expect(cli.state().tasks[0]?.completedPomodoros).toBe(1)
  })

  it('refuses to guess between two tasks', () => {
    const cli = harness()
    cli.run('tasks', 'add', 'Write the core')
    cli.run('tasks', 'add', 'Write the docs')

    const out = cli.run('start', '--task', 'Write')
    expect(out.code).toBe(1)
    expect(out.stderr).toMatch(/matches 2 tasks/)
  })

  it('picks the tag out of the title', () => {
    const cli = harness()
    cli.run('tasks', 'add', 'Write', 'the', 'core', '#basilico')
    expect(cli.state().tasks[0]).toMatchObject({ title: 'Write the core', tag: 'basilico' })
  })
})

describe('the bridge to the web app', () => {
  it('exports a backup that imports back unchanged', () => {
    const cli = harness()
    cli.run('tasks', 'add', 'Write the core')
    cli.run('start')
    cli.at(T0 + 20 * MIN)
    cli.run('done')

    const exported = cli.run('export')
    expect(exported.code).toBe(0)
    const backup = JSON.parse(exported.stdout) as { app: string; sessions: unknown[] }
    expect(backup.app).toBe('basilico')
    expect(backup.sessions).toHaveLength(1)

    cli.files.set('/tmp/backup.json', exported.stdout)
    const imported = cli.run('import', '/tmp/backup.json')
    expect(imported.stdout).toMatch(/Imported 1 sessions and 1 tasks/)
    expect(cli.state().sessions).toHaveLength(1)
    expect(cli.state().tasks).toHaveLength(1)
  })

  it('explains a file it cannot read instead of wiping the log', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + 20 * MIN)
    cli.run('done')

    cli.files.set('/tmp/junk.json', 'not json at all')
    const out = cli.run('import', '/tmp/junk.json')
    expect(out.code).toBe(1)
    expect(cli.state().sessions).toHaveLength(1)
  })
})

describe('output', () => {
  it('renders a status bar line short enough to live in one', () => {
    const cli = harness()
    cli.run('start')
    cli.at(T0 + 10 * MIN)
    const line = cli.run('status', '--line')
    expect(line.stdout).toBe('Focus 15:00 · 0 today')
    expect(line.stdout).not.toContain('\n')
  })

  it('says what to do rather than failing silently on an unknown command', () => {
    const out = harness().run('frobnicate')
    expect(out.code).toBe(1)
    expect(out.stderr).toMatch(/basilico help/)
  })

  it('keeps the state readable across a settings change', () => {
    const cli = harness({ ...emptyData(), settings: { ...defaultSettings, longBreakEvery: 2 } })
    expect(cli.json('status').cycle).toMatchObject({ untilLongBreak: 2, longBreakEvery: 2 })
  })
})

describe('install', () => {
  it('writes the slash commands where each agent looks for them', () => {
    const cli = harness()
    const out = cli.run('install', '--all')

    expect(out.code).toBe(0)
    expect([...cli.files.keys()].sort()).toEqual([
      '/home/test/.claude/commands/basilico.md',
      '/home/test/.claude/commands/focus.md',
      '/home/test/.claude/settings.json',
      '/home/test/.codex/prompts/basilico.md',
      '/home/test/.codex/prompts/focus.md',
      '/home/test/.config/opencode/command/basilico.md',
      '/home/test/.config/opencode/command/focus.md',
    ])

    const settings = JSON.parse(cli.files.get('/home/test/.claude/settings.json') ?? '{}')
    expect(settings.statusLine).toMatchObject({ type: 'command' })
    expect(settings.statusLine.command).toContain('status --line')
  })

  it('merges into settings.json instead of replacing it, and keeps a copy', () => {
    const cli = harness()
    cli.files.set('/home/test/.claude/settings.json', '{"model":"opus","env":{"A":"1"}}')
    cli.run('install', '--claude-code')

    const settings = JSON.parse(cli.files.get('/home/test/.claude/settings.json') ?? '{}')
    expect(settings.model).toBe('opus')
    expect(settings.env).toEqual({ A: '1' })
    expect(cli.files.get('/home/test/.claude/settings.json.basilico-backup')).toContain('opus')
  })

  it('leaves a status bar that is not ours alone', () => {
    const cli = harness()
    cli.files.set(
      '/home/test/.claude/settings.json',
      '{"statusLine":{"type":"command","command":"my-own-thing"}}',
    )
    cli.run('uninstall', '--claude-code')

    const settings = JSON.parse(cli.files.get('/home/test/.claude/settings.json') ?? '{}')
    expect(settings.statusLine.command).toBe('my-own-thing')
  })

  it('takes back exactly what it put there', () => {
    const cli = harness()
    cli.run('install', '--all')
    cli.run('uninstall', '--all')

    const left = [...cli.files.keys()].filter((p) => !p.endsWith('-backup'))
    expect(left).toEqual(['/home/test/.claude/settings.json'])
    expect(JSON.parse(cli.files.get('/home/test/.claude/settings.json') ?? '{}')).toEqual({})
  })

  it('asks which agent rather than picking one', () => {
    const out = harness().run('install')
    expect(out.code).toBe(1)
    expect(out.stderr).toMatch(/--claude-code/)
  })
})

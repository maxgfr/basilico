import type { Io, Outcome } from './run'

/**
 * Wiring the extras, not the skill.
 *
 * The skill itself is already multi-harness: `npx skills add maxgfr/basilico
 * --agent '*'` drops it into Claude Code, Codex and OpenCode alike, and the
 * engine underneath is a plain `node scripts/basilico.mjs` that all three can
 * run. What is left over is per-harness sugar — the slash commands, and the
 * status bar — and that is all this installs.
 *
 * Every write says where it went. A tool that edits files you own in places you
 * cannot see is a tool you cannot undo.
 */

export type Harness = 'claude-code' | 'codex' | 'opencode'

const ALL: Harness[] = ['claude-code', 'codex', 'opencode']

/** Slash commands, identical in substance on all three: one file, one command. */
const COMMANDS = [
  {
    name: 'focus',
    description: 'Start a focus session, optionally on a task',
    hint: '[task]',
    body: (self: string) =>
      `Start a focus session with basilico.\n\n` +
      `Run \`node ${self} status --json\` first — the timer may have moved on since ` +
      `the last command, and a phase may have closed while nobody was looking.\n\n` +
      `Then start it: \`node ${self} start --json\`, adding \`--task "$ARGUMENTS"\` ` +
      `when the user named a task. Report the phase and the counts from the JSON. ` +
      `Never invent a count.`,
  },
  {
    name: 'basilico',
    description: 'Where you are in the cycle, or any basilico command',
    hint: '[command]',
    body: (self: string) =>
      `Run \`node ${self} $ARGUMENTS --json\`, or \`node ${self} status --json\` when ` +
      `no argument was given, and report what it says.\n\n` +
      `\`node ${self} help\` lists every command. Read the counts out of the JSON ` +
      `rather than deriving them from the conversation.`,
  },
]

type Target = { dir: string; frontmatter: (c: (typeof COMMANDS)[number]) => string }

function targetFor(harness: Harness, io: Io): Target {
  const home = io.home
  switch (harness) {
    case 'claude-code':
      return {
        dir: join(claudeDir(io), 'commands'),
        frontmatter: (c) => `---\ndescription: ${c.description}\nargument-hint: ${c.hint}\n---\n\n`,
      }
    case 'codex':
      return {
        dir: join(io.env.CODEX_HOME ?? join(home, '.codex'), 'prompts'),
        frontmatter: (c) => `---\ndescription: ${c.description}\n---\n\n`,
      }
    case 'opencode':
      return {
        dir: join(configHome(io), 'opencode', 'command'),
        frontmatter: (c) => `---\ndescription: ${c.description}\n---\n\n`,
      }
  }
}

const join = (...parts: string[]) => parts.join('/').replace(/\/+/g, '/')

function claudeDir(io: Io): string {
  return io.projectScope ? join(io.cwd, '.claude') : join(io.home, '.claude')
}

function configHome(io: Io): string {
  const xdg = io.env.XDG_CONFIG_HOME
  return xdg && xdg !== '' ? xdg : join(io.home, '.config')
}

export function runInstall(
  command: 'install' | 'uninstall',
  opts: Map<string, string>,
  io: Io,
): Outcome {
  const wanted = opts.has('all') ? ALL : ALL.filter((h) => opts.has(h))
  if (wanted.length === 0) {
    return {
      stdout: '',
      stderr:
        'Which agent? --claude-code | --codex | --opencode | --all\n' +
        "The skill itself installs with `npx skills add maxgfr/basilico --agent '*'`;\n" +
        'this only wires the slash commands and the status bar.',
      code: 1,
    }
  }

  const lines: string[] = []
  for (const harness of wanted) {
    const target = targetFor(harness, io)
    for (const command_ of COMMANDS) {
      const path = join(target.dir, `${command_.name}.md`)
      if (command === 'install') {
        io.writeFileAt(path, target.frontmatter(command_) + command_.body(io.selfPath) + '\n')
        lines.push(`wrote    ${path}`)
      } else if (io.existsAt(path)) {
        io.removeAt(path)
        lines.push(`removed  ${path}`)
      }
    }
    if (harness === 'claude-code') lines.push(...wireStatusLine(command, io))
  }

  lines.push(
    command === 'install'
      ? 'Restart the agent so it picks the new commands up.'
      : 'Removed. The skill itself is managed by `npx skills remove`.',
  )
  return { stdout: lines.join('\n'), stderr: '', code: 0 }
}

/**
 * The status bar. `settings.json` belongs to the user and holds far more than
 * this, so it is read, merged and written back — never replaced — and the
 * previous version is kept beside it.
 */
function wireStatusLine(command: 'install' | 'uninstall', io: Io): string[] {
  const path = join(claudeDir(io), 'settings.json')
  const existing = io.readFileAt(path)

  let settings: Record<string, unknown> = {}
  if (existing !== null) {
    try {
      settings = JSON.parse(existing) as Record<string, unknown>
    } catch {
      // Refusing beats clobbering: whatever is in there, it is not ours to lose.
      return [`skipped  ${path} is not valid JSON — left untouched`]
    }
    io.writeFileAt(`${path}.basilico-backup`, existing)
  }

  const line = { type: 'command', command: `node ${io.selfPath} status --line` }
  if (command === 'install') {
    settings.statusLine = line
  } else {
    const current = settings.statusLine as { command?: string } | undefined
    // Only ours comes out. Someone else's status bar is not ours to remove.
    if (!current?.command?.includes('basilico')) return [`kept     ${path} status bar is not ours`]
    delete settings.statusLine
  }

  io.writeFileAt(path, `${JSON.stringify(settings, null, 2)}\n`)
  return [`${command === 'install' ? 'wired' : 'unwired'}   ${path} (status bar)`]
}

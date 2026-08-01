import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { run, type Io } from './run'
import type { AppData } from './state'

/**
 * Where the log lives. One file, in the user's home rather than in a project:
 * a work session is not a property of the repository you happen to be in.
 */
export function statePath(env: NodeJS.ProcessEnv, home: string): string {
  const override = env.BASILICO_STATE
  return override && override !== '' ? override : join(home, '.basilico', 'state.json')
}

/**
 * Written to a neighbour and renamed over the target, because `rename` is
 * atomic on every platform that matters. A CLI killed mid-write must not be
 * able to leave half a work log on disk.
 */
function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, path)
}

export function main(argv: readonly string[]): number {
  const home = homedir()
  const path = statePath(process.env, home)

  const io: Io = {
    now: Date.now(),
    uid: randomUUID,
    readState: () => {
      try {
        return JSON.parse(readFileSync(path, 'utf8')) as unknown
      } catch {
        // No file yet, or an unreadable one: `parseData` starts from the
        // defaults rather than refusing to run.
        return {}
      }
    },
    writeState: (data: AppData) => writeAtomic(path, `${JSON.stringify(data, null, 2)}\n`),
    readFile: (p: string) => readFileSync(p, 'utf8'),
    env: process.env,
    home,
    cwd: process.cwd(),
    selfPath: fileURLToPath(import.meta.url),
    projectScope: false,
    readFileAt: (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null),
    writeFileAt: writeAtomic,
    existsAt: existsSync,
    removeAt: (p: string) => rmSync(p, { force: true }),
  }

  const outcome = run(argv, io)
  if (outcome.stdout !== '') process.stdout.write(`${outcome.stdout}\n`)
  if (outcome.stderr !== '') process.stderr.write(`${outcome.stderr}\n`)
  return outcome.code
}

process.exitCode = main(process.argv.slice(2))

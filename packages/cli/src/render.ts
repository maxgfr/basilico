import type { Counts, Output, View } from './commands'
import { MODE_WORD } from './commands'

/** `23:41`, or `1:05:00` past an hour. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** `2h 05`, `45 min`, `—`. The same shape the web app prints. */
export function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (h === 0) return `${rest} min`
  return rest === 0 ? `${h}h` : `${h}h ${String(rest).padStart(2, '0')}`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The counts, zeroes dropped. Same rule as the web screen: "0 skipped ·
 * 0 abandoned · 0 resets" is four words saying nothing, but the pomodoros
 * anchor the line even at zero.
 */
export function countsLine(c: Counts): string {
  const parts = [plural(c.done, 'done', 'done')]
  if (c.skipped > 0) parts.push(`${c.skipped} skipped`)
  if (c.abandoned > 0) parts.push(`${c.abandoned} abandoned`)
  if (c.resets > 0) parts.push(plural(c.resets, 'reset', 'resets'))
  // Guarded on what it renders, not on the milliseconds: a twenty-second focus
  // is above zero and still prints as "—", which reads as a broken field.
  const focus = duration(c.focusMs)
  if (focus !== '—') parts.push(`${focus} focus`)
  if (c.interruptions > 0) parts.push(plural(c.interruptions, 'interruption', 'interruptions'))
  return parts.join(' · ')
}

export function cycleLine(view: View): string {
  const { untilLongBreak: left } = view.cycle
  if (view.phase.mode === 'longBreak') return 'This is the long break.'
  if (left === 0) return 'Long break next.'
  if (left === 1) {
    return view.phase.mode === 'focus'
      ? 'Long break after this one.'
      : 'Long break after one more focus session.'
  }
  return `Long break after ${left} more focus sessions.`
}

function phaseLine(view: View): string {
  const { mode, status, remainingMs, elapsedMs } = view.phase
  const what = MODE_WORD[mode]
  if (status === 'idle') return `Nothing running — ${what} ready, ${clock(remainingMs ?? 0)}.`
  // Flowtime focus has no deadline, so what counts is the time already spent.
  const time = remainingMs === null ? `${clock(elapsedMs)} in` : clock(remainingMs)
  if (status === 'overtime')
    return `${capitalise(what)}, ${clock(-(remainingMs ?? 0))} past the end.`
  if (status === 'paused') return `${capitalise(what)}, paused at ${time}.`
  return `${capitalise(what)}, ${time} left.`
}

/**
 * One line for a status bar. Deliberately terse and free of punctuation that
 * would fight whatever the bar puts around it.
 */
export function statusLine(view: View): string {
  const { mode, status, remainingMs, elapsedMs } = view.phase
  const label = { focus: 'Focus', shortBreak: 'Break', longBreak: 'Long break' }[mode]
  if (status === 'idle') return `${label} ready`
  const time = remainingMs === null ? clock(elapsedMs) : clock(Math.abs(remainingMs))
  const marks = status === 'paused' ? ' paused' : status === 'overtime' ? ' over' : ''
  const done = view.today.done
  return `${label} ${time}${marks} · ${done} today`
}

export function renderView(view: View): string {
  const lines: string[] = []
  if (view.headline) lines.push(view.headline)
  if (view.catchUp) lines.push(view.catchUp)
  lines.push(phaseLine(view))
  lines.push(cycleLine(view))
  if (view.task) lines.push(`Task: ${view.task.title}`)
  if (view.intention) lines.push(`Intention: ${view.intention}`)
  const run = view.run ? countsLine(view.run) : null
  const today = countsLine(view.today)
  if (run !== null) lines.push(`This run  ${run}`)
  // Same rule as the timer screen: the same six figures twice over say nothing
  // the first line did not.
  if (run !== today) lines.push(`Today     ${today}`)
  return lines.join('\n')
}

export function render(output: Output, json: boolean): string {
  if (json) return JSON.stringify(payload(output), null, 2)

  switch (output.kind) {
    case 'view':
      return renderView(output.view)
    case 'tasks': {
      const lines: string[] = []
      lines.push(section('Today', output.today))
      lines.push(section('Backlog', output.backlog))
      if (output.archived.length > 0) lines.push(`Archived  ${output.archived.length}`)
      lines.push(`Left to do on today's plan: ${output.load} pomodoros.`)
      return lines.join('\n')
    }
    case 'stats':
      return [
        `${capitalise(output.scope)}  ${countsLine(output.counts)}`,
        output.completionRate === null
          ? null
          : `Completion rate ${Math.round(output.completionRate * 100)}%`,
      ]
        .filter((l): l is string => l !== null)
        .join('\n')
    case 'text':
      return output.text
  }
}

function payload(output: Output): unknown {
  switch (output.kind) {
    case 'view':
      return output.view
    case 'tasks':
      return {
        today: output.today,
        backlog: output.backlog,
        archived: output.archived,
        load: output.load,
      }
    case 'stats':
      return { scope: output.scope, counts: output.counts, completionRate: output.completionRate }
    case 'text':
      return output.json
  }
}

function section(
  title: string,
  rows: { title: string; completed: number; estimated: number; active: boolean }[],
): string {
  if (rows.length === 0) return `${title}  (empty)`
  const body = rows
    .map((r) => `  ${r.active ? '›' : ' '} ${r.title}  ${r.completed}/${r.estimated}`)
    .join('\n')
  return `${title}\n${body}`
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

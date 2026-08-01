---
name: basilico
description: "Use when the user wants to run, track or report on their work sessions from the terminal — start a pomodoro or a focus session, pause it, end it, skip it, abandon it, reset the cycle, note an interruption, annotate a session, or ask where they are and how the day is going. basilico is a deterministic zero-dependency engine (`node scripts/basilico.mjs`, no keys, no install, no network) driving the same domain core as the basilico web app: an absolute-deadline timer with focus/short-break/long-break cycles, tasks with estimates and a today plan, an append-only session log, and statistics. Four ways a phase ends and each costs something different — Done and running out COUNT the pomodoro, Skip and Abandon keep the time but lose it, Reset records nothing — so the command matters and the tool never guesses which one you meant. Every command reconciles with the clock first, closing a phase that expired while nobody was looking at its REAL end time, which is what makes a stateless CLI able to drive a timer at all. `export` writes the same backup the web app imports, and vice versa: that is the only bridge, since localStorage is not readable from a shell and the project refuses to run a server. Triggers: 'start a pomodoro', 'start a focus session', 'je commence une session de travail', 'where am I', 'how many cycles today', 'combien de cycles', 'pause the timer', 'I'm done with this one', 'skip this', 'j'abandonne celui-là', 'note this session', 'how was my day', 'install basilico'. Not a notifier: without a daemon nothing can ring."
license: MIT
metadata:
  version: 0.1.0
---

# basilico — a focus timer a coding agent can actually drive

The engine is the same domain core the web app runs on: a timer whose remaining
time is **derived from an absolute deadline and never decremented**, cycles of
focus and breaks, an append-only session log, tasks with estimates.

That design is why a CLI works here at all. Nothing counts down between two
commands; the state on disk is `{ mode, startedAt, endsAt, pausedAt }` and every
invocation recomputes the rest from the clock. A phase that ran out while nobody
was looking is closed **at its real `endsAt`**, not at the moment you asked.

> **Two rules, and they are the two ways to get this wrong:**
>
> 1. **Run `status --json` before you act.** The state moves on its own. A phase
>    may have closed, and the cycle may have handed over the next one, since
>    whatever you last saw. Acting on a stale reading closes the wrong phase, and
>    the log is append-only — none of it comes back.
> 2. **Read the numbers, never derive them.** Counts come out of the `--json`
>    payload. Do not add up what you remember of the conversation, and do not
>    round a duration the engine already formatted.

## The command matters: four ways to end a phase

| Command             | Recorded    | Time in stats | Pomodoro |
| ------------------- | ----------- | ------------- | -------- |
| runs out on its own | `completed` | yes           | **yes**  |
| `done`              | `completed` | yes           | **yes**  |
| `abandon`           | `voided`    | yes           | no       |
| `skip`              | `skipped`   | yes           | no       |
| `reset`             | nothing     | —             | no       |

`done` is the one that counts it — use it when the user says they finished.
`abandon` is for when the interruption won: the time still counts, the pomodoro
does not. `skip` moves the cycle on. `reset` is the only way _out_ of the cycle,
and the only action that records nothing.

**When the user is vague, ask.** "I'm finished with this" is `done`; "forget this
one" is `abandon`; "next" is `skip`. Guessing costs a pomodoro or invents one.

## Route by situation

1. **"Where am I?"** — `status --json`. Reports the phase, the time left, how far
   the long break is, the active task, and two sets of counts: `run` (this
   stretch at the desk, which ends after an hour away) and `today` (the local
   day). `run` is `null` when no stretch is open.
2. **"Start working"** — `start`, adding `--task "<some words from the title>"`
   when a task was named and `--intention "..."` when they said what they are
   about to do. It refuses rather than guessing between two matching tasks.
3. **"How did today go?"** — `stats --today --json`, or `--all` for the whole
   log. `completionRate` is completed focus over started focus.
4. **They were interrupted** — `interrupt internal` (their own head) or
   `interrupt external` (someone else). Cirillo counts these separately, and
   they ride along on the session record.
5. **A session just ended and they said something about it** — annotate it with
   `note` and an optional `--rating 1-5`. This is the one write the append-only
   log accepts, and it never touches durations or outcome.
6. **Planning** — `tasks` shows today's plan and the backlog, `tasks add` puts
   one on today (write the tag inline, `#basilico`, and the estimate with
   `--est`). Then `tasks done|archive|restore <query>` and `tasks plan <query>`.
7. **Moving between the terminal and the browser** — `export > file.json`, then
   import it in the web app's Settings → Data, or the reverse with
   `import file.json`. Same format both ways.

## Commands

```sh
node scripts/basilico.mjs help          # every command, with its cost
node scripts/basilico.mjs status [--line] [--json]
node scripts/basilico.mjs start [--task <q>] [--intention <text>]
node scripts/basilico.mjs pause | resume
node scripts/basilico.mjs done | skip | abandon | reset
node scripts/basilico.mjs interrupt internal | external
node scripts/basilico.mjs note "<text>" [--rating 1-5]
node scripts/basilico.mjs tasks [add|start|done|archive|restore|plan] ...
node scripts/basilico.mjs stats [--run|--today|--all]
node scripts/basilico.mjs export | import <file>
```

`--json` works on all of them. State lives in `~/.basilico/state.json`, or
wherever `$BASILICO_STATE` points — one file, in the user's home rather than in
a repository, because a work session is not a property of the project you happen
to be sitting in.

## Optional wiring

The skill works as-is on every agent. These add slash commands (`/focus`,
`/basilico`) and, on Claude Code, a status bar showing the phase and the time
left:

```sh
node scripts/basilico.mjs install --claude-code   # commands + status bar
node scripts/basilico.mjs install --codex         # ~/.codex/prompts
node scripts/basilico.mjs install --opencode      # ~/.config/opencode/command
node scripts/basilico.mjs install --all
```

Every write prints its path. `--project` scopes the Claude Code install to
`./.claude`. `uninstall` takes back exactly what `install` put there, and leaves
a status bar it did not write alone. `settings.json` is read, merged and written
back, never replaced, with the previous version kept beside it.

## What it deliberately does not do

- **No alarm, no notification.** Without a daemon, a command that is not running
  cannot ring. `status` catches up instead — it reports "your focus ended 12
  minutes ago" and records the session at the right time. The web app plus its
  Chrome extension is what covers the notification case.
- **No sync with the browser.** `localStorage` is not readable from a shell, and
  this project refuses to run a server. `export` and `import` are the bridge, and
  they are honest about being a copy rather than a link.
- **No settings editing.** Durations, cycle length and modes are changed in the
  app. The CLI reads them and never rewrites them.

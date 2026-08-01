---
description: Start a focus session, optionally on a task
argument-hint: [task]
---

Start a focus session with basilico.

The engine is at `${CLAUDE_PLUGIN_ROOT}/skills/basilico/scripts/basilico.mjs`.

1. Run `node <engine> status --json` first. The timer moves on its own — a phase
   may have closed and handed over the next one since anything you last saw, and
   acting on a stale reading closes the wrong one.
2. If a phase is already running, say so and stop. Do not reset or skip it
   without being asked: `skip` and `abandon` each cost a pomodoro, and the log is
   append-only.
3. Otherwise run `node <engine> start --json`, adding `--task "$ARGUMENTS"` when
   a task was named.

Report the phase, the time left, and the counts straight from the JSON. Never
add up counts yourself.

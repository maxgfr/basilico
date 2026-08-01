---
description: Where you are in the cycle, or any basilico command
argument-hint: [command]
---

The engine is at `${CLAUDE_PLUGIN_ROOT}/skills/basilico/scripts/basilico.mjs`.

Run `node <engine> $ARGUMENTS --json` — or `node <engine> status --json` when no
argument was given — and report what it says.

`node <engine> help` lists every command. Two things to keep in mind:

- The four ways a phase ends do not cost the same. `done` and running out count
  the pomodoro; `skip` and `abandon` keep the time and lose it; `reset` records
  nothing. If the user was vague about which they meant, ask rather than guess.
- Read the counts out of the JSON. Do not derive them from the conversation.

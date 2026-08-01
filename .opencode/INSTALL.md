# Installing basilico for OpenCode

The skill is agent-agnostic — the engine is a plain `node scripts/basilico.mjs`
that OpenCode can run like any other command. The simplest install covers every
agent at once:

```sh
npx skills add maxgfr/basilico --agent '*'
```

To install it for OpenCode only:

```sh
npx skills add maxgfr/basilico --agent opencode
```

Then use OpenCode's native `skill` tool:

```
use skill tool to load basilico
```

## Slash commands

Optional. `/focus` starts a session, `/basilico` runs anything else:

```sh
node ~/.config/opencode/skills/basilico/scripts/basilico.mjs install --opencode
```

That writes `focus.md` and `basilico.md` into `~/.config/opencode/command/`
(or `$XDG_CONFIG_HOME/opencode/command/`) and prints both paths. `uninstall
--opencode` removes exactly those two files.

Restart OpenCode so it picks the commands up.

## Where the state lives

`~/.basilico/state.json`, or wherever `$BASILICO_STATE` points. One file for the
machine, not one per project: a work session is not a property of the repository
you happen to be sitting in. Every agent you install this for drives the _same_
timer, which is the point — starting a session in OpenCode and asking about it
in Codex has to give the same answer.

## Moving between the terminal and the web app

There is no sync, deliberately: `localStorage` is not readable from a shell and
this project runs no server. `export` and `import` carry the same backup format
the web app's Settings → Data reads and writes.

```sh
basilico export > basilico.json     # then import it in the browser
basilico import basilico.json       # or the other way round
```

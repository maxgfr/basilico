# basilico — design notes

Why the code looks the way it does. Written after the build rather than before, so it describes what
is actually there.

## The problem being solved

The timer is a solved problem. Surveying the open-source landscape before starting made that
obvious: FocusTide (400+ ★) ships no statistics at all, Marinara (2.5k ★) died with Manifest V3,
Pomofocus paywalls CSV export. What is missing everywhere is the part _after_ the timer — history,
reports, and getting your data back out. That is where basilico spends its effort.

Constraints accepted up front: no account, no server, no tracking. Everything runs from a static
site on GitHub Pages.

## Naming

"Pomodoro" is a registered trademark of Francesco Cirillo, and the trademark guidelines forbid using
it in a product or domain name — which is why the serious projects are called Marinara, Pomatez or
FocusTide. Hence `basilico`, plus the non-affiliation disclaimer in the README. Describing the app
as "based on the Pomodoro Technique®" is explicitly permitted.

## The one rule the whole timer rests on

**Remaining time is computed from an absolute deadline, never decremented.** The persisted state is
`{ mode, startedAt, endsAt, pausedAt, pausedTotalMs }`, and the display derives `endsAt - now`.

Three mechanisms make that reliable, because none is sufficient alone:

1. **`Date.now()`, not `performance.now()`.** The monotonic clock does not advance during system
   sleep on macOS and Linux: a laptop closed for 20 minutes would leave the timer 20 minutes behind.
   A guard rejects absurd clock jumps (NTP correction, manual change) by treating them as "ended
   while away" rather than drift.
2. **Two separate timers.** A `setInterval(~250 ms)` only repaints the digits while the page is
   visible, and a **single un-nested `setTimeout`** is armed on the exact deadline. A `setTimeout`
   at nesting level 1 escapes Chrome's intensive throttling (which needs level ≥ 5), so at worst it
   fires about a second late. It is re-armed on every `visibilitychange`.
3. **Reconciliation** on `visibilitychange`, `pageshow` (bfcache), `resume` (Page Lifecycle) and
   `document.wasDiscarded` at boot. This is what produces "your session ended 15 minutes ago"
   instead of a silent jump to 00:00.

What remains outside our control: since Chrome 133, Energy Saver **freezes** a hidden, silent tab
that has been consuming CPU for more than five minutes — JavaScript stops dead, with no error.
Hence (a) near-zero CPU while hidden, (b) the alarm scheduled on the audio clock, which survives the
freeze, (c) reconciliation on return, and (d) the Chrome extension as the only real answer.

## Browser traps that had to be handled

| Trap                                 | Consequence if ignored                                                                          | What we do                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `new Notification()` on Android      | `TypeError`, no alert, silent failure                                                           | `registration.showNotification()` everywhere, constructor only as a fallback                    |
| Permission requested on load         | auto-rejected, and the refusal is **permanent**                                                 | asked on the first "Start" click, behind our own pre-prompt                                     |
| `requireInteraction`                 | absent from Safari, approximate on macOS                                                        | treated as decoration, never relied upon                                                        |
| `AudioContext` created on load       | born `suspended`, alarm silent                                                                  | `resume()` inside the "Start" click handler                                                     |
| Safari in the background             | context goes `interrupted`, scheduled alarm lost                                                | check `ctx.state` on `visibilitychange` + JS fallback with an anti-duplicate flag               |
| "Silent audio" anti-throttling trick | doesn't work (Chrome ignores silent streams), lights the audio indicator, drains battery        | not used                                                                                        |
| `beforeunload` for persistence       | state lost on mobile, breaks bfcache                                                            | persist on `visibilitychange → hidden`                                                          |
| `sw.js` in a subfolder               | registration refused (scope too broad), **no workaround** on Pages                              | `sw.js` served at the root of `/basilico/`                                                      |
| `"start_url": "/"`                   | the installed app opens maxgfr.github.io instead of basilico                                    | `start_url: "./"`, `scope: "./"`, explicit `id`                                                 |
| **Shared `maxgfr.github.io` origin** | key collisions with the account's other Pages projects; eviction wipes the whole origin at once | everything prefixed `basilico:v1:`, named caches, non-matching caches purged on `activate`      |
| Wake lock                            | released as soon as the page is hidden, never restored                                          | re-acquired on `visibilitychange`, off by default                                               |
| SPA routing on Pages                 | 404 when reloading a sub-view                                                                   | **hash routing** — no server involvement, no redirect flash, identical inside the installed PWA |

**Sound** is scheduled on the audio clock (`source.start(ctx.currentTime + remaining)`), which is
hardware-driven and independent of the JS event loop, so it rings on time even when the main thread
is throttled or frozen.

## Storage

**localStorage, deliberately.** A session record is roughly 100 bytes; ten sessions a day for a year
is about 300 kB against a ~5 MB quota. IndexedDB would add asynchrony everywhere and buys nothing —
it is subject to exactly the same Safari eviction. Everything goes through a single storage module,
with `idb-keyval` as a documented escape hatch should history ever pass ~2 MB.

Keys are prefixed `basilico:v1:` because the GitHub Pages origin is shared with every other project
on the account.

## Architecture

```
packages/core/     TypeScript, zero DOM, injected clock — timer, cycles, sessions, tasks, stats, backups
packages/cli/      the same core from a terminal; state file and clock injected too
apps/web/          React interface + browser adapters under src/platform
apps/extension/    Chrome MV3: alarms, notifications, offscreen audio
skills/basilico/   the agent skill: SKILL.md + a committed bundle of the CLI
```

The core knows nothing about the browser. That is what lets the timer be tested with a fake clock
instead of real waiting, and what lets the extension reuse the same logic.

**The extension is a notifier, not a second timer.** The app stays the single source of truth and
announces its deadline; the extension sets a `chrome.alarms` alarm and alerts. Two independent
timers would drift apart and someone would then have to arbitrate which is right. The bridge goes
through a content script and `window.postMessage`, because the extension id differs between a
developer-mode install and a Store publication.

## Charts

Hand-written SVG, zero dependencies. Recharts weighs 144 kB gzipped — more than the entire app — and
canvas-based libraries render **nothing** into the accessibility tree. Here each figure is paired
with a screen-reader table carrying the exact numbers, and the automated axe audit passes on every
screen in both themes.

## Stack notes

- **TypeScript 7** works here because we lint with **oxlint**. The thing blocking the ecosystem on
  TS 7 is `typescript-eslint`, which needs a programmatic API TS 7 doesn't expose yet. Reintroducing
  typescript-eslint means going back to `~6.0.x`.
- **Vite 8** runs on Rolldown: the config key is `build.rolldownOptions`, not `rollupOptions`.
- **Tailwind v4** puts the theme in CSS. The `ink` ramp is named by role, so the light theme is only
  an inversion of those tokens — no component carries a variant of its own.
- **Vitest 4** removed `coverage.all`: without an explicit `coverage.include`, coverage silently
  reports only the files the tests imported.

## Known limits, stated in the README

- No notification once the tab is closed. Web Push needs a server and VAPID keys; the API that would
  have solved it server-free (Notification Triggers) was abandoned by Chrome.
- Data lives in one browser. Safari deletes all script-writable storage for sites not visited in
  seven days — the app requests persistent storage and pushes exports.
- No sync. Export and import to move between machines.

## Recording, beyond the numbers

A session can carry an **intention** written before it starts and a **note plus a 1–5 rating**
written after it ends. Both are optional and the prompt is dismissible: a form you cannot skip
becomes a toll on every session, and the tool would stop being worth opening.

That annotation is the one write the append-only log accepts. It never touches durations or outcome,
so every statistic stays reproducible from the log alone.

**Tags** are typed inline — `Write the core #basilico` — rather than through a separate field. The
task form lives in a 20 rem column where a fourth input pushed everything onto a second line, and
the `#` convention is one people already know. A session freezes its task's tag at start time:
reading it back from the task later would silently rewrite months of history the first time someone
retags something.

## Four ways a session ends, and what each one costs

A session carries an outcome, and the vocabulary has to make the consequence
obvious _before_ the click, because the log is append-only and none of it can be
taken back.

| Action      | Recorded    | Time in stats | Pomodoro |
| ----------- | ----------- | ------------- | -------- |
| runs out    | `completed` | yes           | yes      |
| **Done**    | `completed` | yes           | yes      |
| **Abandon** | `voided`    | yes           | no       |
| **Skip**    | `skipped`   | yes           | no       |
| **Reset**   | nothing     | —             | no       |

The one that used to be missing is **Done**. Without it the only manual exit from
a focus session was the one that threw the pomodoro away — which read as "end the
session" and quietly cost you the credit — and in flowtime, where a focus phase
has no deadline to run out, _no pomodoro could ever be completed at all_: no
streak, no task credit, an empty Open Pomodoro export.

It is deliberately possible to press Done early, which Cirillo's indivisible
pomodoro forbids. Flowtime leaves no alternative, and the record keeps the real
`actualMs`, so the durations and the estimate accuracy stay honest either way.

**Abandon** was called "void". The word is precise and nobody used it that way:
people read it as "end this session", which is exactly what it does — the part
they missed is the pomodoro it costs. Only the label changed; the stored outcome
is still `voided`, because it is in every export ever written.

**Reset** is the one that records nothing, and so the one real exit from the
cycle below.

## Where you are, in words rather than dots

The main screen used to carry four 1.5 rem pips beside the phase label. They
counted the focus sessions done since the last long break, and nothing on screen
said so: the only explanation was an `aria-label`, which sighted users never see.

They also could not be read. A filled pip was a 6px `ink-600` disc; an empty one
was a 6px `ink-600` ring with a 1px stroke and a 4px hole. Same colour, same
size, four of them in a row — at that scale the two states are one state. The
rule the component's own comment states, that colour alone never carries the
information, was satisfied on paper and broken in practice.

So the position is a sentence now — "Long break after 2 more focus sessions" —
and it sits under the ring with the counts rather than inside a caption 280px
wide. `focusUntilLongBreak` lives in the core beside `nextMode` so the wording
cannot drift from the `>=` that makes a long break survive a reset; the phrasing
stays in the interface.

## A run is not a session

"Session" was already taken: a `SessionRecord` is one phase. The thing people
mean by "this session" — the stretch at the desk — had no name and no record,
because the log is flat and indexed by time alone.

So a **run** is a start timestamp kept beside the log, and `isRunOpen` is the one
rule that says whether it is still the one you are in. A run ends on a **gap**,
not on a reset: counting "the resets in this run" would be meaningless if a reset
closed the run it is counted in — the number would always be zero. An hour away
is the gap, and a phase that is still running is never a gap however long it has
been going, because in flowtime a focus session can pass an hour without closing
anything and reading the log alone would call the run stale while the work is
happening.

Two scopes are shown, not one. The run survives a reset and dies overnight-ish;
today survives a lunch break and dies at midnight. When both carry the same
figures only the run is printed — six identical numbers twice over say nothing
the first line did not.

**Resets live outside the log.** Reset records nothing; that is the point of it,
and it is why the count has to be carried next to the log rather than derived
from it. It stays local to the store: not in `backup.ts`, not in the CSV, not in
the Open Pomodoro export. Every statistic in a backup is still reproducible from
the log alone, and the export schema did not have to move.

## An endless cycle means endless

With "never stop on its own" set — the default — the timer chains focus, break,
focus, break, and only an explicit stop ends it. An absence is not an explicit
stop, so coming back to a session that ended an hour ago no longer leaves the
timer idle: it resumes.

The one thing that cannot happen is inventing work. A phase resumed after an
absence starts **now**, never back-dated to the old deadline — dating it back
would hand over an already-expired phase, and the next tick would close that one
too, and the one after it. The banner still reports the session that really
ended, and when.

Turn the setting off and the old behaviour returns: past a minute of lateness the
timer stops and hands control back, because you did not ask it to keep going.

That setting governs what the timer does **unattended**, and nothing else. A
phase you end yourself — Done, Abandon, Skip — always hands over the next one
running, whatever the setting says: pressing "skip to the next phase" _is_ the
request to carry on, and answering it with an idle timer is just a second click
demanded for a decision already made. `reset` is what stops the cycle, and it is
the one action that records nothing.

The distinction is a `manual` / `elapsed` intent passed into `closePhase`, not a
reading of the settings at the call site: the two callers, `finish` and
`advance`, are exactly the two cases.

This was a real bug, and a nastier one than it looked. The default for
`autoStartFocus` was flipped to `true` without bumping the settings version —
and stored settings are merged _over_ the defaults, so every profile written
before the flip kept `false` for good. Start, skip, skip, and the timer sat there
on "Start". Hence both halves of the fix: the intent above, and a `1 → 2`
migration repairing that exact pair.

## One menu, not a bar of icons

A task row's actions went through three shapes. Six text buttons in the flow
clipped the titles down to `R...`. Six revealed on hover measured ~385px in a
20rem column, so they spilled out of it and over the timer — and touch has no
hover, which meant a second, permanent disclosure for phones and two sets of the
same actions in the DOM. Shrinking them to glyphs fixed the arithmetic and lost
the meaning: six symbols nobody reads the same way twice.

So: one `⋯` menu, on every device, opened by a 44px target that is always
visible. It costs a tap that hovering did not, and buys back the thing every
version before it lacked — room for each action to say what it does, which is
what people kept asking. One branch also means one set of actions announced
once, and no overlay that can cover the control meant to open it.

Two rules the menu itself follows. It is `fixed`, never absolutely positioned in
the row: a list inside a scrolling column gets clipped by the first ancestor with
`overflow`. And it measures the room above and below its trigger, opens toward
whichever has more, and caps its own height to fit — a phone is short, and a menu
running off the bottom of the screen is unreachable. It follows the trigger on
scroll rather than closing, because on a phone the address bar collapsing is a
scroll event, and a menu that shuts as you reach for it is worse than one that
moves.

**Descriptions.** A task always had a `notes` field — in the type, in
`createTask`, in the backup schema — and nothing ever showed it. Editing a task
now edits title, description and estimate together, which is also why the form
gained explicit Save and Cancel: the single rename field committed on blur, and
blur cannot commit three controls when moving between them is the gesture that
would save.

Fields carry `text-base`, not `text-sm`. iOS zooms the whole page in when a
focused input's text is under 16px, and every field in the list used to be 14.

## Two sheets, not one list

Cirillo works with an **activity inventory** — everything you might do — and a **to-do-today sheet**
you compose each morning. A single flat list that only grows is what makes most task features feel
thin: nothing ever leaves it, and it never tells you whether the day is plausible.

So a task carries the local day it is planned for, or `null` while it waits in the inventory. Storing
the day rather than a boolean is what makes carry-over possible: a task still dated yesterday is
visibly unfinished business, and it rolls forward on load. Finished tasks keep their date — that is
the record of when they were done.

Both sheets are on screen whether or not they have anything on them. The backlog
used to appear only once something was in it, which made the half of the model
that gives the other half its meaning impossible to discover — and left "Move to
the backlog" pointing at a place nobody had seen. An empty one says what it is
for instead.

Archiving is the reversible way out, where deleting is not: it keeps the task and
its sessions. That only holds if you can still see what you archived, and for a
while you could not — archived tasks were filtered out of both lists and shown on
no screen at all, present in storage and in the export and nowhere else. They now
sit in a drawer under the lists, and Restore puts one back in the backlog rather
than on the day it was once planned for, which has long since gone by.

The plan then converts itself into the only number that matters: five pomodoros left is a little over
two hours, and that is what tells you whether today fits. Past the daily goal it says so.

A task estimated above seven pomodoros is flagged. That is Cirillo's threshold: beyond it you cannot
picture the stretches of work any more, so the estimate is a guess and the task is really several.

## A terminal is the same timer

The core has no DOM and takes its clock as an argument, which was always about
testability. It buys something else: a CLI is stateless between two invocations,
and so is this timer. Nothing counts down; `{ mode, startedAt, endsAt }` sits on
disk and every command recomputes the rest. `packages/cli` therefore reimplements
nothing — it reconciles with `advance`, ends phases with `finish`, and reads its
counts out of `summarize`, exactly as the store does.

The reconcile loop runs until it settles rather than once, because a single call
closes a single phase and a short break can have come and gone inside the same
absence. It terminates because a phase resumed after an absence starts _now_.

`npx skills add` copies a directory and runs no build, so the skill ships a
committed esbuild bundle — the core exports raw TypeScript and pulls in zod.
`pnpm check:skill` rebuilds it in memory and fails on any difference: a generated
artefact in a repository without that guard eventually stops matching its source.

**The bridge is `export` and `import`, and that is all it can be.** `localStorage`
is not readable from a shell and this project runs no server, so the two halves
exchange the backup format rather than sharing a store. It is a copy, and the
docs say so rather than implying a link.

There is **no alarm**. Without a daemon, a command that is not running cannot
ring — the same limitation the README already states for a closed tab, and the
same answer: `status` catches up instead of warning.

## Not built

- **Sync between devices.** Deliberate: it would need a server, which is the one thing this project
  refuses. Export and import cover moving machines — including between the browser and the CLI.
- **A Chrome Web Store listing.** The extension is loaded unpacked from a release zip; publishing
  needs a paid developer account and a review round.

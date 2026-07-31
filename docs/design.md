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
apps/web/          React interface + browser adapters under src/platform
apps/extension/    Chrome MV3: alarms, notifications, offscreen audio
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

## Two sheets, not one list

Cirillo works with an **activity inventory** — everything you might do — and a **to-do-today sheet**
you compose each morning. A single flat list that only grows is what makes most task features feel
thin: nothing ever leaves it, and it never tells you whether the day is plausible.

So a task carries the local day it is planned for, or `null` while it waits in the inventory. Storing
the day rather than a boolean is what makes carry-over possible: a task still dated yesterday is
visibly unfinished business, and it rolls forward on load. Finished tasks keep their date — that is
the record of when they were done.

The plan then converts itself into the only number that matters: five pomodoros left is a little over
two hours, and that is what tells you whether today fits. Past the daily goal it says so.

A task estimated above seven pomodoros is flagged. That is Cirillo's threshold: beyond it you cannot
picture the stretches of work any more, so the estimate is a guess and the task is really several.

## Not built

- **Sync between devices.** Deliberate: it would need a server, which is the one thing this project
  refuses. Export and import cover moving machines.
- **A Chrome Web Store listing.** The extension is loaded unpacked from a release zip; publishing
  needs a paid developer account and a review round.

# Contributing to basilico

Thanks for taking a look. Issues and pull requests are welcome.

## Getting started

```bash
pnpm install
pnpm dev
```

Before opening a pull request:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

End-to-end tests need a browser:

```bash
pnpm --filter @basilico/web exec playwright install chromium
pnpm --filter @basilico/web e2e
pnpm --filter @basilico/extension build && pnpm --filter @basilico/extension e2e
```

## Where things go

- `packages/core` — all business logic. **No DOM dependency, and never a direct
  read of the clock**: time is always passed in as a parameter. That's what makes the timer testable.
- `apps/web/src/platform` — everything that touches the browser (notifications, audio, storage,
  wake lock). Isolated here so the rest of the app stays testable under jsdom.
- `apps/web/src/features` — one folder per screen.
- `apps/extension` — the Chrome MV3 extension.

## Two rules that aren't up for negotiation

1. **Remaining time is computed, never decremented.** Any logic doing `remaining -= 1000` will drift
   by minutes as soon as the tab goes to the background. We store an absolute deadline and compare it
   to `Date.now()`.
2. **The session log is never rewritten.** Statistics are recomputed from it; a recorded session
   doesn't change, apart from its annotation (note, rating, tag).

## TypeScript 7

The project runs on TypeScript 7. That's possible because we lint with **oxlint**: the one thing
genuinely holding the ecosystem back on TS 7 is `typescript-eslint`, which still requires a
programmatic API TS 7 doesn't expose. If you reintroduce typescript-eslint, TypeScript has to go
back to `~6.0.x`.

## Before proposing a large feature

Open an issue first — it saves writing code for nothing if the direction doesn't fit.

## Style

Prettier and oxlint handle it (`pnpm format`). Comments explain **why**, not what: the code already
says what it does. Everything in this repository — code, comments, tests, docs, commit messages — is
written in English.

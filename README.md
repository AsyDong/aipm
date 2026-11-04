# English Adventure

An English-only listening adventure for beginners. The long-term learning goal is 500 listening words; this is not a claim that the current preview teaches or assesses those words.

Phase 0 provides a React host, Phaser canvas and lifecycle-safe bridge. It does not implement a learning game yet.

## Run

Use Node 22 and pnpm 10.27.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Verify

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

## Structure

```text
apps/web             React application (Vite)
apps/admin           Reserved documentation only
packages/game-contracts   Shared transport types
packages/game-runtime     Phaser adapter and bridge
packages/game-core        Phase 1 skeleton
packages/game-scenes      Phase 2 skeleton
packages/game-mechanics   Phase 3 skeleton
packages/learning-core    Content model skeleton
packages/speech-core      Future speech adapter skeleton
tests/e2e                 Chromium and iPad WebKit checks
docs                      Architecture, decisions and phase reports
```

See docs/DEVELOPMENT_TASKS.md for milestone scope and docs/PHASE_0_REPORT.md for verification and limitations.

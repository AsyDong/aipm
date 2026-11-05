# English Adventure

An English-only listening adventure for beginners. The long-term learning goal is 500 listening words; this is not a claim that the current preview teaches or assesses those words.

Phase 3 delivers Listen & Find: five listening rounds, randomized picture choices, replay, hints, friendly retries, pause/resume, stars and a session summary. The default collection is Power Up 0, Unit 3, printed page 28: apple, banana, grapes, orange and watermelon. An explicitly independent woodland sampler demonstrates content and scene reuse.

## Run

Use Node 22 and pnpm 10.27.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Publish over HTTPS

`pnpm build` writes a static site to `apps/web/dist`; serve it from any static host over HTTPS. Browsers expose secure-context APIs (`crypto.randomUUID`, and later the microphone for Voice Match) only on HTTPS or localhost. Plain-HTTP LAN pages are not secure contexts; the game now runs there too, but the microphone will not.

- Serve `index.html` with `Cache-Control: no-cache`; the hashed files under `assets/` can be cached for a year (Phaser is its own chunk, so app upgrades do not re-download it).
- Same-origin only: images and audio load from `/images` and `/audio` on the same host.
- To test on a real iPad before publishing, use an HTTPS tunnel or a local certificate (for example mkcert) rather than a bare LAN IP.

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
packages/game-core        Engine, events, registration, rules and rewards
packages/game-scenes      Fruit World orchard/woodland visual plugin
packages/game-mechanics   Content-independent Tap plugin
packages/learning-core    Content ownership validation and task generation
packages/speech-core      Future speech adapter skeleton
tests/e2e                 Chromium and iPad WebKit checks
docs                      Architecture, decisions and phase reports
```

See [Phase 3 report](docs/PHASE_3_REPORT.md) for verification, limitations and the child playtest checklist. Automated iPad WebKit checks do not replace physical iPad Safari testing. Session observations stay in memory and do not establish vocabulary mastery. ASR, pronunciation scoring, backend persistence and additional mechanics are outside this milestone.

Word prompts are generated with Microsoft Edge TTS (`en-GB-SoniaNeural`, rate `-10%`) and served locally. Normal gameplay needs no speech-service credentials or live synthesis. To regenerate missing MP3s, install `edge-tts` in a Python environment and run `python scripts/generate-prompts.py`. Textbook files and original recordings remain external.

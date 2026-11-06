# English Adventure

An English-only listening adventure for beginners. The long-term learning goal is 500 listening words; this is not a claim that the current preview teaches or assesses those words.

Phase 3.2 turns it into a small game world: a Fruit Island map with one level per unit, a monkey guide who talks in short English lines, a market scene where fruit drops onto a counter, and stars kept on the map (this device only). Listen & Find is the first level type: five listening rounds, randomized picture choices, replay, hints, friendly retries, pause/resume, stars and a session summary. The default collection is Power Up 0, Unit 3, printed page 28: apple, banana, grapes, orange and watermelon. An explicitly independent woodland sampler demonstrates content and scene reuse.

Phase 4 adds Listen & Say in Talking Market: listen, tap Record, say the word and tap Done (capture stops automatically after five seconds). Run the included local Volcengine ASR backend; it uses the external volcengine-media skill's credentials and has passed real-provider checks with synthetic audio. Existing Listen & Find levels need no backend. See [speech integration](docs/SPEECH_PROVIDER.md) for backend setup and [Phase 4 report](docs/PHASE_4_REPORT.md) for physical-device acceptance limits.

## Run

Phase 5 adds Listen & Slice at the Waterfall map pin, reusing the market scene and Unit 3 content. Listen, then swipe across a fruit using a mouse drag or touch. One gesture cuts its first available fruit; cut fruits cannot count twice in the same task. Find the correct fruit and choose Next. See [Phase 5 report](docs/PHASE_5_REPORT.md) for verification and device limits.

Use Node 22 and pnpm 10.27.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Phase 6 adds separate learning notes and offline resubmission. Start the local learning backend in another terminal with Python 3.11+: `python scripts/learning_server.py`. No extra Python packages are needed. SQLite defaults to `~/.english-adventure/learning.sqlite3`, outside Git; `--database` and `--port` override it. Vite proxies `/api/v1/` to loopback port 8788. Static hosting needs the same-origin API route configured separately. Open “Learning notes for grown-ups” on the map for sync status and content observations.

One anonymous device profile represents the learner; shared-device users share these observations. Completed sessions and sessions left through the map are saved. Browser storage holds at most 200 unsent sessions, with 20 sent per batch, an eight-second request timeout, and automatic retries from 15 seconds up to five minutes plus retry on reconnect/reload. Clearing site data removes unsent notes and the local profile; browser storage denial/full conditions are reported. Abrupt browser termination during an active session can lose that unfinished session. The backend is for local use only; authenticated multiuser access is not implemented. No audio, transcripts or swipe paths are saved. Review flags indicate unfinished/hinted/retried tasks, never mastery.

## Publish over HTTPS

`pnpm build` writes a static site to `apps/web/dist`; serve it over HTTPS, with the speech API routed separately if Voice Match is used. Browsers expose secure-context APIs (`crypto.randomUUID` and the microphone for Voice Match) only on HTTPS or localhost. Plain-HTTP LAN pages support Tap, but the microphone will not work.

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
packages/game-mechanics   Content-independent Tap, Voice Match and Slice plugins
packages/learning-core    Content ownership validation and task generation
packages/speech-core      In-memory recording, bounded speech service and HTTP ASR adapter
tests/e2e                 Chromium and iPad WebKit checks
docs                      Architecture, decisions and phase reports
```

See [Phase 3 report](docs/PHASE_3_REPORT.md) for the initial listening-game verification and child playtest checklist, [Phase 4 report](docs/PHASE_4_REPORT.md) for speech checkpoints, [Phase 5 report](docs/PHASE_5_REPORT.md) for Slice and [Phase 6 report](docs/PHASE_6_REPORT.md) for learning persistence. Automated iPad WebKit checks do not replace physical iPad Safari testing. Observations do not establish vocabulary mastery. Public authenticated deployment, pronunciation scoring and Phase 7 remain outside this delivery.

The monkey guide speaks existing guide lines (child British voice via Edge TTS, files in `apps/web/public/audio/guide`); new microphone status lines currently use English text. Hold phones and small tablets sideways; upright they show a notice. Artwork (island map, market and forest backdrops, fruit, monkey) was generated with Seedream (Volcengine) for this project; see `scripts/process-art.py` for how raw output becomes game assets. Third-party design references stay local and are not committed. Word prompts are generated with Microsoft Edge TTS (`en-GB-SoniaNeural`, rate `-10%`) and served locally. Listen & Find needs no speech-service credentials or live synthesis. To regenerate missing MP3s, install `edge-tts` in a Python environment and run `python scripts/generate-prompts.py`. Textbook files and original recordings remain external.

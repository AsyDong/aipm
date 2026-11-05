# Phase 3.1: review remediation

Acceptance review of Phases 0-3 found one release blocker and several design gaps. This upgrade addresses the ones that affect Phase 4/5 and publishing. Nothing from Phase 4+ (speech, Slice) was built.

## Fixed

- **Blocker:** `crypto.randomUUID` is missing on plain-HTTP LAN pages, so the game failed to start there ("We couldn't load this adventure"). A shared `uuid()` with a getRandomValues fallback replaces three direct calls. Reproduced on http://10.200.10.10 before the fix and re-checked after: the game starts and plays. Covered by unit tests and an E2E test that removes `randomUUID`.
- **Round loop moved out of the runtime closure.** New `TaskRunner` in game-core owns present/submit/hint/next/finish and the session summary; `adventure.ts` no longer tracks attempts, hints or indexes. RuleEngine gained `canHint()`, so hints come from the rules, not runtime variables.
- **Scene no longer sees the answer.** `ISceneObjects.show` takes neutral `SceneItem[]`; the Tap mechanic builds them from `ITaskView` on TASK_PRESENTED. Runtime no longer holds a `TapMechanic` instance or calls its methods, but it still imports and registers `TapMechanic` and `FruitWorldScene` directly in `adventure.ts` (hard-wired composition, see Still open).
- **Input model settled before Slice.** `InputEvent` is `TAP | SWIPE`; `IInputAdapter` plus Touch/Mouse pointer adapters are the only code that reads Phaser pointers; `InputManager.registerAdapter` owns their lifecycle and validates SWIPE trajectories.
- **Config-driven.** Levels and vocabulary live in `apps/web/src/data/*.json`; content is validated by `parseContents`. Tap's config schema is a JSON file. Scene metadata is separate from Phaser code.
- **Deterministic task ids** instead of random UUIDs.
- **Child experience.** Plainer English copy for beginners, a pulsing Next button after a correct answer, and the existing success/again/complete cue audio now plays (optional; a failed cue never blocks play).
- **Publishing.** Phaser is a separate hashed chunk (build no longer warns); HTTPS notes added to the README.
- **Tests.** Architecture test now scans recursively and also checks core/learning vs engine layers, mechanic isolation, web-to-Phaser access and vocabulary hard-coding in mechanics/scenes. Added a stub second mechanic ("Reaction") that registers, validates, runs and cleans up using only public APIs, i.e. a regression check for "a new mechanic needs no Core change".

## Verification (2026-11-05)

pnpm typecheck, pnpm lint, pnpm format:check, pnpm test (31 tests in 13 files), pnpm build, pnpm test:e2e (12 passed: desktop Chromium and iPad WebKit emulation). Real-LAN check over plain HTTP in Chromium: game started and reached the first round with no page errors.

iPhone audio follow-up: on a physical iPhone the prompt stayed on "Listen closely…" with no sound. AudioManager now sets `navigator.audioSession.type = 'playback'` (so the ringer switch does not mute Web Audio) and times out Web Audio playback that never ends, so Listen can be retried. The user then confirmed normal operation on the iPhone over LAN HTTP (one device; the iOS version and browser were not recorded). iPad Safari and child playtesting remain unverified.

## Still open (not done on purpose)

- Real iPad Safari and child playtesting are unverified; automated WebKit is emulation.
- PluginManager still has one `create`; IScenePlugin and IMechanicPlugin share one interface (no validateConfig/getAssetManifest per plugin). Revisit when the second real mechanic arrives.
- SceneManager is still unused at runtime; AssetManager has no spritesheet type; Fruit World has no character; AudioManager has no queue, music channel or TTS fallback.
- Runtime composition is hard-wired: `adventure.ts` imports Tap and Fruit World directly. A second playable mechanic needs a small plugin catalog (id to registration) in the host instead.
- GameError is defined but not yet used; GAME_ERROR is never emitted.
- No keyboard/screen-reader path to the canvas choices.
- Microphone work (Phase 4) needs HTTPS for any real-device test.

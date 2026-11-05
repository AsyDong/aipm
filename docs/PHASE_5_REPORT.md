# Phase 5: Slice

Authorized after Phase 4.5. Complete Phase 5 and stop before Phase 6. The task book has one checklist, so delivery uses three verified commits: 5.1 input/configuration, 5.2 mechanic/rendering/audio, 5.3 playable level and regression.

## Assessment and data flow

Reuse Fruit World, existing content/assets, InputManager, EventBus, IAnswerPort, TaskRunner, RuleEngine and rewards. No Game Core source changes, new curriculum, moving targets or new image assets are needed.

Phaser device adapter → bounded completed SWIPE in world coordinates → InputManager → Slice mechanic intersects each path segment with current candidate bounds → first uncut hit → object facade animates cutting and IAnswerPort submits the content ID → existing runtime judges/rewards → bridge publishes state. Task-local cut IDs prevent duplicates; pause/prompt/input transitions discard in-progress gestures. Wrong cuts remain unavailable for that task; the correct fruit remains available. Each swipe answers at most once, and Next remains deliberate.

## 5.1 Input and configuration

Added public SliceConfig and JSON schema for a 12–100 world-unit minimum swipe distance (default defined by the mechanic in 5.2). Phaser pointer adapters support optional SWIPE mode while preserving TAP defaults. One pointer owns each trajectory. The adapter samples movement at four world units, caps paths at 128 points and discards overlong/outside gestures rather than creating synthetic shortcuts across the scene. InputManager resets gestures on enable/disable so gestures begun during a prompt or pause cannot answer later.

Verification: targeted input/adapter tests (6/6), typecheck, lint, build and diff checks passed. Initial checks identified a listener referenced before declaration; moved the declaration before registration and reran successfully. No new mechanic is exposed yet; existing TAP mode remains the default.

## 5.2 Slice mechanic and object rendering

Added SliceMechanic and SliceValidator (validateSliceConfig + registry JSON schema). Pure segment/slab collision checks include boundary crossings and select the earliest hit along the trajectory, independent of candidate order. Complexity is O(points × candidates), bounded at 128 points and six objects. Task-local IDs are marked before events to prevent reentrant/double cuts. Locked, paused and short gestures count nothing; each accepted swipe reports one object through existing EventBus/IAnswerPort.

The optional object slice operation preserves old context mocks and Tap/Voice contracts. Runtime crops the current texture into two halves and animates them apart; no fruit-specific assets or curriculum logic enters the scene. Fruit World declares the SLICE capability; its implementation remains unchanged. A generated 160ms synthetic swoosh is declared through the plugin asset manifest (no external service or original recording). Playback sequencing and playable catalog wiring follow in 5.3.

Verification: all 71 unit tests (22 files), typecheck, lint, build and diff checks passed. Pure geometry tests cover crossed segments with no sampled point inside, edges, vertical/zero-length segments, candidate order and reversed direction. Mechanic tests cover minimum distance, locked/paused input, one answer per gesture, per-object duplicate suppression, retry and task reset. Registry validation accepts Slice on the unchanged FruitWorld plugin and rejects invalid configuration. Visual/audio acceptance follows the playable checkpoint.

## 5.3 Playable level

Waterfall is now the Listen & Slice map entry, reusing the market FruitWorld scene and existing Unit 3 vocabulary. Lighthouse remains locked. Runtime selects SWIPE adapters only for Slice; Tap and Voice retain existing input behavior. Slice sound is preloaded through the catalog/AssetManager and played through AudioManager before guide feedback; pause, replay, Next and restart invalidate pending audio chains. Child-facing instructions use English and accessible descriptions identify swiping.

Verification: `pnpm test` (71 tests in 22 files), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `git diff --check` and `pnpm test:e2e` (26/26, desktop Chromium and iPad WebKit, 2.7 minutes) passed. After the full checks only documentation changed; changed documentation passed formatting/diff checks. Initial WebKit tests found that its Touch constructor is unavailable; test input now dispatches touch-shaped DOM events through the real Phaser touch adapter. This is simulated input. Desktop mouse paths use Playwright mouse drag. No application workaround for the test environment was added.

Inspected the 1280x720 animation screenshot midway through the split: the existing fruit texture separates into two halves and reward/Next controls remain visible. The initial screenshot was captured before the next Phaser frame; the test now waits 180ms solely to capture the middle of the 600ms visual effect. BrowserSkill status still reports CLI protocol 1.8 versus extension 1.3 (the previous cooperation failure remains), so no interactive BrowserSkill acceptance is claimed.

## Delivery and compatibility

Three sequential checkpoints are committed on `game`: 5.1 `27ba3eb`, 5.2 `ef64503`, and the final 5.3 integration commit. GitHub push uses the user-authorized per-command `http://127.0.0.1:7890` proxy; no global Git proxy setting changed. The user's original `.gitignore` change remains uncommitted and preserved.

Existing Tap and Voice Match levels retain their control/input behavior. New adapter reset and object slice operations are optional on public interfaces; all callers/mocks pass typecheck. No source changes were made to Game Core or FruitWorld's scene implementation, and the original Chinese design documents remain untouched. Waterfall changes from a locked placeholder into a Slice level; it reuses the current market backdrop and existing Unit 3 vocabulary rather than adding a new visual world. The same FruitWorld registration validates both Tap and Slice.

Known limits: collision uses rectangular object bounds (including transparent image padding); long gestures over 128 samples are discarded; one release can cut only one fruit and wrong-cut fruit remains unavailable until the next task. No original recordings, credentials, new dependencies or AI image-generation calls were added. The synthetic slice MP3 can be regenerated with `python scripts/generate-slice-sound.py` (FFmpeg required for generation only). New Slice instructions are English text; existing guide lines and word prompts remain spoken. Physical iPad Safari swipe behavior, child playtesting, learning outcomes and device performance remain unverified. Phase 6 was not started.

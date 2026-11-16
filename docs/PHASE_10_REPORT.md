# Phase 10 report — Unit 3 six-stop play layer and Count & Pack

Date: 2026-11-11

## Scope

The user compared the Unit 3 design with the playable sample and identified the gap: the stops were mostly the same Listen & Find template with different word pools, and Counting Boxes only recognized quantity pictures. This phase implements the six-stop situation layer and the new counting/packing interaction without changing the two protected Chinese design documents.

## What was built

1. **Fruit Market — basket.** Five listening rounds put the solved fruit into a visible basket. The stop has its own spoken basket welcome.
2. **Fruit Stall — meet, then stock.** The READY view introduces all five fruits with tappable pictures and word audio. Five sequential rounds then fill a two-level shelf.
3. **Grocery Shop — picture checklist.** Rice, beans, egg, burger and carrot stay visible as a shopping list. Each found item gains a tick and flies into the basket. This remains recognition practice; no simultaneous quantity question was added.
4. **Counting Boxes — Count & Pack.** A locally registered `count-pack` mechanic provides two count-the-group rounds with numeral cards, followed by four packing rounds for 3 apples, 2 oranges, 4 burgers and 5 eggs. Packing a food moves one small copy into the crate without submitting an answer; tapping the crate submits the packed quantity. A wrong quantity empties the crate and restores the food for another try. Each new packing round starts with a fresh crate. A pool-only six-apples content item lets even a full six-item crate be judged instead of silently doing nothing.
5. **Fruit Kitchen — slice onto a plate.** The existing slice mechanic is retained. Correctly sliced fruit also collects onto a gradually filled plate.
6. **Picnic Time — serve the friends.** Cameron, Jim and Jenny take turns requesting food across six rounds. Their two deliveries per friend have separate visible landing positions; the existing final picnic result remains.

The guide moved from the lower-left play area to the upper-left backdrop after screenshot review showed that it covered the basket, plate and first numeral card. The active counting prompt is now the short, mode-independent “How many?”, while READY explains both interactions in English.

## Contracts and boundaries

- `LearningContent` gained validated optional `quantity` (integer 1–12) and `illustration` fields. The mechanic derives quantity answers from content data; it does not parse curriculum IDs or word text.
- `SceneItem` supports LARGE question pictures and SMALL packable objects. `ISceneObjects` gained optional `collect` and `clearCollected` visual capabilities.
- Collection minis survive ordinary round changes for baskets, shelves, plates and friends. Count & Pack explicitly clears the crate between packing rounds and after a miss.
- Fruit World learns about solved answers through events. It does not import mechanics. React continues to use the bridge and never handles Phaser objects.
- Count & Pack is registered in the existing local plugin catalog and Composer metadata; no remote code, sandbox, DI container or dependency was added.
- Runtime and Composer preload illustrations. Runtime deduplicates shared image keys after browser testing caught a counted picture being both an answer asset and an illustration.
- Numeral prompts use “How many?” audio. Count & Pack does not replay that question as though it were the spoken answer after a correct choice.

## Generated assets

- `scripts/make-scene-props.py`: transparent basket, shelf, plate and crate WebP props.
- `scripts/make-count-cards.py`: numeral 2–6 cards with large digits and counting pips.
- `scripts/generate-prompts.py`: the shared “How many?” prompt, the basket welcome, the revised counting-station welcome and six-apples audio. Edge TTS generation used the configured local proxy.
- No external textbook collection, credentials or original speech recordings were added.

## Verification (actual results)

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — **29 files, 89 tests passed**. New coverage includes Count & Pack configuration, inert question art, numeral submission, packing and duplicate-tap prevention, box submission, retry/reset, fresh boxes, unsupported quantities, the six-item cap and required illustrations; content validation and new task/reward expectations are also covered.
- `pnpm build` — passed.
- `pnpm format:check` — passed. The exact filenames of the two protected Chinese documents were added to `.prettierignore`; their contents were not formatted or modified.
- `git diff --check` — passed.
- `pnpm test:e2e` — **42/42 passed** across desktop Chromium and automated iPad WebKit, including the six-round Count & Pack flow, touch input, restart, final picnic, map persistence, lifecycle, audio, slicing and voice failure paths. Three stale adventure tests were updated to open Market Street before looking for its pins; an obsolete assertion for the now-filtered Lighthouse placeholder was removed.
- A separate real-input Playwright walkthrough completed **all six Market Street stops end to end**: 5 basket rounds, 5 stall rounds, 5 grocery rounds, 6 counting/packing rounds, 5 slicing rounds and 6 picnic rounds. Nine desktop screenshots were inspected, including READY fruit introductions and final filled states. No page errors, console errors or failed asset responses were reported. Screenshot review caught and led to fixes for guide occlusion, stale crate contents and overlapping/clipped picnic deliveries.

## Follow-up — sequential maps and collection motion (2026-11-12)

- Original courseware portraits of Jim, Jenny and Cameron (Hello Lesson 1, mirror-character slides) appear consistently in activities and results. Only these three selected portraits were derived from the external courseware, not the textbook collection. Their white source backgrounds are retained; the other artwork was revised again in the 2026-11-13 follow-up below.
- Playable stops unlock in order after the previous stop earns at least one raw star. Completing Welcome Harbour opens Market Street; empty future units do not break that sequence. Existing stars are preserved.
- Selecting a stop hides the pins and walks the monkey along configured road waypoints before showing READY. Continue Adventure uses the same transition, replay can retrace a route, and reduced-motion users enter immediately.
- Collected food now starts at its displayed size, shrinks along a lift/drop arc, rotates, squashes and bounces. A cropped copy of the existing basket texture occludes settled food behind its rim and front wall; no new asset or dependency was added.

### Follow-up verification

- The independent real-Chrome walkthrough completed the U0 unlock chain and all six Market Street stops with real input and no seeded progress. It reported no console errors or failed network requests; its reduced-motion and visibility overrides were test-environment adaptations, not product changes.
- Focused Playwright regression for sequential unlocking/walking, Counting Boxes completion followed by Play again, and dynamic portrait/landscape changes passed **6/6** across desktop Chromium and automated iPad WebKit. A separate settled five-item packing frame was inspected and showed distinct box slots.
- Full regression after the follow-up: `pnpm typecheck`, `pnpm lint`, `pnpm test` (**29 files, 89 tests**), `pnpm build`, `pnpm format:check`, `git diff --check` and `pnpm test:e2e` (**44/44**) passed.
- Physical iPad Safari, real touch/audio and hands-on pacing remain unverified. The temporary browser reports, PNG evidence and old `dist` backup were removed after their conclusions were incorporated here.

## Follow-up — transparent vocabulary art and coherent town scenes (2026-11-13)

- Jim, Jenny and Cameron retain their existing white-backed courseware portraits. The mascot, fruit, food and vehicle artwork is transparent again. All **41 vocabulary and count-card WebP files** are at most **10,000 bytes**; `scripts/art_quality.py` keeps the highest quality and dimensions that fit that limit. Count-card interiors remain opaque beige, with transparency only outside their rounded corners.
- Decorative courseware-person overlays and their map data were removed. Instead, **20 small residents** were painted into the world map itself. Characters required by answer and picnic interactions remain in those activities.
- The walking monkey now has separate body, left-leg and right-leg layers. The legs rotate in opposite phases around their hips and lift during the step instead of merely bobbing the whole mascot. The original mascot remains the idle image, and reduced-motion behavior is preserved.
- All Aboard no longer displays its upper-right collection answer hint. Its map pin and activity title are unchanged.
- Harbour, Market and Forest are 1280×720 close-ups cropped from the same illustrated town maps, so their buildings, terrain and rendering style are continuous with the map rather than approximated with a filter.
- Responsive follow-up: the world map now considers dynamic viewport height as well as width, including the compact landscape layout. READY, pause, error and loading overlays can scroll vertically with safe centering, and the fruit-introduction strip wraps instead of overflowing horizontally. Desktop checks at 1366×768 and 668×375 fit the whole world page; at 568×320 the intentionally scrollable READY panel exposes its own scrollbar and the start button remains reachable.
- Vehicle choices keep their transparent WebP sources but now sit on opaque white rounded cards. Because the choices are painted into Phaser's canvas rather than rendered as DOM images, the backing is drawn by the front-end scene; a CSS `img` background could not affect them. Other vocabulary artwork is unchanged.

### Artwork follow-up verification

- Asset assertions confirmed all 41 vocabulary/count images fit the byte limit and contain transparency; the three selected portraits are unchanged RGB images. `pnpm typecheck`, `pnpm lint`, `pnpm test` (**29 files, 89 tests**), `pnpm build`, `pnpm format:check`, `git diff --check` and `pnpm test:e2e` (**48/48** across desktop Chromium and automated iPad WebKit) passed.
- Desktop Chromium walkthroughs inspected the populated world map, a paused walking frame, All Aboard, Fruit Market and Woodland Walk. The transparent choices and new scene crops rendered correctly; All Aboard had no collection element. The browser reported no console errors or failed relevant image requests. Focused e2e assertions now cover the absence of map-person overlays, independent leg animations, the removed All Aboard hint, responsive map fitting and scrollable small-screen READY actions.
- Vehicle-card follow-up: an actual All Aboard walkthrough showed the red bus on its white card, with successful vehicle image responses and no console errors. The focused All Aboard browser test now reaches the sequential bus round, reads the transparent area above the bus as opaque white, and taps the choice successfully; it passed **2/2** across desktop Chromium and automated iPad WebKit. `pnpm typecheck`, `pnpm lint`, `pnpm test` (**29 files, 89 tests**) and `pnpm build` also passed after the renderer change.

## Follow-up — Monkey's Fruit Catch playable vertical slice (2026-11-16)

- Fruit Market is no longer a stationary Listen & Find board. The locally registered `catch-world` scene and `fruit-catch` mechanic move the monkey with drag/touch positioning, Arrow/A/D keys and on-screen hold buttons. Fruit falls and rotates continuously, landing in the basket submits the answer, a wrong fruit bounces out for a retry, correct catches build a streak, and each of the five rounds falls faster.
- Fruit starts visible at the beginning of a round, different candidates are interleaved, and no opening target lane aligns with the stationary basket. Screenshot review moved the basket beside the monkey's face and shortened the active guidance so the 668×375 layout does not clip it. Hints circle and slow a target; replay, pause/resume, restart, learning collection, rewards and sequential map unlocks continue through the existing runtime.
- Public contracts add `KEYBOARD`, world-coordinate `MOVE`/`STEER` events and optional catch rendering capabilities. Collision callbacks return whether the answer boundary accepted the drop, preventing replay or locked input from consuming fruit. The scene does not import the mechanic, the mechanic contains no vocabulary, and Core/learning-core remain independent of Phaser and React. The scene and mechanic IDs are deliberately different so local plugin registration cannot collide.

### Fruit Catch verification

- Real browser input completed correct and wrong catches with touch/pointer positioning, keyboard steering and held on-screen controls. Five-round completion, increasing speed, replay, hint, pause with unchanged Canvas pixels, resumed motion, Play again and the next-stop unlock were exercised in desktop Chromium and automated iPad WebKit. Desktop and small-landscape screenshots were inspected; the visible monkey/basket alignment, falling fruit, hint ring and complete compact guidance were checked.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (**30 files, 91 tests**), `pnpm build` and `git diff --check` passed.
- The full Playwright run passed **48/52**; the four failures were stale assertions waiting for the former “Which one is it?” text. After changing only those assertions to the actual Fruit Catch guidance, all four passed on both browser projects. Thus all **52 browser tests pass against the final product code** (48 in the full run plus the 4/4 focused rerun). Generic stationary-card adventure tests now explicitly open Fruit Stall rather than implicitly depending on Fruit Market's old mechanic.
- This validates one vertical slice, not every proposed game type. Physical iPad Safari, real-device audio/touch latency and hands-on child pacing remain unverified; no driving, delivery or platformer expansion is claimed.

## Follow-up — opaque food art and no active-play records (2026-11-16)

- Rice and egg are rebuilt as fully opaque RGB vocabulary cards with contrasting blue interiors and warm borders. `rice.webp` is **288×288, 7,458 bytes** and `egg.webp` is **320×320, 8,324 bytes**; both retain the 10,000-byte ceiling. Browser screenshot review confirmed that both remain recognizable on the market canvas.
- `scripts/process-art.py` now bakes newly generated fruit, food and vehicle vocabulary onto opaque cards through `scripts/art_quality.py`; future vocabulary generation no longer emits transparent WebP files. Animated mascot layers and transparent scene props are not vocabulary cards and are unchanged.
- The upper-right collection/checklist overlay is removed from **every activity during play**, not just All Aboard or Grocery Shop. In-world baskets, shelves, plates and packing boxes still show progress as game objects, and completion results still show the collected items. The obsolete Grocery `checklist` metadata, React branch and CSS were removed.

### Opaque art and record-removal verification

- Pillow assertions confirmed that both final food files are RGB and below 10,000 bytes. The new browser test decodes both assets and verifies that every pixel has alpha 255, completes all five Grocery Shop rounds, checks that no active shopping record exists, and verifies the five-item completion result. Shared story test setup also checks for the absence of the active record on every story activity it enters.
- Desktop Chromium and automated iPad WebKit Grocery Shop screenshots were inspected: rice and egg are clearly visible, and the upper-right checklist is absent. The broader removal keeps the same completion results for Harbour Friends, Grocery Shop, Counting Boxes and Picnic Time.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (**30 files, 91 tests**), `pnpm build`, `pnpm format:check` and `git diff --check` passed after the broader removal.
- The final full `pnpm test:e2e` run passed **54/54** in 6.2 minutes: 27 desktop Chromium tests and 27 automated iPad WebKit tests, including Fruit Catch, all affected story flows, completion results, counting/packing, slicing and voice. Physical iPad Safari remains unverified.

## Follow-up — Game arcade, auto-advance and audio-hang fix (2026-11-16)

- The world map now has a **Game arcade**: the child picks only how to play, and the next unlocked story stop's words, audio, distractors, rules and rewards load automatically (`arcadeDefinition()` swaps scene, mechanic and input only; Count & Pack stays on its own mechanic). See [GAMEPLAY_CATALOG.md](GAMEPLAY_CATALOG.md) for the referenced open-source-games survey and the ten playable modes.
- Ten locally registered modes share one `arcade` mechanic and one `arcade-world` scene: Picture Pairs, Little Chef, Word Racers, Maze Explorer, Sky Jumper, Bubble Pop, Word Golf, Little Builders, Garden Guardians and Power Quest. Each mode's motion reports through `IAnswerPort.submit()`; RuleEngine/TaskRunner still judge correctness, and no mode embeds curriculum words. Modes cap on-screen candidates and reuse the pause/restart/hint/reward flows.
- Every activity now **auto-advances after a correct answer**: praise and the target word play, then the next round starts without a Next button; the final round settles into the summary automatically. Pause, restart, leaving or a new answer cancels the pending advance. E2e assertions that clicked the removed Next button were updated.
- Audio-hang fix found by the WebKit voice test: `AudioManager.playLoaded` awaited `AudioContext.resume()` and `decodeAudioData` with no timeout, so a suspended/interrupted context could wedge the round on "Listen…". Both waits are now bounded (4 s unlock, 10 s fetch+decode); timeouts fail into the existing AUDIO_ERROR state where tapping Listen retries, and a failed decode reloads the asset. Desktop Chromium and WebKit voice suites pass after the fix. The Playwright per-test budget moved from 60 s to 90 s because praise plus the repeated target word now precede every auto-advanced round.

### Arcade verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (**32 files, 96 tests**), `pnpm build`, `pnpm format:check` and `git diff --check` passed.
- Focused arcade suite passed **22/22** (ten games plus picker navigation, desktop Chromium and automated iPad WebKit): each test opens the arcade, plays the mode with real pointer/touch/keyboard input, hears the praise line and earns a star; page errors and console errors are asserted empty.
- Full `pnpm test:e2e` result: **78/78 passed in 10.7 minutes** — 39 desktop Chromium tests and 39 automated iPad WebKit tests, covering all ten arcade modes with real input, the picker navigation, every auto-advanced story flow and the audio-retry path.
- Physical iPad Safari, real-device audio latency and child pacing remain unverified.

## Limits and compatibility notes

- Automated WebKit is not physical iPad Safari acceptance. Real-device touch latency, audio volume and child pacing still need hands-on review.
- The current shared market backdrop is retained behind the new props; bespoke kitchen and picnic-lawn close-up backgrounds remain art work, not part of this mechanics checkpoint.
- Existing local Counting Boxes scores are preserved rather than silently deleted. Because the activity changed from four to six rounds, an old raw score may normalize to fewer stars until the child replays the new activity.
- The 500-listening-word goal is unchanged; this phase neither adds that content quota nor claims mastery.

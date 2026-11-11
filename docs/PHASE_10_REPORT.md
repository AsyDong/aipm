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

## Limits and compatibility notes

- Automated WebKit is not physical iPad Safari acceptance. Real-device touch latency, audio volume and child pacing still need hands-on review.
- The current shared market backdrop is retained behind the new props; bespoke kitchen and picnic-lawn close-up backgrounds remain art work, not part of this mechanics checkpoint.
- Existing local Counting Boxes scores are preserved rather than silently deleted. Because the activity changed from four to six rounds, an old raw score may normalize to fewer stars until the child replays the new activity.
- The 500-listening-word goal is unchanged; this phase neither adds that content quota nor claims mastery.

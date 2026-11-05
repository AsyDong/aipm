# Phase 3.2: game world, Phase 4 prerequisites

Requested after a first playtest: the interface looked like a study tool, not a game, for a 7-year-old. Direction from the design references (not committed): one unit per level, entered from a map, learned inside a story scene.

## Experience

- **World map** (Fruit Island): pins for Fruit Market and Woodland (playable) and two locked placeholders; stars per level are remembered on this device only. Pins and levels are data in `apps/web/src/data/world.json`.
- **Monkey guide** speaks short English lines for every state (hello, listening, right, not that one, hint, break, finished) instead of a status bar. After a right answer it says the word, giving a second chance to hear it.
- **Level scene**: a market backdrop with a wooden counter; fruit drops onto the counter and bobs; right answer gives a bounce and a burst of stars; wrong answer is a small wobble (no red, no penalty); hint puts a gold plate under the right fruit. A forest backdrop reuses the same scene plugin.
- **Look and controls**: rounded font (Fredoka, 20 KB per weight, bundled), chunky 3D buttons, 56 px touch targets, a pulsing Next button after a right answer, 1-3 stars on the result screen.
- **Art**: Seedream images (map, two backdrops, six fruit, mascot), cut out and compressed to webp by `scripts/process-art.py`. The raw prompts were English; no text is baked into the images.

## Phase 4 prerequisites (from the Phase 3.1 review)

1. **Plugin catalog**: the runtime picks scene and mechanic by id from `plugin-catalog.ts` and validates the whole definition before starting; each plugin can declare its own assets (the scene loads its backdrop). Adding Voice Match or Slice is one catalog entry.
2. **One answer entry point**: `IAnswerPort` (isOpen / submit / unrecognized). Tap uses it; the runtime no longer listens for OBJECT_SELECTED.
3. **"Not heard" is not "wrong"**: `VOICE_FAILED` counts no attempt and unlocks no hint; an answer outside the candidates (a spoken word) is wrong instead of throwing.
4. **Audio session switch**: `IAudioManager.setSession('playback' | 'play-and-record')`.
5. **Typed errors**: `GameFailure` (code, module, recoverable) is used for invalid definitions and carried to the UI as an error code.
6. Cleanup: removed the Phase 0 bootstrap canvas and the unused SVG fruit; one shared world size (1280x720).

## Monkey voice and landscape play

- **Spoken guide**: every line in `apps/web/src/data/guide.json` is spoken by a child British voice (Edge TTS en-GB-MaisieNeural) from `apps/web/public/audio/guide/`; the on-screen text and the audio share the one data file, and `scripts/generate-prompts.py` regenerates missing files. After a right answer he says "Yes! It is" and then the word itself, so the child hears the whole sentence. A line that cannot play is skipped silently (the text still shows). Lines are English only.
- **Landscape**: phones and small tablets held upright show a "Turn your phone sideways" notice and a playing game pauses; sideways, the page uses the full height (no header, compact controls). On Android Chrome the game asks for fullscreen and a landscape lock when a level is opened (best effort, needs a tap). iOS Safari cannot be rotated by a page, so the notice covers it; an "Add to Home Screen" install uses `manifest.webmanifest` (landscape, fullscreen) and an icon.
- **Viewport fix**: the canvas now refits whenever its container resizes; before, rotating could leave it at the old size.
- **Tests**: playwright iPad profile is now landscape; new tests cover the notice, pause on rotate, and that guide audio is requested.

## Verification (2026-11-05)

pnpm typecheck, lint, format:check, test (36 tests in 14 files), build, test:e2e (16 tests x 2 browsers, run twice: 36 passed; desktop Chromium and iPad WebKit emulation). Screenshots of the map and a level were inspected at 1366x768 and an iPhone 13 profile.

## Not done

- No child playtest; whether the map and monkey hold a 7-year-old's interest is unknown.
- Lighthouse and Waterfall are locked placeholders; there is only one real unit.
- Fruit appear without a character animation; the monkey bobs but does not react to answers.
- iPad Safari and the microphone path (HTTPS) are still unverified.
- Seedream output licence and any age-appropriateness review of the generated art are the owner's call before publishing.

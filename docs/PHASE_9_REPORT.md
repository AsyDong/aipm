# Phase 9 report — Hello intro segment and Unit 3 sample map

Scope (2026-11-07 continuation): "你按规划完成Hello 引导片段 + U3 完整样板地图，我让孩子试玩一下。记得完成一个小结点，调用 /browser-skill 完整测试，测试通过就提交一下。" This is data-only content work on the existing engine: no new mechanics, plugins, dependencies or curriculum content embedded in code. Every node is a GameDefinition JSON entry reusing the existing Tap / Voice Match / Slice round loop through the same contracts, ContentResolver unit ownership and reward rules as earlier phases.

## What was built

Friendly World map (`apps/web/src/data/world.json`, retitled "Friendly World Adventure"), 14 pins: 3 Hello nodes at Welcome Harbour, 6 Unit 3 nodes at Market Street, the existing Talking Market (voice) and Woodland sampler, and 3 locked "coming soon" pins. Pin coordinates were spread so bubbles and labels stay clear and tappable from the smallest landscape map (668×375) up to full desktop; a live-DOM occlusion audit confirmed no label is covered by a later pin's bubble.

- Welcome Harbour · Hello: Harbour Friends (`hello-greet`, Cameron/Jim/Jenny, 3 rounds), Find the Bus (`hello-bus`, 4 buses, 4 rounds), All Aboard (`hello-board`, boat+buses+characters pool, 5 rounds). Reference: Cambridge Power Up 0, Starter (teaching courseware).
- Market Street · Unit 3: Fruit Market (`u3-basket`, 5 rounds/2 options), Fruit Stall (`u3-stall`, 5/5), Grocery Shop (`u3-grocery`, food, 5/3), Counting Boxes (`u3-count`, group cards "Three apples!", 5/3), Fruit Kitchen (`powerup0-slice` reused, 6 fruits), Picnic Time (`u3-picnic`, fruit+food pool, 6/4). Reference: Cambridge Power Up 0, Unit 3 "Food shopping", Vocabulary 2 and How-many practice.
- Per-level `story` (READY overlay, "who we help / what we do") and `hello` (spoken guide line, `guide/hello-<level>.mp3`) fields make each node's goal explicit to a non-reader. The map guide line was reworded for the new world.

Host changes: `content.ts` gained a `listenFind` definition builder and the new content pools; `main.tsx` renders `level.story` and speaks the per-level hello on start; `metadata.ts` adds the HARBOUR scene theme (generated harbour backdrop, shelf on the wooden pier). Pin hit targets were restructured: the `<button>` now wraps only the bubble while label and stars are non-interactive siblings (`pointer-events: none` on the pin wrapper). Before this, overlapping tall pin buttons swallowed neighbour taps at phone-landscape sizes (caught by the upright-phone e2e test); now only the big bubble is tappable and labels can never block a neighbour.

## Assets (all generated for this project, no textbook files committed)

- Seedream images via the volcengine-media skill, keyed out by `scripts/process-art.py`: Cameron/Jim/Jenny, 4 buses + boat, rice/beans/egg/burger/carrot, harbour backdrop.
- `scripts/make-count-cards.py` (PIL) composes the 5 group cards (2–6 dice-pip layouts).
- Edge TTS audio via `scripts/generate-prompts.py`: 18 word/phrase prompts (Sonia −10%) and 8 per-level hello lines + map line (Maisie +8Hz), all served locally from `apps/web/public/audio`.

## Verification (actual results)

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (79 unit tests in 27 files), `pnpm build` — all pass. Format needed `"endOfLine": "auto"` (CRLF working tree) and the two original Chinese design documents added to `.prettierignore` (protected per project rules; a clean tree already failed format before this phase).
- `pnpm test:e2e` — 34/34 across desktop-chromium and ipad-webkit after the pin restructure. Two tests were updated for the new world: the renamed Waterfall pin ('Play Fruit Kitchen') and the map-stars locator, which now scopes to the pin wrapper because stars are no longer inside the button.
- browser-skill walkthrough in the user's real Chrome (iPad-mini landscape emulation): map renders with all 14 pins, labels readable, Harbour Friends READY overlay shows the level story and "Listen to the word. Tap the right one.", round 1 completed with hint → gold plate → correct tap → "Yes!" feedback. The node-by-node run was interrupted twice by the environment, not by a defect: first by a child playtesting the same window (per the user's "孩子先玩" instruction), then by the game window being occluded by another Chrome window — page hiding auto-paused the game exactly as designed (Break time overlay, resume via Keep playing works), which froze the automation rather than the game. A separate bsk daemon was stopped by the operating system under memory pressure before the remaining nodes were walked. The full 9-node walkthrough remains to be redone on a quiet machine; the Playwright suite already covers every mechanic the walkthrough exercises (open → READY overlay → hint → plate → answer → feedback → next → stars), including on the iPad WebKit project.

## Known limits

- Counting is listen-and-find over group cards; there is no counting/drag mechanic. Bus numbers (Bus 1/2…) are skipped; buses are named by colour.
- Talking Market still requires the local ASR backend and a real microphone; automated checks cover failure paths only.
- Automated iPad WebKit is not physical-device acceptance: real iPad Safari, touch latency and speaker volume still need a hands-on pass.
- Stars/progress remain local to the device; 500 listening words remains a long-term goal, not a claim about this preview.

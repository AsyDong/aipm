# Phase 8: Architecture regression and performance

Authorized after Phase 7 by the user's request to continue. This is the last chapter in the task book. Deliver verified checkpoints for loading/lifecycle improvements and architecture/regression evidence, then stop for review.

## Scope and acceptance

Reuse existing Tap, Voice Match, Slice, FruitWorld, learning persistence and Composer. Add a test-only Reaction plugin using public contracts, registration, capabilities and schema; verify it against the existing scene and round loop without changing Game Core. Check repeated startup/disposal, listeners, asset/audio release, malformed configuration and offline recovery. Do not add a fourth child-facing level, a benchmark framework or dependencies.

## 8.1 Loading and resize lifecycle

Lazy-load the adult Composer with React Suspense. Production map entry JS drops from Phase 7's 405.52 kB (gzip 125.82 kB) to 247.76 kB (gzip 77.95 kB), about 39% raw / 38% compressed. Editor/validation chunks load when needed; Phaser remains its existing separate chunk. These are Vite build sizes, not measured device startup times.

Viewport resize notifications now coalesce to one refresh per animation frame. Destruction cancels pending refresh, disconnects ResizeObserver and removes window listeners; queued callbacks also check disposal. A deterministic lifecycle test covers repeated notifications, frame execution, cancellation, late callbacks and repeated destroy.

Verification: viewport test, typecheck, lint and build passed before checkpoint commit `ccb326f`.

## 8.2 Extension and resource regression

Added a separate test-only Reaction plugin directory, public lifecycle implementation, bounded delay schema and local registration. The integration test instantiates the real FruitWorld class with mocked drawing and the existing TaskRunner/RuleEngine/rewards, checks early/paused input rejection, restarts five times, gets exactly one answer per cycle and confirms background destruction and input unsubscribe. No production Game Core changes or extra playable level were needed.

Browser resource instrumentation wraps createObjectURL/revokeObjectURL and counts live managed URLs across six entries/exits through Fruit Market, Woodland, Waterfall and Talking Market. Both browsers return to zero URLs and zero canvases after every exit with no page errors. This is bounded resource evidence, not a heap-leak proof. Existing asset tests cover concurrent deduplication and final-scope release; audio test now exercises repeated destroy after playback timeout.

Verification: 79 unit tests in 27 files, four real SQLite/HTTP tests, typecheck, lint, build, formatting with existing line endings and diff checks passed. Full pre-existing browser suite passed 30/30 (3.0 minutes). New lifecycle checks passed 2/2. New incompatible-import checks initially reached the expected rejection but failed to locate the Input field; the assertion now reads the visible draft JSON directly and passed 2/2 on rerun. All 34 browser cases were therefore verified across the full run and targeted additions; no production code changed after the full browser run. Speech provider code was unchanged; live-provider and speech Python tests were not rerun in this phase.

## Compatibility and delivery

Public contracts, stored learning/configuration formats, input behavior and existing levels remain compatible. Composer loading is deferred until requested. No dependencies, credentials, recordings or textbook collections were added. Two original design documents remain unchanged. Source checkpoints are submitted to the existing GitHub game branch; main/dev remain untouched. Phase 8 ends here pending human review.

## Acceptance boundaries

Automated Chromium and iPad WebKit are software regression only. Physical iPad Safari, real low-end hardware, touch latency, battery/memory profiling and child playtesting require separate acceptance. No universal “no memory leaks” or device FPS claim will be made from mocks or emulation.

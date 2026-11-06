# Phase 8: Architecture regression and performance

Authorized after Phase 7 by the user's request to continue. This is the last chapter in the task book. Deliver verified checkpoints for loading/lifecycle improvements and architecture/regression evidence, then stop for review.

## Scope and acceptance

Reuse existing Tap, Voice Match, Slice, FruitWorld, learning persistence and Composer. Add a test-only Reaction plugin using public contracts, registration, capabilities and schema; verify it against the existing scene and round loop without changing Game Core. Check repeated startup/disposal, listeners, asset/audio release, malformed configuration and offline recovery. Do not add a fourth child-facing level, a benchmark framework or dependencies.

## 8.1 Loading and resize lifecycle

Lazy-load the adult Composer with React Suspense. Production map entry JS drops from Phase 7's 405.52 kB (gzip 125.82 kB) to 247.76 kB (gzip 77.95 kB), about 39% raw / 38% compressed. Editor/validation chunks load when needed; Phaser remains its existing separate chunk. These are Vite build sizes, not measured device startup times.

Viewport resize notifications now coalesce to one refresh per animation frame. Destruction cancels pending refresh, disconnects ResizeObserver and removes window listeners; queued callbacks also check disposal. A deterministic lifecycle test covers repeated notifications, frame execution, cancellation, late callbacks and repeated destroy.

Verification: viewport test, typecheck and lint passed. Build passed for lazy loading; final build after lifecycle changes follows before commit.

## Acceptance boundaries

Automated Chromium and iPad WebKit are software regression only. Physical iPad Safari, real low-end hardware, touch latency, battery/memory profiling and child playtesting require separate acceptance. No universal “no memory leaks” or device FPS claim will be made from mocks or emulation.

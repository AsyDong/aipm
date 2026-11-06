# Phase 6: Learning Data

Authorized by the user's acceptance of Phase 5 and request to continue. Complete Phase 6 in three sequential checkpoints, then stop before Phase 7.

## Design and compatibility

Runtime session and EventBus facts → learning-core collector → immutable session submission with explicit learner/game/session and curriculum/unit/content ownership → browser durable outbox → same-origin local Python/SQLite API → learning records and progress. Rewards remain independent. No transcript, audio, pointer path or pronunciation/mastery inference is stored.

The first version uses a local pseudonymous device profile, not an authenticated account. SQLite and Python's standard library avoid a new service dependency. The API is loopback-only; public multiuser authentication/deployment is outside this checkpoint. Completed and abandoned sessions are saved; unstarted previews are ignored. One immutable submission per session provides idempotency even after a response is lost. Progress uses counts and a transparent review flag (unfinished, hinted, or more than one answer attempt), not mastery.

## 6.1 Contracts and collection

Added public session, record, submission, progress and host persistence contracts. LearningEventCollector subscribes to task, successful prompt, hint, answer and speech facts, verifies session/game ownership, ignores completed-task duplicates and unsubscribes on finish. Per-task target ownership comes from TASK_PRESENTED rather than from selected distractors. Recording and recognition facts are additive events; runtime wiring follows 6.3.

Verification: two collector tests, typecheck, lint, build and diff checks passed. The initial test imported a package that learning-core intentionally does not depend on; corrected the test to import the existing EventBus source without adding a production dependency.

## 6.2 Persistence and offline queue

Added a standard-library loopback Python API with transactional SQLite session/record tables and a learner-indexed progress query. Counts are aggregated in one SQL query; a window selects the most recent review status without N+1 queries. POST /api/v1/game-sessions atomically accepts the immutable submission; GET /api/v1/learning-progress?learnerId=... returns observations. This replaces separate event/complete endpoints for this minimal version. Same session/body is acknowledged, conflicting body returns 409. Strict keys and bounded counts reject raw data and malformed ownership. Host/origin checks and bounded bodies/timeouts apply; this is not authentication.

Browser outbox uses per-session storage keys, keeps failures, checks acknowledgement identity, permits at most 200 pending sessions and sends at most 20 sequential submissions per flush with an eight-second request deadline. Storage failures are raised to the caller rather than dropping old records. Host retry scheduling follows 6.3.

Verification: two outbox tests, four Python database/HTTP tests, typecheck, lint, build, changed-file formatting and diff checks passed. Initial Python tests exposed open SQLite connections on Windows; explicit close now runs after transaction exit and all tests pass. Initial outbox test location was excluded by the existing Vitest config; moved the test to the configured packages test tree.

## Remaining checkpoint

6.3: runtime/host integration, English grown-up summary, full regression and remote delivery.

Physical iPad Safari, child playtesting and learning effectiveness remain outside automated acceptance. No Phase 7 work is authorized by this milestone.

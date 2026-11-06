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

## 6.3 Runtime and host integration

Runtime accepts an optional learning callback (existing three-argument callers remain valid), creates a collector per engine session before startup, and saves once at completion or disposal/restart. Unstarted previews create no submission. Successful microphone capture start emits a recording fact; the mechanic emits a recognition fact after confidence/nonempty-text validation, before matching the answer. Failed recognition counts no answer attempt. No game-core changes were needed.

The host keeps an anonymous profile, queues snapshots, retries sequential batches with capped backoff and reconnect handling, and displays English grown-up notes separately from stars. Storage errors remain visible even if later network sync succeeds. Plain-HTTP compatibility is preserved when randomUUID is unavailable by using getRandomValues for the profile ID.

Verification: 75 unit tests (24 files), four Python database/HTTP tests, typecheck, lint, build and diff checks passed. Four new/extended browser checks passed on both projects after fixing browser fetch binding and waiting for reload recovery before dispatching reconnect. Final full `pnpm test:e2e` passed 28/28 in Chromium and iPad WebKit (2.9 minutes). Most legacy browser tests ran with the learning backend absent, confirming gameplay continues with queued notes; learning-specific browser tests mocked the API, while Python tests exercised real HTTP and SQLite. No live browser-to-SQLite end-to-end acceptance or visual inspection of the new grown-up panel is claimed. Default `pnpm format:check` failed on 111 files due to this Windows checkout's CRLF; `pnpm exec prettier --check . --end-of-line auto` passed across the whole repo. No unrelated files were reformatted.

Initial browser regression was 24/28: class-member invocation of native fetch caused illegal invocation and the reconnect test raced application initialization. Corrected native fetch invocation with the default function argument and added a wait for pending status after reload; targeted rerun was 4/4.

## Limits and delivery

The backend must be started separately (`python scripts/learning_server.py`); static hosting needs a same-origin API route. It is a local single-profile system with no authenticated user boundary. Learner ID scopes queries but is not proof of identity. Clearing browser data loses unsent notes and disconnects the profile from stored records. Already queued sessions survive reload, but abrupt termination during an active session can lose its unfinished observations. No persistent event-level journal or raw-data store is added. API idempotency is session-snapshot based rather than per-event POSTs; the learning record key is session + task. Progress review state reflects latest observations, not a learning schedule or mastery claim. The 200-session queue refuses additional saves explicitly instead of evicting old data. Multiple tabs use independent per-session keys, though capacity checks are not a cross-tab transaction.

Checkpoints 6.1 `9e6e327` and 6.2 `f5889ed` are committed; 6.3 is the final integration commit containing this report. Remote fetch succeeded through the existing per-command 7890 proxy; push follows the final commit. Original design documents, existing Tap/Voice/Slice behavior and rewards are preserved. No credentials, recordings, curriculum collection or runtime database is committed.

Physical iPad Safari, child playtesting and learning effectiveness remain outside automated acceptance. No Phase 7 work is authorized by this milestone.

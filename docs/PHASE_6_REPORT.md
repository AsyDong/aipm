# Phase 6: Learning Data

Authorized by the user's acceptance of Phase 5 and request to continue. Complete Phase 6 in three sequential checkpoints, then stop before Phase 7.

## Design and compatibility

Runtime session and EventBus facts → learning-core collector → immutable session submission with explicit learner/game/session and curriculum/unit/content ownership → browser durable outbox → same-origin local Python/SQLite API → learning records and progress. Rewards remain independent. No transcript, audio, pointer path or pronunciation/mastery inference is stored.

The first version uses a local pseudonymous device profile, not an authenticated account. SQLite and Python's standard library avoid a new service dependency. The API is loopback-only; public multiuser authentication/deployment is outside this checkpoint. Completed and abandoned sessions are saved; unstarted previews are ignored. One immutable submission per session provides idempotency even after a response is lost. Progress uses counts and a transparent review flag (unfinished, hinted, or more than one answer attempt), not mastery.

## 6.1 Contracts and collection

Added public session, record, submission, progress and host persistence contracts. LearningEventCollector subscribes to task, successful prompt, hint, answer and speech facts, verifies session/game ownership, ignores completed-task duplicates and unsubscribes on finish. Per-task target ownership comes from TASK_PRESENTED rather than from selected distractors. Recording and recognition facts are additive events; runtime wiring follows 6.3.

Verification: two collector tests, typecheck, lint, build and diff checks passed. The initial test imported a package that learning-core intentionally does not depend on; corrected the test to import the existing EventBus source without adding a production dependency.

## Remaining checkpoints

6.2: durable browser outbox, bounded retries, SQLite API and idempotency/validation tests.

6.3: runtime/host integration, English grown-up summary, full regression and remote delivery.

Physical iPad Safari, child playtesting and learning effectiveness remain outside automated acceptance. No Phase 7 work is authorized by this milestone.

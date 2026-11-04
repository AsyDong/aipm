# Phase 1 checkpoint

Implemented shared definition/content/task/object/event contracts, JSON Schema 2020-12, synchronous typed EventBus, local plugin registry with exact version and capability checks, and GameEngine lifecycle/cleanup. Bootstrap APIs remain available for compatibility. No concrete scenes, speech providers or gameplay added.

Data ownership is explicit: LearningContent has curriculum/unit/source; LearningTask has target and candidates; SceneObject maps objectId to contentId; answer/event payloads carry task identity. Public objects facade avoids plugin-to-plugin calls. A restart allocates a new session and context.

Contracts v1.0.0 are frozen for Phase 2/3 implementation. Unsupported adaptive progression and error penalties are deliberately excluded from v1 rather than accepted as unused options. Scene/mechanic lifecycle share the same minimal interface; factories are registered locally. Plugin IDs are unique and versions match exactly. AJV validates JSON Schema directly, avoiding two independent game schemas; boundary validation can use Zod later if needed.

Tests were written and run before implementation (4 expected failures), then all passed. Checkpoint commands: pnpm typecheck, pnpm lint, pnpm test, pnpm build, pnpm format:check and git diff --check. Results and counts are included in the commit delivery log. Architecture test verifies core/contracts/learning do not import rendering frameworks. No UI behavior changed; Phase 0 integration suite remains applicable.

Changed files: contracts/game.ts and exports; core engine/events/plugins, unit and architecture tests; root Schema; package dependencies/lock; phase documents and user-authorized execution policy. Core depends on contracts and AJV only. Each plugin is owned before initialization, cleaned in reverse order on failure, then context disposal and event cleanup run. Destroy is idempotent.

Limitations: resource/content validation is supplied by the runtime context in Phase 2/3; this core phase validates configuration/plugin compatibility only. Real iPad and child playtesting are outside this checkpoint. Next: Phaser object and asset adapters and Fruit World, without learning answer logic in the scene.

Branch: game. Each phase report is committed in its own phase commit; obtain its ID with git log. Per latest user instruction, checkpoints proceed autonomously to Phase 3.

# Architecture

Current milestone: Phase 3 playable Listen & Find. Phase 0 and 1 froze the foundation before scene and mechanic implementation; autonomous checkpoints end with human review at Phase 3.

v3.2: the host shows a world map (apps/web/src/data/world.json, one pin per level, each pin names a game JSON). The monkey guide speaks through GameViewState (feedback, word) so React never reads task data early; the scene gives its counter position to the object layer (setShelf). Mechanics report answers only through IAnswerPort (submit / unrecognized); the runtime decides when answers are open, so a spoken "not heard" is never counted as wrong. The runtime picks plugins from a local catalog by id (plugin-catalog.ts) and preloads each plugin's own assets before the game can start. Audio session mode (playback vs play-and-record) is switchable for the microphone phase.

Data flow (v3.1): the host loads GameDefinition and LearningContent from JSON (apps/web/src/data, content checked by parseContents) → runtime validates the supported feature subset → ContentResolver checks explicit curriculum/unit ownership → AssetManager preloads required images/audio → GameEngine validates schemas, local plugins and capabilities → learning-core creates tasks with shuffled candidates → core TaskRunner owns the round loop (present, submit, hint, next, finish) and is the ITaskView plugins read → pointer adapters feed InputManager → Tap shows the current task's candidates on TASK_PRESENTED and emits selection facts → RuleEngine evaluates once → RewardManager grants once per task → bridge publishes view state. Mechanics only decide how an answer is collected; the loop is shared, so Voice Match and Slice reuse it. React owns controls and overlays; Phaser owns drawing and world coordinates.

Runtime composes the engine, local Fruit World/Tap factories, viewport, input and audio managers. Core, contracts and learning-core remain independent of React and Phaser. The scene does not evaluate answers; the mechanic contains no textbook vocabulary. Runtime gates selection until prompt playback completes and ignores stale asynchronous playback after pause, restart or disposal. Restart creates a new session and resets observations/rewards. Page hiding pauses the game.

Edge TTS is a build-time asset-generation utility. Playback uses Web Audio with a same-origin HTML Audio fallback when AudioContext is unavailable. Failed playback locks selection and allows Listen to retry. Session counters remain in memory; no backend learning collector, speech recording or mastery model is implemented.

Phase 2 adds a standalone Fruit World visual plugin, public object operations and runtime viewport adapter. Scenes import contracts and Phaser only. Scoped AssetManager deduplicates loads and disposes object URLs; viewport owns texture registration and canvas destruction.

The design baseline is the two original documents at the repository root, with subsequent user decisions recorded in DEVELOPMENT_TASKS.md.

Dependencies: React host → runtime → contracts/core/learning/scenes/mechanics. Speech-core remains a future adapter skeleton. React receives no Phaser references.

Phase 0 creates a temporary neutral canvas in the runtime, not a scene plugin or an English learning game. Phaser owns canvas coordinates and animation. The host owns mounting and UI. A directional bridge carries commands and state messages. Initialization checks cancellation after dynamic imports; disposal removes listeners and the canvas and requests Phaser system cleanup on its next frame. No shared mutable runtime singleton exists.

No remote plugins, dependency injection container, script execution, backend or camera support is introduced.

Phase 1 freezes typed event payloads, plugin lifecycle, configuration schemas, session/restart semantics and public object interaction contracts. See game-contracts/src/game.ts. Core validates local registration and lifecycle; runtime owns content/resource readiness. Each restart allocates a new session. The user authorized autonomous checkpoint progression through Phase 3.

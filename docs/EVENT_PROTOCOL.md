# Event protocol

Phase 2 Fruit World emits SCENE_LOADED, SCENE_STARTED and SCENE_DESTROYED; learning events remain unimplemented until Phase 3. Runtime owns object feedback without synthesizing answer events.

Phase 0 transports host commands PAUSE and RESUME. Runtime publishes READY and STATE_CHANGED with READY, RUNNING, PAUSED or DESTROYED. READY indicates initialization, not completion of a learning task. React subscribes before runtime construction.

Subscriptions return an unsubscribe function. Bridge destruction is idempotent, clears both directions and prevents new subscriptions and delivery. Listener failures are reported through the injected error callback.

These bootstrap messages are not persisted learning events. Phase 1 defines the single EventPayloadMap in game-contracts/src/game.ts including eventId, gameId, sessionId, Unix millisecond timestamp, source and protocol version. Task/content attribution is carried explicitly, never reconstructed by scanning objects. Core EventBus snapshots listeners, removes once listeners before dispatch for reentrancy, isolates errors and supports cleanup. No binary audio or high-frequency trajectories are persisted.

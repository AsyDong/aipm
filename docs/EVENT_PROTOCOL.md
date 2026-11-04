# Event protocol

Phase 0 transports host commands PAUSE and RESUME. Runtime publishes READY and STATE_CHANGED with READY, RUNNING, PAUSED or DESTROYED. READY indicates initialization, not completion of a learning task. React subscribes before runtime construction.

Subscriptions return an unsubscribe function. Bridge destruction is idempotent, clears both directions and prevents new subscriptions and delivery. Listener failures are reported through the injected error callback.

These bootstrap messages are not persisted learning events. Phase 1 defines the single typed event map including eventId, gameId, sessionId, Unix millisecond timestamp, source and protocol version. Task/content attribution will be carried explicitly, never reconstructed by scanning objects.

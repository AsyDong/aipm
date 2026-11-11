# Event protocol

Phase 9 review extends GameViewState with optional `collected` entries containing taskId/contentId/text/image for solved targets only. Runtime appends an entry after a correct answer; pause/replay preserve it and start/restart clear it. The host can render task results without reading task targets or Phaser objects. This presentation field is not persisted as a learning event.

Current learning events also include VOICE_RECORDED (successful capture start) and VOICE_RECOGNIZED (nonempty recognition above the confidence gate, including wrong words). They carry task IDs in the session-scoped EventBus envelope. Phase 6 persists aggregated task observations in immutable session submissions rather than raw input events. Phase 8 introduces no public event or bridge protocol changes; the Reaction test uses existing task/input/answer contracts.

Phase 5: SWIPE contains a completed, bounded world-coordinate trajectory. Device adapters own mouse/touch capture; InputManager discards gestures at input-state boundaries. Slice emits INPUT_RECEIVED (inputType SWIPE) and OBJECT_SELECTED for its first uncut hit, then submits through IAnswerPort. Existing answer/reward events remain owned by the shared runner. No raw trajectories are added to persistent learning events.

Phase 4: runtime dispatches VOICE InputEvents through InputManager with taskId/sessionId ownership. These carry transcription/confidence or a typed failure; they are input facts, not persistent GameEvents. The mechanic emits INPUT_RECEIVED and reports through IAnswerPort. VOICE_FAILED now also distinguishes TIMEOUT, PERMISSION_DENIED and UNSUPPORTED; these count no answer attempt. No raw audio or transcript is added to GameEvent payloads. Bridge commands add VOICE_START/VOICE_STOP and view state optionally includes voice request/record/recognize/retry state; existing Tap hosts remain compatible.

v3.2: VOICE_FAILED { taskId, reason } reports an unreadable answer (NO_SPEECH, LOW_CONFIDENCE, ERROR). It is not an attempt, is never a wrong answer and unlocks no hint. Tap now sends OBJECT_SELECTED (fact) and then calls IAnswerPort.submit; the runtime no longer listens for OBJECT_SELECTED.

v3.1: TaskRunner (game-core) now emits TASK_PRESENTED, ANSWER_SUBMITTED, ANSWER_CORRECT/INCORRECT, REWARD_GRANTED and HINT_REQUESTED; Tap emits INPUT_RECEIVED and OBJECT_SELECTED; runtime emits AUDIO_PLAYED and GAME_REWARD_SUMMARY. InputEvent is a TAP | SWIPE union produced only by input adapters.

Phase 3 implements the typed EventPayloadMap from game-contracts. Runtime presents TASK_PRESENTED with task/content/curriculum/unit ownership, then emits AUDIO_PLAYED only after successful playback. Input passes through InputManager; Tap emits OBJECT_SELECTED with object/content/task IDs. Runtime emits ANSWER_SUBMITTED, evaluates via RuleEngine and emits ANSWER_CORRECT or ANSWER_INCORRECT. Correct answers grant one REWARD_GRANTED per task; explicit Next/Finish advances and ultimately emits GAME_COMPLETED and GAME_REWARD_SUMMARY. HINT_REQUESTED records the task and hint level. Replay is identified by AUDIO_PLAYED.audioType.

The gameplay bridge accepts START, PAUSE, RESUME, RESTART, DESTROY, REPLAY, HINT, NEXT and SET_VOLUME. It returns STATE_CHANGED with GameViewState or ERROR. Its exact shape is defined in game-contracts/src/game.ts; the original bootstrap bridge remains separately available for compatibility. View state does not expose the target answer. Events and session summaries are not persisted in Phase 3.

Historical checkpoint notes follow.

Phase 2 Fruit World emits SCENE_LOADED, SCENE_STARTED and SCENE_DESTROYED; learning events remain unimplemented until Phase 3. Runtime owns object feedback without synthesizing answer events.

Phase 0 transports host commands PAUSE and RESUME. Runtime publishes READY and STATE_CHANGED with READY, RUNNING, PAUSED or DESTROYED. READY indicates initialization, not completion of a learning task. React subscribes before runtime construction.

Subscriptions return an unsubscribe function. Bridge destruction is idempotent, clears both directions and prevents new subscriptions and delivery. Listener failures are reported through the injected error callback.

These bootstrap messages are not persisted learning events. Phase 1 defines the single EventPayloadMap in game-contracts/src/game.ts including eventId, gameId, sessionId, Unix millisecond timestamp, source and protocol version. Task/content attribution is carried explicitly, never reconstructed by scanning objects. Core EventBus snapshots listeners, removes once listeners before dispatch for reentrancy, isolates errors and supports cleanup. No binary audio or high-frequency trajectories are persisted.

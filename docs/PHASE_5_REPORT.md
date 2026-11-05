# Phase 5: Slice

Authorized after Phase 4.5. Complete Phase 5 and stop before Phase 6. The task book has one checklist, so delivery uses three verified commits: 5.1 input/configuration, 5.2 mechanic/rendering/audio, 5.3 playable level and regression.

## Assessment and data flow

Reuse Fruit World, existing content/assets, InputManager, EventBus, IAnswerPort, TaskRunner, RuleEngine and rewards. No Game Core source changes, new curriculum, moving targets or new image assets are needed.

Phaser device adapter → bounded completed SWIPE in world coordinates → InputManager → Slice mechanic intersects each path segment with current candidate bounds → first uncut hit → object facade animates cutting and IAnswerPort submits the content ID → existing runtime judges/rewards → bridge publishes state. Task-local cut IDs prevent duplicates; pause/prompt/input transitions discard in-progress gestures. Wrong cuts remain unavailable for that task; the correct fruit remains available. Each swipe answers at most once, and Next remains deliberate.

## 5.1 Input and configuration

Added public SliceConfig and JSON schema for a 12–100 world-unit minimum swipe distance (default defined by the mechanic in 5.2). Phaser pointer adapters support optional SWIPE mode while preserving TAP defaults. One pointer owns each trajectory. The adapter samples movement at four world units, caps paths at 128 points and discards overlong/outside gestures rather than creating synthetic shortcuts across the scene. InputManager resets gestures on enable/disable so gestures begun during a prompt or pause cannot answer later.

Verification: targeted input/adapter tests (6/6), typecheck, lint, build and diff checks passed. Initial checks identified a listener referenced before declaration; moved the declaration before registration and reran successfully. No new mechanic is exposed yet; existing TAP mode remains the default.

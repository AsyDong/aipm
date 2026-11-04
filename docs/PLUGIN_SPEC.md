# Plugin specification

Phase 3 registers Fruit World and Tap locally through PluginManager. Tap v1.0.0 requires OBJECTS and HIT_TEST and advertises TAP. Its config permits only optional selectionMode: SINGLE. It subscribes to InputManager, presents a supplied LearningTask through the public object facade, emits OBJECT_SELECTED and removes its subscription on destroy. It neither resolves curriculum nor evaluates correctness/rewards. Fruit World remains reusable with both orchard and woodland themes.

Historical checkpoint notes follow.

Fruit World v1.0.0 declares OBJECTS, ANIMATION, HIT_TEST. Config accepts optional ORCHARD/FOREST theme and rejects unknown fields. Its lifecycle owns scenery/tweens and never evaluates learning answers.

Phase 1 provides PluginRegistration and IPlugin; no executable business plugins yet. IDs are unique, exact semver versions and API 1.0.0 are enforced. Registry validates definitions and plugin schemas via AJV and checks mechanic requirements against scene capabilities. Plugins receive context on initialize, start separately, and destroy in reverse order including partial failures.

Phase 1 defines scene/mechanic factories, metadata, exact version policy, configuration validation and capability checks in game-contracts. Plugins will register locally and clean up resources/subscriptions through an explicit lifecycle. No remote loading or arbitrary code execution is planned.

Scene object operations will use public contracts without exposing another plugin's internal instance. Rules alone evaluate answers and rewards alone calculate rewards.

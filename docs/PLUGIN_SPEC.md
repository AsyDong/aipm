# Plugin specification

Fruit World v1.0.0 declares OBJECTS, ANIMATION, HIT_TEST. Config accepts optional ORCHARD/FOREST theme and rejects unknown fields. Its lifecycle owns scenery/tweens and never evaluates learning answers.

Phase 1 provides PluginRegistration and IPlugin; no executable business plugins yet. IDs are unique, exact semver versions and API 1.0.0 are enforced. Registry validates definitions and plugin schemas via AJV and checks mechanic requirements against scene capabilities. Plugins receive context on initialize, start separately, and destroy in reverse order including partial failures.

Phase 1 defines scene/mechanic factories, metadata, exact version policy, configuration validation and capability checks in game-contracts. Plugins will register locally and clean up resources/subscriptions through an explicit lifecycle. No remote loading or arbitrary code execution is planned.

Scene object operations will use public contracts without exposing another plugin's internal instance. Rules alone evaluate answers and rewards alone calculate rewards.

# Plugin specification

Phase 8 adds a test-only Reaction plugin under game-mechanics/src/**tests**/reaction: it registers with public IPlugin/PluginMetadata contracts, declares OBJECTS/HIT_TEST and a bounded delayMs JSON config schema, runs with the existing FruitWorld class and TaskRunner, and unsubscribes on destroy. The runtime test mocks drawing, validates early/paused input rejection and five restarts with one submission each. No Game Core source change or child-facing Reaction level is introduced. The original core registration stub remains a separate test.

Phase 5 adds local `slice` (Listen & Slice): config `minDistance` defaults to 32 world units and accepts 12–100, with no extra properties. It requires OBJECTS and SLICE, declares SWIPE and preloads `/audio/effects/slice.mp3` through its asset manifest. Fruit World supports the optional object slice operation; existing Tap/Voice contexts remain compatible. Each gesture cuts the first still-available intersection and can submit at most once; task reset clears cut IDs. Wrong cuts do not remove the target, and explicit Next advances only after correctness. Assets and vocabulary remain game configuration/content data.

Phase 3 registers Fruit World and Tap locally through PluginManager. Tap v1.0.0 requires OBJECTS and HIT_TEST and advertises TAP. Its config permits only optional selectionMode: SINGLE. It subscribes to InputManager, presents a supplied LearningTask through the public object facade, emits OBJECT_SELECTED and removes its subscription on destroy. It neither resolves curriculum nor evaluates correctness/rewards. Fruit World remains reusable with both orchard and woodland themes.

Historical checkpoint notes follow.

Fruit World v1.0.0 declares OBJECTS, ANIMATION, HIT_TEST. Config accepts optional ORCHARD/FOREST theme and rejects unknown fields. Its lifecycle owns scenery/tweens and never evaluates learning answers.

Phase 1 provides PluginRegistration and IPlugin; no executable business plugins yet. IDs are unique, exact semver versions and API 1.0.0 are enforced. Registry validates definitions and plugin schemas via AJV and checks mechanic requirements against scene capabilities. Plugins receive context on initialize, start separately, and destroy in reverse order including partial failures.

Phase 1 defines scene/mechanic factories, metadata, exact version policy, configuration validation and capability checks in game-contracts. Plugins will register locally and clean up resources/subscriptions through an explicit lifecycle. No remote loading or arbitrary code execution is planned.

Scene object operations will use public contracts without exposing another plugin's internal instance. Rules alone evaluate answers and rewards alone calculate rewards.

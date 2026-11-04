# Plugin specification

There are no executable plugins in Phase 0. The runtime bootstrap scene validates hosting only.

Phase 1 defines scene/mechanic factories, metadata, exact version policy, configuration validation and capability checks in game-contracts. Plugins will register locally and clean up resources/subscriptions through an explicit lifecycle. No remote loading or arbitrary code execution is planned.

Scene object operations will use public contracts without exposing another plugin's internal instance. Rules alone evaluate answers and rewards alone calculate rewards.

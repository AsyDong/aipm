# Architecture

The design baseline is the two original documents at the repository root. The first milestone is Phase 0–3, with a review after each phase.

Dependencies: React host → runtime → contracts. Phase 0 core, scene, mechanic, learning and speech packages are skeletons. game-core remains independent of Phaser. React receives no Phaser references.

Phase 0 creates a temporary neutral canvas in the runtime, not a scene plugin or an English learning game. Phaser owns canvas coordinates and animation. The host owns mounting and UI. A directional bridge carries commands and state messages. Initialization checks cancellation after dynamic imports; disposal removes listeners and the canvas and requests Phaser system cleanup on its next frame. No shared mutable runtime singleton exists.

No remote plugins, dependency injection container, script execution, backend or camera support is introduced.

Phase 1 will freeze typed event payloads, plugin lifecycle, configuration schemas, session/restart semantics and public object interaction contracts before any parallel plugin implementation.

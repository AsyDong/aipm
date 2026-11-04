# Module specification

| Module         | Phase 0 responsibility                                  |
| -------------- | ------------------------------------------------------- |
| apps/web       | English-only application, controls, lifecycle ownership |
| apps/admin     | Reserved directory; no executable app                   |
| game-contracts | Bootstrap command, message and directional port types   |
| game-runtime   | Lazy Phaser import, canvas, bridge, disposal            |
| game-core      | Skeleton; Phase 1 engine, event bus and registry        |
| game-scenes    | Skeleton; Phase 2 scene plugins                         |
| game-mechanics | Skeleton; Phase 3 Tap                                   |
| learning-core  | Skeleton; curriculum-independent learning models        |
| speech-core    | Skeleton; future ASR/TTS adapters                       |

The bootstrap bridge is explicitly temporary and does not pretend to implement the full GameBridge or GameEngine contract. GameSummary and full learning/plugin types will be implemented together in Phase 1.

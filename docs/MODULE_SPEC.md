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

Phase 1 adds GameSummary, GameContext, task/content/object interfaces and typed events in contracts, and engine/event bus/registry in core. The bootstrap bridge remains compatible and separate. No Phaser/React dependency enters core. Full GameCommand/GameMessage interfaces reserve gameplay communication for Phase 3.

# Module specification

Phase 4 adds speech-core capture/service/HTTP adapter, runtime VoiceCapture, task/session-scoped VOICE input and a local VoiceMatch mechanic. The web app uses bridge commands only. scripts/speech_server.py and volc_asr.py provide a loopback HTTP gateway to real Volcengine ASR, with external skill-managed credentials and in-memory FFmpeg conversion; see SPEECH_PROVIDER.md.

Phase 3 ownership (historical baseline):

| Module         | Current responsibility                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| apps/web       | English controls/overlays, explicit curriculum and demo fixtures, mounting       |
| game-contracts | Shared definitions, ownership, tasks, events, lifecycle and bridge types         |
| game-core      | Engine, registry, event bus, validation, RuleEngine and idempotent RewardManager |
| learning-core  | ContentResolver and sequential/random task generation with shuffled candidates   |
| game-runtime   | Adventure composition, InputManager, AudioManager, viewport/assets and bridge    |
| game-scenes    | Fruit World visual lifecycle and orchard/woodland scenery                        |
| game-mechanics | Tap selection through input and public scene-object contracts                    |
| speech-core    | Reserved; no recording or live speech provider in this milestone                 |

The historical Phase 0/1/2 notes below describe earlier checkpoints, not the current implementation scope.

Phase 2: game-scenes owns FruitWorldScene (display only); runtime owns PhaserObjects, viewport, scoped AssetManager and standalone SceneManager. Runtime fetches same-origin assets and registers textures; React sees no Phaser objects.

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

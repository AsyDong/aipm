# Game configuration schema

v3.1: levels and vocabulary are JSON files (apps/web/src/data/*.json), validated at load (parseContents) and by the schema before a game starts. The mechanic config schema is packages/game-mechanics/src/tap.schema.json. Adding a word or level needs no TypeScript change.

Phase 3 executes GameDefinition through the adventure runtime. Candidate count defaults to 3; targets support sequential or random progression and candidate positions are shuffled each round. The runtime requires at least two resolved content items.

The general schema reserves later features. validateAdventure explicitly rejects limited/no retries, time limits, non-STAR rewards, voice/camera input, device settings and hint levels other than 1. Current support is unlimited gentle retries, mouse/touch, level-1 hints and star rewards. Unsupported options fail rather than silently changing behavior. Root/plugin schemas, exact versions, capabilities, content ownership and required assets are checked before the Start control appears.

Historical checkpoint notes follow.

Phase 2 scene config schema lives in fruitWorldMetadata. Assets explicitly declare scope, key, type, URL and version. Conflicting shared keys are rejected; same-origin sources are required.

Phase 0 loads no GameDefinition and exposes no configuration execution path.

Phase 1 aligns TypeScript and JSON Schema Draft 2020-12 in schemas/game-definition.schema.json, rejects unknown fields by default, and tests valid/invalid fixtures. Input settings and hint policy are included. v1 progression is sequential or random; adaptive progression and error penalties are not accepted. Difficulty explicitly controls optionCount (2–6). AJV is the single executable validator; no independently maintained duplicate Zod schema.

Validation layers: definition structure → registered plugin/version → plugin config → capabilities → content attribution → resource availability. No level may start with unresolved required resources.

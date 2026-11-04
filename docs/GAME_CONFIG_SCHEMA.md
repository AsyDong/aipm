# Game configuration schema

Phase 0 loads no GameDefinition and exposes no configuration execution path.

Phase 1 aligns TypeScript and JSON Schema Draft 2020-12 in schemas/game-definition.schema.json, rejects unknown fields by default, and tests valid/invalid fixtures. Input settings and hint policy are included. v1 progression is sequential or random; adaptive progression and error penalties are not accepted. Difficulty explicitly controls optionCount (2–6). AJV is the single executable validator; no independently maintained duplicate Zod schema.

Validation layers: definition structure → registered plugin/version → plugin config → capabilities → content attribution → resource availability. No level may start with unresolved required resources.

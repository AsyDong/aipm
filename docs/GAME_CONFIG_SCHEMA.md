# Game configuration schema

Phase 0 loads no GameDefinition and exposes no configuration execution path.

Phase 1 will align TypeScript and JSON Schema Draft 2020-12, reject unknown fields by default, and test matching valid/invalid fixtures. The baseline example schema omits fields present in the type definition (including input settings and hint policy); this discrepancy must be resolved before contract freeze. Zod may validate boundary data without becoming a second independently maintained game schema.

Validation layers: definition structure → registered plugin/version → plugin config → capabilities → content attribution → resource availability. No level may start with unresolved required resources.

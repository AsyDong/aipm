# Phase 7: Game Composer

Authorized by the user's request to continue after Phase 6. Complete this chapter and stop before Phase 8. Reuse standard GameDefinition, PluginManager, schema, content ownership and AssetManager; no executable configuration or remote plugin loading.

## 7.1 Validation checkpoint

Runtime exports browser-independent local plugin descriptors and composition validation. Gameplay registration consumes the same descriptors and binds local factories. Validation runs standard schema/plugin capability/config/version checks, supported-runtime checks, content ownership/duplicates and candidate-count checks. Asset checking uses scoped AssetManager with deduplicated references and cleanup in finally. No new protocol or dependency.

Verification: two targeted tests cover all three mechanics and reject malformed data, unknown plugins, mismatched input, foreign content and excess option counts. Typecheck, lint and build passed. Further UI/integration checks follow the next checkpoint.

## Planned delivery

Adult form in the existing web build, local save/reload and JSON import/export, preview through the existing React/bridge level. Preview does not write stars or learning notes. No public publishing/account system, drag editor or new curriculum is included.

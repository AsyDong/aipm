# Phase 7: Game Composer

Authorized by the user's request to continue after Phase 6. Complete this chapter and stop before Phase 8. Reuse standard GameDefinition, PluginManager, schema, content ownership and AssetManager; no executable configuration or remote plugin loading.

## 7.1 Validation checkpoint

Runtime exports browser-independent local plugin descriptors and composition validation. Gameplay registration consumes the same descriptors and binds local factories. Validation runs standard schema/plugin capability/config/version checks, supported-runtime checks, content ownership/duplicates and candidate-count checks. Asset checking uses scoped AssetManager with deduplicated references and cleanup in finally. No new protocol or dependency.

Verification: two targeted tests cover all three mechanics and reject malformed data, unknown plugins, mismatched input, foreign content and excess option counts. Typecheck, lint and build passed. Further UI/integration checks follow the next checkpoint.

## Planned delivery

Adult form in the existing web build, local save/reload and JSON import/export, preview through the existing React/bridge level. Preview does not write stars or learning notes. No public publishing/account system, drag editor or new curriculum is included.

## 7.2 Composer UI and preview

Added the map's “Game Composer for grown-ups” entry. The form chooses local Fruit World theme, Tap/Voice Match/Slice, input, curriculum/unit/content, rounds, option count, progression, hints and star rewards. Validate, save, load, import and download all pass through the shared composition validator and asset check; save is local-only. Preview mounts the supplied definition through the existing bridge and keeps level exit separate from map stars and learning callbacks.

Verification: composer browser flow passes in both desktop Chromium and iPad WebKit. Full `pnpm test:e2e` passes 30/30 in both projects (2.9 minutes); unit tests pass 77 tests in 25 files; typecheck, lint, build, changed-file format and diff checks pass. Default format checking is documented as a checkout-wide CRLF issue; `prettier --check . --end-of-line auto` passes. Voice preview still requires the existing speech backend.

## Delivery and limits

Phase 7.1 `41ddd62` and the final 7.2 integration commit are sequential. Original Chinese design documents and unrelated user changes are preserved. The editor is intentionally local and adult-facing: saved configurations live in browser localStorage, downloads are JSON files, and preview only uses local registered plugins. Asset validation uses same-origin browser fetch and the existing ten-megabyte asset bound. A saved definition can become invalid if its referenced local content/assets are later removed; every load/import/preview validates again. No server-side draft history, accounts, publish workflow, conflict resolution, collaborative editing or generated curriculum was added.

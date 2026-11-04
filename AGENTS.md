# Project rules

- Preserve the two original Chinese design documents and unrelated user changes.
- Implement only the current phase. Stop after each phase for review.
- First milestone: Phase 0 → Phase 1 → Phase 2 → Phase 3.
- Complete Phase 0 and Phase 1 sequentially. Freeze shared contracts before parallel plugin work.
- Core and learning-core must not depend on Phaser or React.
- Scenes must not depend on mechanics; mechanics must not embed curriculum content.
- React must not manipulate Phaser objects. Communicate through the bridge.
- Public types belong in game-contracts. Input, assets and events use their managers.
- Use local plugin registration; no remote executable plugins, DI containers or script sandboxes.
- Child-facing UI is entirely English. Target beginners without an overly infantile presentation.
- Prioritize iPad Safari and desktop browsers. Automated WebKit is not real-device acceptance.
- 500 listening words is a learning goal, not a Phase 0 content quota or a claim of mastery.
- Run relevant tests, typecheck, lint, build and diff checks before delivery.
- Follow docs/ARCHITECTURE.md and update the phase report with actual verification results.
- Java edits must use apply_patch or explicitly preserve original encoding.
- Never commit credentials, original speech recordings or the external textbook collection.
- Submit phase commits to https://github.com/AsyDong/aipm.git, branch game.

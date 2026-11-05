# Phase 4: Speech Core and Voice Match

Authorized on 2026-11-05 after Phase 3.2. Implement sections 6.1–6.4 in order, with verification and a separate commit for each. Stop at Phase 4; Phase 5 is outside this task.

## Assessment and decisions

- Keep the existing Tap levels compatible and add Voice Match through the local catalog.
- Separate capture, ASR and TTS. Providers receive audio and language, never the expected answer. Existing generated prompts remain the default playback path.
- A capture/result belongs to one task and session. Pause, replay, restart and disposal must release the microphone and invalidate stale results.
- Low confidence and no speech count no attempt. Confidence is transcription certainty, never pronunciation quality.
- Keep audio in memory only; no recordings in Git or persistent browser storage. Provider-side retention requires separate configuration/verification.
- ASR deployment choice is pending. No browser credential or invented real-service acceptance.

## 6.1 Speech Core

Public speech contracts are in game-contracts. SpeechService injects independent ASR/TTS providers, validates transcription confidence, bounds hung providers with a timeout, forwards cancellation and maps failures to typed codes. No rendering dependency or external service is required by unit tests.

Verification: `pnpm test` (38 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` and `git diff --check` passed. Changed files formatted with Prettier. Real ASR and physical-device acceptance are not covered by this section.

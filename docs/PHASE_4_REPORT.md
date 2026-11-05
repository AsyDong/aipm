# Phase 4: Speech Core and Voice Match

Latest status: sections 6.1–6.4 were pushed successfully through the user-provided 7890 Git proxy. Follow-up section 6.5 adds the local Volcengine ASR gateway and has passed real-provider transcription with the existing skill credentials using new-console X-Api-Key authentication. Physical iPad and child-speech acceptance remain pending. Earlier delivery notes below describe their original checkpoint.

Authorized on 2026-11-05 after Phase 3.2. Implement sections 6.1–6.4 in order, with verification and a separate commit for each. Stop at Phase 4; Phase 5 is outside this task.

## Assessment and decisions

- Keep the existing Tap levels compatible and add Voice Match through the local catalog.
- Separate capture, ASR and TTS. Providers receive audio and language, never the expected answer. Existing generated prompts remain the default playback path.
- A capture/result belongs to one task and session. Pause, replay, restart and disposal must release the microphone and invalidate stale results.
- Low confidence and no speech count no attempt. Confidence is transcription certainty, never pronunciation quality.
- Keep audio in memory only; no recordings in Git or persistent browser storage. Provider-side retention requires separate configuration/verification.
- No ASR deployment choice was supplied during implementation. Use a same-origin HTTP adapter compatible with a future iFlytek backend, following the existing project preference. No browser credential or invented real-service acceptance.

## 6.1 Speech Core

Public speech contracts are in game-contracts. SpeechService injects independent ASR/TTS providers, validates transcription confidence, bounds hung providers with a timeout, forwards cancellation and maps failures to typed codes. No rendering dependency or external service is required by unit tests.

Verification: `pnpm test` (38 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` and `git diff --check` passed. Changed files formatted with Prettier. Real ASR and physical-device acceptance are not covered by this section.

## 6.2 Recording

VoiceRecorder requests microphone access only on start, negotiates WebM/Opus or MP4 (otherwise the browser default), limits capture to five seconds by default, rejects empty blobs and releases all tracks on stop/cancel/error. A permission request is bounded to 15 seconds; late permission grants after cancellation are immediately released. Recordings stay in memory. Nonempty silent audio is detected by ASR, not by assuming encoded byte size measures speech.

Verification: speech unit tests (5 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` and `git diff --check` passed. Initial lint identified a timer declaration issue, corrected before committing. Physical iPad capture and actual codec support are not confirmed by mocks.

## 6.3 Voice Match

Added a Talking Market level while preserving existing Tap levels and locked placeholder levels. The local VoiceMatch plugin renders the target object and reports recognized word IDs through IAnswerPort. Voice input travels through InputManager with explicit task/session ownership. Recognition failures and low confidence count no answer. Record/Done and request/record/recognize/retry feedback use bridge state; the runtime owns all microphone and provider operations. Capture/ASR never block the command queue, allowing pause to cancel immediately. The HTTP adapter uploads encoded audio and language only; no cloud backend is included (see SPEECH_PROVIDER.md).

Integration review hardened recorder cleanup: late stop/error callbacks and start/stop completion only clean up the session they own. Stop waits at most two seconds for final data.

Verification: 47 unit tests, typecheck, lint, build, format:check and diff checks passed; four Voice Match Playwright tests passed across desktop Chromium and iPad WebKit with mocked capture/ASR. Initial E2E failures were test expectations (existing guide wording and confusing asset preload with prompt playback); corrected to the actual guide text and deterministic curriculum ordering. Full regression was 21/22: the pre-existing WebKit rotation test immediately resized back before observing portrait. Added a wait for the actual portrait notice and paused state; the two-browser targeted rotation rerun passed (2/2). No application rotation code changed. Desktop Voice Match screenshot inspected at 1280x720; final full regression follows section 6.4.

BrowserSkill: an owned session opened the actual map and saved a screenshot; the extension implements protocol 1.3 and rejects cooperation sync (CLI protocol 1.8), so no further interaction was attempted and the session was stopped. The existing browser window is only 1088x187, unsuitable for layout acceptance. Playwright screenshots provide normal viewport observation; neither is a physical iPad test.

## 6.4 Text normalization

Provider-independent normalization handles Unicode compatibility characters, casing, whitespace, punctuation and common no-speech markers. Punctuation/control characters separate words rather than joining fragments into a false match. Matching compares the whole normalized string to task vocabulary; no fuzzy spelling, plural guessing or pronunciation score is introduced. Missing provider confidence still permits exact text matching. Normalization is linear in transcript length; candidate comparison is bounded by the existing task size (at most six options).

Added cases for fullwidth letters, curly quotes, newlines, nonbreaking/zero-width spaces, empty punctuation, no-speech markers, multiword phrases, wrong inflection and recognized text resembling a content ID. The browser completion test now supplies uppercase, quoted and punctuated ASR text.

Verification: `pnpm test` (64 tests in 20 files), `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check`, `git diff --check` and full `pnpm test:e2e` (22/22 in desktop Chromium and iPad WebKit, 2.4 minutes) passed. One unused test binding was fixed after lint reported it; the subsequent checks passed. README/architecture corrections also passed targeted formatting checks. No production code changed after these checks.

## Delivery and remaining acceptance

Sections 6.1–6.4 have separate commits on `game`. Existing Tap definitions/bridge consumers remain supported; voice contracts and view state are additive and all repository callers pass typecheck. Two original Chinese design documents and the pre-existing user `.gitignore` edit are preserved. Only local workspace dependencies were added; no third-party package upgrade, provider credential or raw recording was committed.

Software and mock integration checkpoints are complete. **Phase 4 live-service acceptance is not complete:** no real ASR backend/provider account was supplied or implemented; Talking Market cannot recognize live speech until `/api/speech/recognize` is deployed. Real iPad Safari permission/capture/codec conversion, provider retention and child-speech performance remain unverified. Newly added microphone guidance is English text; existing generated guide/prompts still play. No pronunciation scoring, cloud recording store, Phase 5 or additional curriculum was introduced.

Remote delivery attempt: `git fetch origin game` failed with a connection reset; `git -c http.version=HTTP/1.1 push origin HEAD:game` failed to connect to github.com:443 after 21 seconds. All four section commits are local; remote publication is not confirmed. Retry `git push origin HEAD:game` when connectivity is restored. The only remaining uncommitted file is the user's original `.gitignore` edit.

## 6.5 Volcengine ASR gateway

The user supplied `C:/Users/AsyDong/.workbuddy/skills/volcengine-media` and the Git proxy `http://127.0.0.1:7890`. Fetch and push succeeded; the original four commits are now on remote `game`.

Added a loopback-only Python speech API and Vite same-origin proxy. The backend loads credentials by calling the skill's `volc_common.load_keys`, converts bounded audio to mono 16 kHz PCM through FFmpeg pipes, and implements the ASR v3 WebSocket request/audio/response protocol. No secret or recording is copied into the workspace. It limits upload size, duration, concurrency and deadlines, rejects foreign hosts/origins, cancels disconnected work and returns sanitized errors. Existing providers/mechanics remain compatible; HTTP 504 now maps to the explicit timeout feedback.

The skill's default selfcheck passed under the existing story-studio venv; `--yes` (image generation) was not invoked. Initial legacy-header handshake returned HTTP 400 `app key not found in header or query`. Official documentation confirms new-console X-Api-Key authentication; the existing VOLC_AGENT_KEY worked without an App ID. Live protocol validation also identified that the initial full request consumes sequence 1, so audio starts at 2 (the final packet uses a negative sequence). Both facts were recorded in the skill's protocol notes; its shared scripts were preserved.

Live checks: the existing synthesized apple MP3 returned `Apple.`; in-memory WebM/Opus and MP4/AAC conversions both passed through Vite → HTTP backend → real Volcengine ASR and returned `Apple.`. A separate Chromium UI check fed that synthetic WebM through Record/Done (ASR was not mocked), displayed `Yes! It is apple!` and awarded one star; its 1280x720 screenshot was inspected. No child recordings were used or saved. Existing art was preserved.

Verification: 12 Python backend tests (offline, including real FFmpeg codec conversion), `pnpm test` (65 tests), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `git diff --check`, and `pnpm test:e2e` (22/22, Chromium and WebKit, 3.1 minutes) passed. The later Python authentication/sequence corrections passed the Python suite and live HTTP/UI checks; frontend code did not change after the full frontend regression. Initial upload-limit test hit a Windows connection reset when intentionally sending an oversized body into an early-close response; changed the test to send an oversized Content-Length with a short body, which directly verifies the pre-read limit. The first live UI script hit shell encoding of a curly apostrophe before making any ASR call; an ASCII regex locator fixed that test script.

Compatibility: existing Tap and provider-neutral Voice Match contracts remain unchanged. New runtime requirements apply only to the local speech server: Python 3.11+, websockets 15.0.1, FFmpeg and the external skill loader. Public hosted use needs its own trusted proxy/access policy. Physical iPad microphone capture, child-speech accuracy, learning outcomes and provider-side retention remain unverified. Phase 5 was not started.

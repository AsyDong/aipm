# Test specification

Phase 5 adds mouse/touch adapter ownership, trajectory bounds/cancellation, collision-order/edge tests, Slice duplicate suppression/retry and schema validation with the same FruitWorld registration as Tap. Playwright covers five rounds/completion/restart, wrong cuts, tap rejection, replay/pause and disposal in desktop Chromium and iPad WebKit. WebKit swipes use touch-shaped DOM events passed through Phaser because Playwright exposes no WebKit native touch-drag API; this is simulated input, not physical-device acceptance. See PHASE_5_REPORT.md for actual results.

Phase 4 adds mocked ASR/TTS service, deadline/cancellation, codec/recorder cleanup, HTTP payload validation, session-scoped voice capture, stale result rejection and provider-independent word normalization tests. Voice Match Playwright tests in desktop Chromium and iPad WebKit cover permission refusal, service failure/retry, pause cancellation, low-confidence no-attempt behavior, incorrect words, five rounds/rewards and restart. Capture and ASR are explicitly mocked in these tests. See PHASE_4_REPORT.md for actual results and SPEECH_PROVIDER.md for the live backend/physical iPad acceptance gap.

Phase 3: 15 unit tests cover contracts/core architecture, engine lifecycle, event reentrancy, rules/reward idempotency, content ownership and candidate generation, input filtering, supported runtime options, asset ownership/retry and bridge cleanup. Ten Playwright checks (five each in desktop Chromium and iPad WebKit) cover five rounds/completion/restart, pause/resume/replay/content replacement/repeated disposal, missing resources, corrupt-audio retry and wrong-choice recovery/layout. They exercise actual MP3 playback and rendered canvas feedback; they do not measure a child's listening comprehension.

See PHASE_3_REPORT.md for current command results, visual inspection evidence and physical-device/child playtest steps. Human playtesting is pending; automated browser checks alone are not learning acceptance.

Historical checkpoint notes follow.

Phase 2 adds scope/concurrency/retry/conflict asset tests and repeated SceneManager lifecycle checks. Four browser checks pass against the real scene preview. See PHASE_2_REPORT.md for BrowserSkill viewport/extension limitations.

Phase 0 unit tests cover directional communication, unsubscribe, listener exception isolation and repeated disposal. Playwright covers canvas initialization, pause/resume round trips, repeated mounting/unmounting under React StrictMode and closing during initialization. Projects: desktop Chromium and iPad device profile on WebKit.

Run commands are in README.md. Browser downloads require network access. Emulation does not certify real iPad Safari, memory behavior or learning effectiveness. A real iPad session remains required before Phase 3 acceptance.

Future Listen & Find acceptance includes first choices without hints, replay/hint counts, randomized positions and whether a child voluntarily continues. Observations do not establish language mastery. The user can arrange child playtesting.

Phase 1 tests cover event reentrancy and error isolation, config/plugin/version/capability rejection, lifecycle transitions, new session on restart, partial-initialization cleanup and architectural dependencies. Tests ran red before implementation, then green.

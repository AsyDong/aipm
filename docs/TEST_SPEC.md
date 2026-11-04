# Test specification

Phase 2 adds scope/concurrency/retry/conflict asset tests and repeated SceneManager lifecycle checks. Four browser checks pass against the real scene preview. See PHASE_2_REPORT.md for BrowserSkill viewport/extension limitations.

Phase 0 unit tests cover directional communication, unsubscribe, listener exception isolation and repeated disposal. Playwright covers canvas initialization, pause/resume round trips, repeated mounting/unmounting under React StrictMode and closing during initialization. Projects: desktop Chromium and iPad device profile on WebKit.

Run commands are in README.md. Browser downloads require network access. Emulation does not certify real iPad Safari, memory behavior or learning effectiveness. A real iPad session remains required before Phase 3 acceptance.

Future Listen & Find acceptance includes first choices without hints, replay/hint counts, randomized positions and whether a child voluntarily continues. Observations do not establish language mastery. The user can arrange child playtesting.

Phase 1 tests cover event reentrancy and error isolation, config/plugin/version/capability rejection, lifecycle transitions, new session on restart, partial-initialization cleanup and architectural dependencies. Tests ran red before implementation, then green.

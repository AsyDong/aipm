# Phase 0 acceptance report

## 1. Completion

| Task                                             | Status        | Evidence                                            |
| ------------------------------------------------ | ------------- | --------------------------------------------------- |
| pnpm workspace and seven package skeletons       | Complete      | Nine workspace projects including root and web      |
| React + TypeScript + Phaser 3                    | Complete      | Production build and browser canvas checks          |
| Directional bridge                               | Complete      | Commands, messages, unsubscribe and isolation tests |
| Mount/unmount ownership                          | Complete      | StrictMode and three repeated cycles per browser    |
| TypeScript, ESLint, Prettier, Vitest, Playwright | Complete      | Commands below                                      |
| Admin directory                                  | Complete      | Reserved README only, no premature composer         |
| Real iPad performance/memory measurement         | Not performed | Requires physical device                            |

## 2. File changes

Added root workspace/tool configuration, README, AGENTS.md, apps/web, apps/admin/README.md, seven packages, tests/e2e and docs. The two supplied Chinese documents are retained unchanged. No external textbook binaries, voice credentials or recordings were copied.

Dependency baseline: React 19, Phaser 3.90, TypeScript 5.9, Vite 6, Vitest 3, ESLint 9, Prettier 3, Playwright 1.55.0. Exact installed versions are recorded in pnpm-lock.yaml. Playwright is pinned to match the locally available Chromium/WebKit browser binaries; the initial newer version failed against the old WebKit protocol before any page code ran.

## 3. Architecture check

- Core/learning skeletons do not import Phaser or React.
- No mechanics, curriculum logic or scene plugins have been implemented.
- React imports runtime entry functions and contract types; no Phaser internals.
- Host cleanup removes subscriptions and detaches the canvas immediately. Phaser destroy releases systems on its next frame through the public API.
- No remote plugins, script execution, complex DI, backend or composer introduced.

## 4. Verification

| Command           | Result                                                       |
| ----------------- | ------------------------------------------------------------ |
| pnpm install      | Pass, nine workspace projects                                |
| pnpm typecheck    | Pass                                                         |
| pnpm lint         | Pass                                                         |
| pnpm format:check | Pass                                                         |
| pnpm test         | 2 passed, 0 failed                                           |
| pnpm build        | Pass; Phaser chunk size warning                              |
| pnpm test:e2e     | 4 passed, 0 failed; desktop Chromium and iPad WebKit profile |

The E2E webServer starts the Vite development server. Verified canvas creation, bidirectional pause/resume, repeated disposal/recreation and early closing. The first WebKit attempt failed because Playwright 1.64 requested an unsupported PushAPIEnabled setting from the cached browser. Pinning 1.55.0 resolved it and the full suite passed. The browser download stalled; no successful fresh browser download is claimed.

## 5. Remaining limitations

Git whitespace checking preserves Markdown's intentional trailing two-space line breaks in the supplied documents via .gitattributes. Newly generated files pass formatting checks.

- No learning game yet; neutral canvas verifies hosting only.
- iPad profile on desktop WebKit is not real iPad Safari acceptance.
- No physical-device memory or background-tab timing measurements.
- Phaser dynamic chunk is approximately 1.48 MB raw / 341 KB gzip. It loads on demand; target-device loading performance is unmeasured.
- ESLint 9 is deprecated upstream; retained for this initial tooling baseline and compatible typescript-eslint setup.
- Content mapping, Edge TTS and iFlytek integrations have not been implemented or validated in this phase.

## 6. Next phase

After review: implement Phase 1 tests first, stabilize contracts and schemas, event bus, local plugin manager and engine lifecycle. Do not start scene/Tap/Slice implementations before contract freeze.

## 7. Git

Target/current branch: game. This independent project has its own root history; main/dev are untouched. The phase commit contains this report. Obtain its exact ID using `git log -1 --format=%H`; a report cannot embed its own commit hash. Push outcome and working-tree state are reported with delivery.

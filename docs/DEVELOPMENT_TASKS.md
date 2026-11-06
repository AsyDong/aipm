# Confirmed scope and decisions

Phase 7 continuation: the user authorized the next chapter after Phase 6. Implement Game Composer with a form, shared validation, local save/import/export and existing-runtime preview; stop before Phase 8. Keep preview observations separate from real learning and stars. See PHASE_7_REPORT.md.

Phase 6 continuation: the user accepted Phase 5 and authorized the next development stage. Implement Learning Data in three sequential verified commits (contracts/collector, persistence/API/offline outbox, runtime/host/regression), then stop before Phase 7. Use a local anonymous device profile and a loopback Python/SQLite backend; no account system, raw recordings or mastery scoring. See PHASE_6_REPORT.md.

Phase 5 continuation: the user authorized proceeding to the next chapter after the real-ASR follow-up. Implement Slice as three independently verified commits (input/configuration, mechanic/rendering/audio, playable level/regression), then stop at the task book's Phase 5 milestone. See PHASE_5_REPORT.md.

Phase 4 follow-up: the user supplied the local volcengine-media skill for ASR/image capabilities and authorized GitHub access through the local 7890 proxy. Add the local ASR gateway as a separate verified checkpoint (6.5); keep existing art unless an asset gap requires generation. Credentials stay in the skill's external secrets file. The prior four section commits were successfully pushed through the proxy.

2026-11-05 continuation: the user authorized starting Phase 4 after assessing the current implementation, with one verified commit per section (6.1–6.4). The earlier Phase 3 stop is superseded for Phase 4. Stop after Phase 4; do not start Phase 5. See PHASE_4_REPORT.md.

First milestone: Phase 0 → Phase 1 → Phase 2 → Phase 3. Each phase ends with verification, documentation and a game-branch commit. The user subsequently authorized autonomous progression through Phase 3, with self-review at each checkpoint and human review at the milestone. Phase 0/1 run sequentially; freeze contracts before parallel scene, speech or mechanic work. Use browser-skill for actual UI observation.

- Audience: beginner children; long-term goal of 500 listening words.
- Devices: prioritize iPad Safari and desktop browsers.
- Language: all child-facing interaction is English; no Chinese guidance.
- Experience: avoid an overly infantile style. First prove Listen & Find is understandable and engaging.
- Curriculum: local complete Power Up 0 collection (main textbook PDF, flashcard PDF and companion MP3s). Do not bulk-copy the collection into Git. Inspect and map actual content when implementing Phase 2/3; no assumption that 500 unique vocabulary items are present.
- Speech: Microsoft Edge TTS first; future ASR/evaluation via iFlytek. Existing Python demo is a reference for streaming evaluation, not a dependency or source of committed credentials. Do not equate ASR confidence to pronunciation quality.
- Deployment: independent project. Spring Boot/PostgreSQL and authentication are outside Phase 0–3 implementation unless the selected content delivery requires a minimal adapter.
- Delivery: https://github.com/AsyDong/aipm.git, branch game. Remote main/dev must remain untouched.

Phase 0: workspace, skeleton packages, React/Phaser integration and tools.
Phase 1: tests first, core lifecycle/registry/event bus and stable shared contracts.
Phase 2: runtime adaptation, scene/asset management and Fruit World.
Phase 3: unified mouse/touch, audio, rules, rewards and playable Listen & Find.

The user will arrange child playtesting. Phase 4–8 are outside this first milestone. A full speech provider implementation is deferred; Phase 3 uses existing curriculum audio first and may require a narrowly scoped Edge TTS generation tool for missing prompts.

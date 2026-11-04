# Confirmed scope and decisions

First milestone: Phase 0 → Phase 1 → Phase 2 → Phase 3. Each phase ends with verification, documentation, a game-branch commit and a review stop. Phase 0/1 run sequentially; freeze contracts before parallel scene, speech or mechanic work.

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

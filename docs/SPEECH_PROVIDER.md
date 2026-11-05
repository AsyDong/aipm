# Speech provider integration

The web runtime uses `HttpSpeechRecognizer` through `SpeechService`. Voice Match imports only contracts, so switching provider requires changing runtime composition, not the mechanic. ASR and TTS are independent; existing generated MP3 prompts remain the default. A TTS provider is optional and `synthesize` reports `UNSUPPORTED` until one is injected.

## HTTP contract

Deploy a same-origin `POST /api/speech/recognize` backend. This repository does **not** implement an authenticated cloud speech backend, contain provider credentials or claim a working live ASR deployment. Without the route the Talking Market level reports a retryable recognition error; existing Tap levels continue to work.

Request: `multipart/form-data` with `audio` (a short recording with its MIME type and filename) and `language` (`en-GB`). No expected word, task answer, API key or pronunciation score is sent. The capture limit is five seconds; ASR has a ten-second deadline. Requests are cancelled when the game is paused, restarted, replayed or closed.

Successful response:

```json
{ "text": "apple", "confidence": 0.92 }
```

`text` must be a string. Empty text means no speech. `confidence` is optional, finite and in [0, 1]; values below 0.5 mean retry without counting an answer. Missing confidence permits text matching; it is never interpreted as perfect pronunciation. Non-2xx, malformed JSON and invalid response fields are retryable service failures. Fetch refuses redirects.

The backend must inspect/limit uploaded bytes and duration, accept Safari MP4/AAC and Chromium WebM/Opus (or transcode to the selected provider's format), keep provider secrets on the server, and translate provider responses to this contract. Configure upload limits, access/rate limits and provider retention for deployment. Do not log or persist raw recordings by default. Browser cancellation is not proof that a remote provider deleted an upload.

Microphone access requires HTTPS or localhost; plain HTTP over a LAN supports Tap but reports microphone unavailable. Permission is requested only after Record. A late grant after cancellation releases tracks immediately. Audio is held in memory during capture/upload, with no localStorage, IndexedDB or download path for recordings.

## Verification boundary

Unit tests inject providers and recorder APIs; Playwright uses explicitly simulated microphone capture and a routed ASR response in Chromium and WebKit. Neither proves real device codec support, ASR child-speech accuracy, upload conversion or remote retention. Acceptance still needs an actual backend and a physical iPad Safari HTTPS session: allow/refuse permission, record/stop/retry, silence, timeouts, rotate/background, leave/re-enter, and confirm the microphone indicator turns off.

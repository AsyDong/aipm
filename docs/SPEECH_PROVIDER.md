# Speech provider integration

The web runtime uses `HttpSpeechRecognizer` through `SpeechService`. Voice Match imports only contracts, so switching provider requires changing runtime composition, not the mechanic. ASR and TTS are independent; existing generated MP3 prompts remain the default. A TTS provider is optional and `synthesize` reports `UNSUPPORTED` until one is injected.

## HTTP contract

The repository includes a loopback-only Python backend at `scripts/speech_server.py` for `POST /api/speech/recognize`. Vite proxies `/api/speech/` to `127.0.0.1:8787`. It sends bounded mono 16 kHz PCM to Volcengine streaming ASR 2.0 over WebSocket; this is independent of the Voice Match plugin. It is a local development service, not an authenticated public cloud deployment. Without the service or valid ASR configuration Talking Market reports a retryable recognition error; existing Tap levels continue to work.

## Start the local backend

Requires Python 3.11+, `websockets==15.0.1` (`scripts/requirements-speech.txt`) and FFmpeg on PATH. The owner's existing story-studio venv already has the WebSocket dependency:

```powershell
& C:/Users/AsyDong/AppData/Local/story-studio/venv/Scripts/python.exe scripts/speech_server.py
# A separate terminal:
pnpm dev
```

For another machine, create/activate a Python environment and install `pip install -r scripts/requirements-speech.txt`. The provider loads `volcengine-media/scripts/volc_common.py` from `~/.workbuddy/skills/volcengine-media` (override with `VOLC_MEDIA_SKILL_DIR`) and calls its `load_keys()`; it never copies that file or its keys into this project. Follow the skill's local secrets-file rules. Use `DOUBAO_TTS_API_KEY` when supplied, otherwise `VOLC_AGENT_KEY`. New-console authentication sends this as **X-Api-Key**, requiring no App ID. If DOUBAO_APP_ID is supplied, the adapter uses legacy App-Key/Access-Key authentication. The ASR resource is `volc.seedasr.sauc.duration`. `FFMPEG_PATH` may point to another FFmpeg executable.

The skill's original legacy-header example returned HTTP 400 when App ID was absent. The [official streaming ASR documentation](https://www.volcengine.com/docs/6561/1354869) confirms new-console X-Api-Key support. Using that authentication and the existing VOLC_AGENT_KEY succeeded on 2026-11-05: the synthetic apple prompt returned `Apple.`. The HTTP/Vite chain also transcribed actual WebM/Opus and MP4/AAC encodings correctly. No credential change was required.

Run a short live check (billable ASR) with the existing synthetic prompt, not a child's recording:

```powershell
& C:/Users/AsyDong/AppData/Local/story-studio/venv/Scripts/python.exe scripts/volc_asr.py --audio apps/web/public/audio/apple.mp3
```

Offline backend tests do not read credentials or contact Volcengine:

```powershell
& C:/Users/AsyDong/AppData/Local/story-studio/venv/Scripts/python.exe -m unittest discover -s scripts -p test_speech.py -v
```

Request: `multipart/form-data` with `audio` (a short recording with its MIME type and filename) and `language` (`en-GB`). No expected word, task answer, API key or pronunciation score is sent. The capture limit is five seconds; ASR has a ten-second deadline. Requests are cancelled when the game is paused, restarted, replayed or closed.

Successful response:

```json
{ "text": "apple", "confidence": 0.92 }
```

`text` must be a string. Empty text means no speech. `confidence` is optional, finite and in [0, 1]; values below 0.5 mean retry without counting an answer. Missing confidence permits text matching; it is never interpreted as perfect pronunciation. Non-2xx, malformed JSON and invalid response fields are retryable service failures. Fetch refuses redirects.

The backend caps encoded audio at 1 MiB, decoded audio at 5.5 seconds, active requests at two, conversion at three seconds and total work at eight seconds. It accepts Safari MP4/AAC and Chromium WebM/Opus, decodes through FFmpeg pipes and never creates audio files. Invalid inputs, foreign origins/hosts and overload are rejected before provider work. Request disconnection cancels the WebSocket/converter. HTTP 504 preserves the child's timeout/retry feedback. No request bodies, transcripts, headers or raw provider errors are logged. The response omits confidence because the adapter does not have a verified provider confidence field.

For HTTPS/device use, route the API through the same web origin and set `SPEECH_ALLOWED_HOSTS` to the comma-separated hostnames that the trusted proxy forwards (default `127.0.0.1,localhost`). The Python server always binds loopback. For public deployment place it behind an authenticated/rate-limited reverse proxy; this helper supplies neither user accounts nor a distributed quota. Configure provider retention separately. Browser cancellation is not proof that a remote provider deleted an upload.

Microphone access requires HTTPS or localhost; plain HTTP over a LAN supports Tap but reports microphone unavailable. Permission is requested only after Record. A late grant after cancellation releases tracks immediately. Audio is held in memory during capture/upload, with no localStorage, IndexedDB or download path for recordings.

## Verification boundary

Backend tests cover new/legacy authentication, protocol frames, real FFmpeg WebM/MP4 conversion in memory, upload parsing, origin/size/concurrency limits, cancellation and sanitized errors. Frontend unit tests inject providers and recorder APIs; the standard Playwright suite uses explicitly simulated microphone capture and routed ASR in Chromium and WebKit. Separate live checks use synthetic audio through the real provider. These do not prove physical iPad recording compatibility, ASR child-speech accuracy or remote retention. Acceptance still needs a physical iPad Safari HTTPS session: allow/refuse permission, record/stop/retry, silence, timeouts, rotate/background, leave/re-enter, and confirm the microphone indicator turns off.

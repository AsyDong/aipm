# speech-core

SpeechService composes independent ASR/TTS providers with timeouts and cancellation. VoiceRecorder captures bounded in-memory audio and releases microphone tracks. HttpSpeechRecognizer sends audio to a same-origin backend. Public types belong to game-contracts; no Phaser or React dependency. See docs/SPEECH_PROVIDER.md for the HTTP contract and real-device acceptance boundary.

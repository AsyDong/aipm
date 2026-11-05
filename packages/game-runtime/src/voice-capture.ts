import type {
  IAudioManager,
  IInputManager,
  ISpeechRecognizer,
  IVoiceRecorder,
  UnrecognizedReason,
  GameViewState,
} from '@english/contracts';
import { SpeechFailure } from '@english/speech-core';

/** Runtime owns capture; the mechanic sees only task/session-scoped input facts. */
export class VoiceCapture {
  private operation: AbortController | undefined;
  private recording = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private owner: { taskId: string; sessionId: string } | undefined;
  constructor(
    private readonly recorder: IVoiceRecorder,
    private readonly recognizer: ISpeechRecognizer,
    private readonly input: IInputManager,
    private readonly audio: IAudioManager,
    private readonly changed: (
      voice: NonNullable<GameViewState['voice']>,
    ) => void,
  ) {}
  start(owner: { taskId: string; sessionId: string }) {
    if (this.operation) return;
    const operation = new AbortController();
    this.operation = operation;
    this.owner = owner;
    this.audio.stopAll();
    this.audio.setSession('play-and-record');
    this.changed({ status: 'REQUESTING' });
    void this.recorder
      .start(operation.signal)
      .then(() => {
        if (this.operation !== operation) return;
        this.recording = true;
        this.changed({ status: 'RECORDING' });
        this.timer = setTimeout(() => this.stop(), 5000);
      })
      .catch((error: unknown) => this.failed(operation, error));
  }
  stop() {
    const operation = this.operation;
    const owner = this.owner;
    if (!operation || !owner || !this.recording) return;
    this.recording = false;
    clearTimeout(this.timer);
    this.changed({ status: 'RECOGNIZING' });
    void this.recorder
      .stop()
      .then(async (audio) => {
        if (this.operation !== operation) return;
        this.audio.setSession('playback');
        const result = await this.recognizer.recognize({
          audio,
          language: 'en-GB',
          signal: operation.signal,
        });
        if (this.operation !== operation) return;
        this.cancel();
        this.input.dispatch({
          type: 'VOICE',
          source: 'VOICE',
          ...owner,
          ...result,
          timestamp: Date.now(),
        });
      })
      .catch((error: unknown) => this.failed(operation, error));
  }
  private failed(operation: AbortController, error: unknown) {
    if (this.operation !== operation) return;
    const owner = this.owner;
    const code = error instanceof SpeechFailure ? error.code : 'SERVICE_ERROR';
    this.cancel();
    if (!owner || code === 'CANCELLED') return;
    const reason: UnrecognizedReason =
      code === 'SERVICE_ERROR' ? 'ERROR' : code;
    this.changed({ status: 'IDLE', failure: reason });
    this.input.dispatch({
      type: 'VOICE',
      source: 'VOICE',
      ...owner,
      failure: reason,
      timestamp: Date.now(),
    });
  }
  cancel() {
    const operation = this.operation;
    this.operation = undefined;
    this.owner = undefined;
    this.recording = false;
    clearTimeout(this.timer);
    operation?.abort();
    this.recorder.cancel();
    this.audio.setSession('playback');
    this.changed({ status: 'IDLE' });
  }
}

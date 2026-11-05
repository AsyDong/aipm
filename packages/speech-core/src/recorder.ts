import type { IVoiceRecorder } from '@english/contracts';
import { SpeechFailure, speechOperation } from './service';

const FORMATS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

/** One short, in-memory recording. Created lazily by an explicit Record action. */
export class VoiceRecorder implements IVoiceRecorder {
  private session: AbortController | undefined;
  private recorder: MediaRecorder | undefined;
  private result: Promise<Blob> | undefined;
  private reject: ((error: SpeechFailure) => void) | undefined;
  private cleanup = () => {};

  constructor(private readonly maxDurationMs = 5000) {
    if (
      !Number.isFinite(maxDurationMs) ||
      maxDurationMs <= 0 ||
      maxDurationMs > 10000
    )
      throw new RangeError('Recording limit must be between 0 and 10000 ms');
  }

  async start(signal: AbortSignal) {
    if (this.session) throw new SpeechFailure('SERVICE_ERROR');
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    )
      throw new SpeechFailure('UNSUPPORTED');
    const session = new AbortController();
    this.session = session;
    const cancel = () => {
      if (this.session === session) this.cancel();
    };
    signal.addEventListener('abort', cancel, { once: true });
    this.cleanup = () => signal.removeEventListener('abort', cancel);
    if (signal.aborted) this.cancel();
    try {
      const stream = await speechOperation(
        session.signal,
        15000,
        async (pending) => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            // A permission prompt can outlive cancellation; never leak its eventual stream.
            if (pending.aborted) {
              stream.getTracks().forEach((track) => track.stop());
              throw new SpeechFailure('CANCELLED');
            }
            return stream;
          } catch (error) {
            if (
              error instanceof DOMException &&
              (error.name === 'NotAllowedError' ||
                error.name === 'SecurityError')
            )
              throw new SpeechFailure('PERMISSION_DENIED');
            throw error;
          }
        },
      );
      if (session.signal.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        throw new SpeechFailure('CANCELLED');
      }
      const previousCleanup = this.cleanup;
      const timer: { id?: ReturnType<typeof setTimeout> } = {};
      const cleanup = () => {
        clearTimeout(timer.id);
        stream.getTracks().forEach((track) => track.stop());
        previousCleanup();
      };
      this.cleanup = cleanup;
      const mimeType = FORMATS.find((format) =>
        MediaRecorder.isTypeSupported(format),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      this.recorder = recorder;
      const chunks: Blob[] = [];
      this.result = new Promise<Blob>((resolve, reject) => {
        this.reject = reject;
        recorder.ondataavailable = (event) => {
          if (!session.signal.aborted && event.data.size)
            chunks.push(event.data);
        };
        recorder.onerror = () => {
          reject(new SpeechFailure('SERVICE_ERROR'));
          if (this.session === session) this.cancel();
        };
        recorder.onstop = () => {
          cleanup();
          if (session.signal.aborted) return;
          const blob = new Blob(chunks, { type: recorder.mimeType });
          chunks.length = 0;
          if (!blob.size) reject(new SpeechFailure('NO_SPEECH'));
          else resolve(blob);
        };
      });
      // Auto-stop/cancel may happen before the consumer calls stop().
      void this.result.catch(() => {});
      recorder.start();
      timer.id = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, this.maxDurationMs);
    } catch (error) {
      if (this.session === session) this.cancel();
      throw error instanceof SpeechFailure
        ? error
        : new SpeechFailure('SERVICE_ERROR');
    }
  }

  async stop() {
    if (!this.result || !this.recorder) throw new SpeechFailure('NO_SPEECH');
    const result = this.result;
    const session = this.session!;
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    try {
      return await speechOperation(session.signal, 2000, () => result);
    } finally {
      if (this.session === session) this.cancel();
    }
  }

  cancel() {
    this.session?.abort();
    this.reject?.(new SpeechFailure('CANCELLED'));
    if (this.recorder && this.recorder.state !== 'inactive')
      this.recorder.stop();
    this.cleanup();
    this.cleanup = () => {};
    this.session = undefined;
    this.recorder = undefined;
    this.result = undefined;
    this.reject = undefined;
  }
}

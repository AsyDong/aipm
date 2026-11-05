import type {
  ISpeechRecognizer,
  ISpeechService,
  ISpeechSynthesizer,
  SpeechErrorCode,
  SpeechRecognitionRequest,
  SpeechSynthesisRequest,
} from '@english/contracts';

export class SpeechFailure extends Error {
  constructor(readonly code: SpeechErrorCode) {
    super(code);
    this.name = 'SpeechFailure';
  }
}

/** Bounds even providers that fail to settle after cancellation. */
export async function speechOperation<T>(
  signal: AbortSignal,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new RangeError('Speech timeout must be positive');
  if (signal.aborted) throw new SpeechFailure('CANCELLED');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        const fail = (code: SpeechErrorCode) => {
          reject(new SpeechFailure(code));
          controller.abort();
        };
        cancel = () => fail('CANCELLED');
        signal.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => fail('TIMEOUT'), timeoutMs);
      }),
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new SpeechFailure('CANCELLED');
        return run(controller.signal);
      }),
    ]);
  } catch (error) {
    throw error instanceof SpeechFailure
      ? error
      : new SpeechFailure('SERVICE_ERROR');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    controller.abort();
  }
}

export class SpeechService implements ISpeechService {
  constructor(
    private readonly recognizer: ISpeechRecognizer,
    private readonly synthesizer?: ISpeechSynthesizer,
    private readonly timeoutMs = 10000,
  ) {}
  recognize(request: SpeechRecognitionRequest) {
    return speechOperation(request.signal, this.timeoutMs, async (signal) => {
      if (!request.audio.size) throw new SpeechFailure('NO_SPEECH');
      const result = await this.recognizer.recognize({ ...request, signal });
      if (
        typeof result?.text !== 'string' ||
        (result.confidence !== undefined &&
          (!Number.isFinite(result.confidence) ||
            result.confidence < 0 ||
            result.confidence > 1))
      )
        throw new SpeechFailure('SERVICE_ERROR');
      return result;
    });
  }
  synthesize(request: SpeechSynthesisRequest) {
    return speechOperation(request.signal, this.timeoutMs, (signal) => {
      if (!this.synthesizer) throw new SpeechFailure('UNSUPPORTED');
      return this.synthesizer.synthesize({ ...request, signal });
    });
  }
}

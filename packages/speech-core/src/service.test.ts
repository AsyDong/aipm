import { expect, it, vi } from 'vitest';
import { SpeechService } from './service';

const request = () => ({
  audio: new Blob(['voice'], { type: 'audio/webm' }),
  language: 'en-GB',
  signal: new AbortController().signal,
});

it('injects ASR and TTS independently and validates provider output', async () => {
  const recognize = vi
    .fn()
    .mockResolvedValue({ text: 'hello', confidence: 0.8 });
  const synthesize = vi.fn().mockResolvedValue(new Blob(['spoken']));
  const service = new SpeechService({ recognize }, { synthesize });
  await expect(service.recognize(request())).resolves.toEqual({
    text: 'hello',
    confidence: 0.8,
  });
  await expect(
    service.synthesize({
      text: 'hello',
      language: 'en-GB',
      signal: request().signal,
    }),
  ).resolves.toBeInstanceOf(Blob);
  recognize.mockResolvedValue({ text: 'hello', confidence: 100 });
  await expect(service.recognize(request())).rejects.toMatchObject({
    code: 'SERVICE_ERROR',
  });
  await expect(
    service.recognize({ ...request(), audio: new Blob() }),
  ).rejects.toMatchObject({ code: 'NO_SPEECH' });
});

it('settles hung providers on timeout and caller cancellation', async () => {
  const signals: AbortSignal[] = [];
  const service = new SpeechService(
    {
      recognize: ({ signal }) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    },
    undefined,
    10,
  );
  await expect(service.recognize(request())).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  expect(signals[0]?.aborted).toBe(true);
  const controller = new AbortController();
  const pending = service.recognize({
    ...request(),
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
});

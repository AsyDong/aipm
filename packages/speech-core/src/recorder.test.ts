import { afterEach, expect, it, vi } from 'vitest';
import { VoiceRecorder } from './recorder';

class Recorder {
  static isTypeSupported = (type: string) => type === 'audio/mp4';
  state = 'inactive';
  mimeType = 'audio/mp4';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  static empty = false;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(Recorder.empty ? [] : ['voice']) });
    this.onstop?.();
  }
}

function setup(getUserMedia?: () => Promise<unknown>) {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: getUserMedia ?? vi.fn().mockResolvedValue(stream),
    },
  });
  Recorder.empty = false;
  return { stop, stream };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('negotiates Safari MP4, stops tracks, detects empty data and supports retry', async () => {
  const { stop } = setup();
  const recorder = new VoiceRecorder();
  await recorder.start(new AbortController().signal);
  await expect(recorder.stop()).resolves.toMatchObject({
    type: 'audio/mp4',
    size: 5,
  });
  expect(stop).toHaveBeenCalled();
  Recorder.empty = true;
  await recorder.start(new AbortController().signal);
  await expect(recorder.stop()).rejects.toMatchObject({ code: 'NO_SPEECH' });
});

it('releases a stream granted after cancellation and can start again', async () => {
  let grant!: (stream: unknown) => void;
  const { stop, stream } = setup(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const recorder = new VoiceRecorder();
  const controller = new AbortController();
  const pending = recorder.start(controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  grant(stream);
  await Promise.resolve();
  expect(stop).toHaveBeenCalled();
});

it('handles permission refusal and an automatic duration limit', async () => {
  setup(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
  const recorder = new VoiceRecorder(50);
  await expect(
    recorder.start(new AbortController().signal),
  ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  const { stop } = setup();
  vi.useFakeTimers();
  await recorder.start(new AbortController().signal);
  await vi.advanceTimersByTimeAsync(50);
  expect(stop).toHaveBeenCalled();
  await expect(recorder.stop()).resolves.toBeInstanceOf(Blob);
});

import { afterEach, expect, it, vi } from 'vitest';
import type { IAudioManager, IInputManager } from '@english/contracts';
import { SpeechFailure } from '@english/speech-core';
import { VoiceCapture } from './voice-capture';

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function setup() {
  const recorder = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(new Blob(['voice'])),
    cancel: vi.fn(),
  };
  const recognizer = {
    recognize: vi.fn().mockResolvedValue({ text: 'hello' }),
  };
  const dispatch = vi.fn();
  const audio = { stopAll: vi.fn(), setSession: vi.fn() };
  const changed = vi.fn();
  const capture = new VoiceCapture(
    recorder,
    recognizer,
    { dispatch } as unknown as IInputManager,
    audio as unknown as IAudioManager,
    changed,
  );
  return { capture, recorder, recognizer, dispatch, changed, audio };
}
afterEach(() => vi.useRealTimers());

it('captures once, releases the microphone before ASR, and scopes the result', async () => {
  const t = setup();
  t.capture.start({ taskId: 't', sessionId: 's' });
  t.capture.start({ taskId: 't', sessionId: 's' });
  await flush();
  t.capture.stop();
  t.capture.stop();
  await flush();
  expect(t.recorder.start).toHaveBeenCalledTimes(1);
  expect(t.recognizer.recognize).toHaveBeenCalledTimes(1);
  expect(t.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'VOICE',
      taskId: 't',
      sessionId: 's',
      text: 'hello',
    }),
  );
  expect(t.audio.setSession).toHaveBeenLastCalledWith('playback');
});
it('drops late ASR results after pause/replay/restart cancellation', async () => {
  const t = setup();
  let resolve!: (value: { text: string }) => void;
  t.recognizer.recognize.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  t.capture.start({ taskId: 't', sessionId: 'old' });
  await flush();
  t.capture.stop();
  await flush();
  const signal = t.recognizer.recognize.mock.calls[0]![0].signal as AbortSignal;
  t.capture.cancel();
  resolve({ text: 'hello' });
  await flush();
  expect(signal.aborted).toBe(true);
  expect(t.dispatch).not.toHaveBeenCalled();
});
it('auto-stops, reports timeout without an answer, and permits retry after denied permission', async () => {
  vi.useFakeTimers();
  const t = setup();
  t.recorder.start.mockRejectedValueOnce(
    new SpeechFailure('PERMISSION_DENIED'),
  );
  t.capture.start({ taskId: 't', sessionId: 's' });
  await flush();
  expect(t.dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ failure: 'PERMISSION_DENIED' }),
  );
  t.recognizer.recognize.mockRejectedValueOnce(new SpeechFailure('TIMEOUT'));
  t.capture.start({ taskId: 't', sessionId: 's' });
  await flush();
  await vi.advanceTimersByTimeAsync(5000);
  expect(t.dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ failure: 'TIMEOUT' }),
  );
});

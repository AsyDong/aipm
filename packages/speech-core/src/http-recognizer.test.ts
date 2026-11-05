import { afterEach, expect, it, vi } from 'vitest';
import { HttpSpeechRecognizer } from './http-recognizer';

afterEach(() => vi.unstubAllGlobals());
it('preserves a backend deadline as a retryable timeout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('{}', { status: 504 })),
  );
  await expect(
    new HttpSpeechRecognizer().recognize({
      audio: new Blob(['voice']),
      language: 'en-GB',
      signal: new AbortController().signal,
    }),
  ).rejects.toMatchObject({ code: 'TIMEOUT' });
});
it('sends encoded audio and language without an expected answer or credential', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ text: 'hello', confidence: 0.9 })),
    );
  vi.stubGlobal('fetch', fetch);
  const signal = new AbortController().signal;
  await expect(
    new HttpSpeechRecognizer().recognize({
      audio: new Blob(['voice'], { type: 'audio/mp4' }),
      language: 'en-GB',
      signal,
    }),
  ).resolves.toEqual({ text: 'hello', confidence: 0.9 });
  const options = fetch.mock.calls[0]![1] as RequestInit;
  expect([...(options.body as FormData).keys()]).toEqual(['audio', 'language']);
  expect(options.signal).toBe(signal);
  expect(options.redirect).toBe('error');
  expect(() => new HttpSpeechRecognizer('https://other.example/asr')).toThrow(
    'same-origin',
  );
  fetch.mockResolvedValue(
    new Response(JSON.stringify({ text: 'hello', confidence: 'high' })),
  );
  await expect(
    new HttpSpeechRecognizer().recognize({
      audio: new Blob(['voice']),
      language: 'en',
      signal,
    }),
  ).rejects.toMatchObject({ code: 'SERVICE_ERROR' });
});

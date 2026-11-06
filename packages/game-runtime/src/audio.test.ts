import { afterEach, expect, it, vi } from 'vitest';
import { AudioManager } from './audio';
import type { AssetManager } from './assets';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('uses the iOS playback session and fails instead of hanging when playback never ends', async () => {
  vi.useFakeTimers();
  const session = { type: 'auto' };
  vi.stubGlobal('navigator', { audioSession: session });
  const source = {
    buffer: null,
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
    onended: null,
  };
  class FakeContext {
    state = 'running';
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return { gain: { value: 1 }, connect() {} };
    }
    createBufferSource() {
      return source;
    }
    decodeAudioData() {
      return Promise.resolve({ duration: 1 });
    }
    close() {
      return Promise.resolve();
    }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('fetch', async () => ({
    arrayBuffer: async () => new ArrayBuffer(1),
  }));
  const assets = {
    resolve: async () => ({ url: '/a.mp3' }),
    get: () => ({ url: '/a.mp3' }),
    reload: async () => {},
  } as unknown as AssetManager;
  const audio = new AudioManager(assets);
  audio.unlock();
  expect(session.type).toBe('playback');
  const result = audio.play('a').then(
    () => 'ended',
    (error: Error) => error.message,
  );
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await result).toBe('Audio timed out');
  await audio.destroy();
  await audio.destroy();
  expect(() => audio.stopAll()).not.toThrow();
});

it('switches the iOS audio session between playback and play-and-record', () => {
  const session = { type: 'auto' };
  vi.stubGlobal('navigator', { audioSession: session });
  const audio = new AudioManager({} as unknown as AssetManager);
  audio.setSession('play-and-record');
  expect(session.type).toBe('play-and-record');
  audio.setSession('playback');
  expect(session.type).toBe('playback');
});

it('does not fail where audioSession is unsupported', () => {
  vi.stubGlobal('navigator', {});
  const audio = new AudioManager({} as unknown as AssetManager);
  expect(() => audio.setSession('play-and-record')).not.toThrow();
});

import type { IAudioManager } from '@english/contracts';
import { AssetManager } from './assets';

/** Resume synchronously from a user gesture; decode prompts before playback. */
export class AudioManager implements IAudioManager {
  private context: AudioContext | undefined;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private source: AudioBufferSourceNode | undefined;
  private gain: GainNode | undefined;
  private cancel: (() => void) | undefined;
  private generation = 0;
  private disposed = false;
  private fallback: HTMLAudioElement | undefined;
  private fallbackCancel: (() => void) | undefined;
  private unlocking: Promise<void> | undefined;
  private failed = new Set<string>();
  constructor(private assets: AssetManager) {}
  unlock() {
    if (this.disposed) return;
    if (typeof AudioContext === 'undefined') {
      this.fallback ??= new Audio();
      return;
    }
    // iOS 16.4+: without this, the ringer switch silences Web Audio entirely.
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession;
    if (session) session.type = 'playback';
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    this.unlocking = this.context.resume();
    void this.unlocking.catch(() => {});
  }
  async play(key: string) {
    try {
      if (this.failed.has(key)) {
        await this.assets.reload(key);
        this.buffers.delete(key);
        this.failed.delete(key);
      }
      await this.playLoaded(key);
    } catch (error) {
      if (!this.disposed) this.failed.add(key);
      throw error;
    }
  }
  private async playLoaded(key: string) {
    if (this.disposed) throw new Error('Audio destroyed');
    this.stopAll();
    const generation = this.generation;
    if (this.fallback) {
      const player = this.fallback;
      const asset = await this.assets.resolve(key);
      if (!asset) throw new Error(`Missing audio: ${key}`);
      if (this.disposed || generation !== this.generation) return;
      const bytes = new Uint8Array(
        await (await fetch(asset.url)).arrayBuffer(),
      );
      if (this.disposed || generation !== this.generation) return;
      const mp3 =
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
        (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
      if (!mp3) throw new Error('Invalid MP3 prompt');
      // Windows WebKit cannot play blob URLs even when it can play the same
      // MP3 over HTTP. The original URL has already passed AssetManager checks.
      player.src = this.assets.get(key)!.url;
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const finish = (error?: Error) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          player.onended = null;
          player.onerror = null;
          this.fallbackCancel = undefined;
          if (error) reject(error);
          else resolve();
        };
        const timeout = setTimeout(() => {
          player.pause();
          finish(new Error('Audio timed out'));
        }, 10000);
        this.fallbackCancel = () => finish();
        player.onended = () => finish();
        player.onerror = () => finish(new Error('Audio unavailable'));
        void player
          .play()
          .catch(() => finish(new Error('Tap Listen to enable audio')));
      });
      return;
    }
    const context = this.context;
    await this.unlocking;
    if (!context || context.state !== 'running')
      throw new Error('Tap Listen to enable audio');
    let buffer = this.buffers.get(key);
    if (!buffer) {
      buffer = this.assets.resolve(key).then(async (asset) => {
        if (!asset) throw new Error(`Missing audio: ${key}`);
        const response = await fetch(asset.url);
        return context.decodeAudioData(await response.arrayBuffer());
      });
      this.buffers.set(key, buffer);
    }
    let decoded: AudioBuffer;
    try {
      decoded = await buffer;
    } catch (error) {
      this.buffers.delete(key);
      throw error;
    }
    if (this.disposed || generation !== this.generation) return;
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(this.gain!);
    this.source = source;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        source.onended = null;
        source.disconnect();
        if (this.source === source) {
          this.source = undefined;
          this.cancel = undefined;
        }
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      // A suspended/interrupted context never fires onended; fail so Listen can retry.
      const timer = setTimeout(
        () => {
          try {
            source.stop();
          } catch {
            /* already stopped */
          }
          cleanup();
          reject(new Error('Audio timed out'));
        },
        decoded.duration * 1000 + 3000,
      );
      this.cancel = finish;
      source.onended = finish;
      source.start();
    });
  }
  stopAll() {
    this.generation++;
    this.source?.stop();
    this.cancel?.();
    this.fallback?.pause();
    this.fallbackCancel?.();
  }
  setVolume(value: number) {
    if (this.fallback) this.fallback.volume = Math.max(0, Math.min(1, value));
    if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, value));
  }
  async destroy() {
    this.disposed = true;
    this.stopAll();
    this.buffers.clear();
    if (this.fallback) {
      this.fallback.removeAttribute('src');
      this.fallback.load();
    }
    await this.context?.close();
  }
}

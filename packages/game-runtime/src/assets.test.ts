import { describe, expect, it, vi } from 'vitest';
import { AssetManager } from './assets';
import { SceneManager } from './scene-manager';
import type { AssetReference, GameContext } from '@english/contracts';

const asset: AssetReference = {
  key: 'apple',
  type: 'IMAGE',
  url: '/apple.svg',
  version: '1.0.0',
};
describe('asset scope ownership', () => {
  it('deduplicates concurrent loads and releases only after final owner', async () => {
    const dispose = vi.fn();
    const load = vi.fn(async () => ({ asset, dispose }));
    const manager = new AssetManager(load);
    await Promise.all(
      ['scene', 'mechanic'].map((scope) =>
        manager.preload({ scope, assets: [asset] }),
      ),
    );
    expect(load).toHaveBeenCalledTimes(1);
    await manager.release('scene');
    expect(dispose).not.toHaveBeenCalled();
    await manager.release('mechanic');
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(manager.get('apple')).toBeUndefined();
  });
  it('retries once, rejects conflicts and allows retry after failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ asset, dispose: vi.fn() });
    const manager = new AssetManager(load);
    await manager.preload({ scope: 'one', assets: [asset] });
    expect(load).toHaveBeenCalledTimes(2);
    await expect(
      manager.preload({
        scope: 'other',
        assets: [{ ...asset, url: '/other.svg' }],
      }),
    ).rejects.toThrow('conflict');
    await manager.destroy();
    expect(manager.get('apple')).toBeUndefined();
  });
});
it('scene manager cleans and supports repeat load/start/pause/resume/unload', async () => {
  const plugin = {
    initialize: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  };
  const manager = new SceneManager(() => plugin);
  for (let i = 0; i < 2; i++) {
    await manager.load(
      { id: 'scene', version: '1.0.0', config: {} },
      {} as GameContext,
    );
    await manager.start();
    manager.pause();
    manager.resume();
    await manager.unload();
    await manager.unload();
    expect(manager.getCurrentScene()).toBeNull();
  }
  expect(plugin.destroy).toHaveBeenCalledTimes(2);
  expect(plugin.start).toHaveBeenCalledTimes(2);
});

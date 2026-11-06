import Phaser from 'phaser';
import { AssetManager, loadBrowserAsset } from './assets';
import { PhaserObjects } from './objects';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@english/contracts';
import type { AssetManifest } from '@english/contracts';

export function createViewport(parent: HTMLElement) {
  let disposed = false;
  let resolveScene: (scene: Phaser.Scene) => void;
  const ready = new Promise<Phaser.Scene>((resolve) => {
    resolveScene = resolve;
  });
  class ViewportScene extends Phaser.Scene {
    constructor() {
      super('adventure');
    }
    create() {
      resolveScene(this);
    }
  }
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    backgroundColor: '#86d3f0',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: ViewportScene,
    audio: { noAudio: true },
    banner: false,
  });
  // Phaser re-fits on window resize only; phones rotating (or a layout change around
  // the canvas) can leave it at the old size, so refit on every layout change.
  let refitFrame: number | undefined;
  const refit = () => {
    if (disposed || refitFrame !== undefined) return;
    refitFrame = requestAnimationFrame(() => {
      refitFrame = undefined;
      if (!disposed) game.scale.refresh();
    });
  };
  const watcher = new ResizeObserver(refit);
  watcher.observe(parent);
  addEventListener('orientationchange', refit);
  addEventListener('resize', refit);
  const assets = new AssetManager(loadBrowserAsset);
  let objects: PhaserObjects | undefined;
  return {
    ready: ready.then((scene) => {
      if (disposed) throw new Error('Viewport disposed');
      objects = new PhaserObjects(scene);
      return { scene, objects };
    }),
    assets,
    async preload(manifest: AssetManifest, scene: Phaser.Scene) {
      await assets.preload(manifest);
      if (disposed) return;
      const images = await Promise.all(
        manifest.assets
          .filter((asset) => asset.type === 'IMAGE')
          .map(async (asset) => {
            if (scene.textures.exists(asset.key)) return;
            const loaded = await assets.resolve(asset.key);
            if (!loaded) throw new Error(`Missing image: ${asset.key}`);
            const image = new Image();
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () =>
                reject(new Error(`Invalid image: ${asset.key}`));
              image.src = loaded.url;
            });
            if (!disposed) scene.textures.addImage(asset.key, image);
          }),
      );
      return images;
    },
    async destroy() {
      if (disposed) return;
      disposed = true;
      if (refitFrame !== undefined) cancelAnimationFrame(refitFrame);
      watcher.disconnect();
      removeEventListener('orientationchange', refit);
      removeEventListener('resize', refit);
      objects?.clear();
      game.destroy(true);
      game.canvas?.remove();
      await assets.destroy();
    },
  };
}

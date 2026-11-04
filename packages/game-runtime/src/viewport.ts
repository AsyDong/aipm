import Phaser from 'phaser';
import { AssetManager, loadBrowserAsset } from './assets';
import { PhaserObjects } from './objects';
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
    width: 960,
    height: 540,
    backgroundColor: '#263e37',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: ViewportScene,
    audio: { noAudio: true },
    banner: false,
  });
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
      objects?.clear();
      game.destroy(true);
      game.canvas?.remove();
      await assets.destroy();
    },
  };
}

import Phaser from 'phaser';
import type { BootstrapRuntimePort } from '@english/contracts';
import { FruitWorldScene } from '@english/game-scenes';
import { createViewport } from './viewport';

export function createFruitPreview(
  parent: HTMLElement,
  port: BootstrapRuntimePort,
  onError: (error: unknown) => void,
) {
  const viewport = createViewport(parent);
  let disposed = false;
  let scenePlugin: FruitWorldScene | undefined;
  let off = () => {};
  void viewport.ready
    .then(async ({ scene, objects }) => {
      if (disposed) return;
      scenePlugin = new FruitWorldScene(scene);
      scenePlugin.createBackdrop({});
      const candidates = ['apple', 'banana', 'orange'].map((text) => ({
        id: text,
        text,
        curriculumId: 'demo',
        unitId: 'fruit',
        assets: { image: text, audio: text },
        source: {
          kind: 'DEMO' as const,
          reference: 'Independent scene preview',
        },
      }));
      await viewport.preload(
        {
          scope: 'preview',
          assets: candidates.map((content) => ({
            key: content.id,
            type: 'IMAGE',
            url: `/images/${content.id}.svg`,
            version: '1.0.0',
          })),
        },
        scene,
      );
      if (disposed) return;
      objects.show({
        id: 'preview',
        curriculumId: 'demo',
        unitId: 'fruit',
        target: candidates[0]!,
        candidates,
      });
      off = port.onCommand((command) => {
        if (command.type === 'PAUSE') scenePlugin?.pause();
        else scenePlugin?.resume();
        port.publish({
          type: 'STATE_CHANGED',
          state: command.type === 'PAUSE' ? 'PAUSED' : 'RUNNING',
        });
      });
      port.publish({ type: 'READY' });
      port.publish({ type: 'STATE_CHANGED', state: 'RUNNING' });
    })
    .catch((error) => {
      if (!disposed) onError(error);
    });
  return () => {
    disposed = true;
    off();
    scenePlugin?.destroy();
    void viewport.destroy();
  };
}

/** A neutral moving canvas verifies the host integration; it is not a game scene plugin. */
export function createPhaserBootstrap(
  parent: HTMLElement,
  port: BootstrapRuntimePort,
) {
  let disposed = false;
  let ready = false;
  let removeCommandListener = () => {};

  class BootstrapScene extends Phaser.Scene {
    constructor() {
      super('bootstrap');
    }

    create() {
      if (disposed) return;
      this.cameras.main.setBackgroundColor('#142e35');
      const graphics = this.add.graphics();
      graphics.lineStyle(1, 0x33545a, 0.7);
      for (let x = 40; x < 960; x += 80) {
        for (let y = 40; y < 540; y += 80) graphics.strokeCircle(x, y, 2);
      }
      graphics.lineStyle(2, 0x45676a);
      graphics.strokeCircle(480, 270, 152);
      graphics.strokeCircle(480, 270, 104);
      const marker = this.add.circle(480, 118, 14, 0xe8bb70);
      this.tweens.add({
        targets: marker,
        y: 422,
        duration: 2800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      this.add
        .text(480, 245, 'A world of words', {
          fontFamily: 'sans-serif',
          fontSize: '32px',
          color: '#f4eddf',
        })
        .setOrigin(0.5);
      this.add
        .text(480, 290, 'Your adventure starts here.', {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: '#aac4c5',
        })
        .setOrigin(0.5);
      removeCommandListener = port.onCommand((command) => {
        if (disposed) return;
        if (command.type === 'PAUSE' && !this.scene.isPaused()) {
          this.scene.pause();
          port.publish({ type: 'STATE_CHANGED', state: 'PAUSED' });
        } else if (command.type === 'RESUME' && this.scene.isPaused()) {
          this.scene.resume();
          port.publish({ type: 'STATE_CHANGED', state: 'RUNNING' });
        }
      });
      ready = true;
      port.publish({ type: 'READY' });
      port.publish({ type: 'STATE_CHANGED', state: 'RUNNING' });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 540,
    backgroundColor: '#142e35',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: BootstrapScene,
    audio: { noAudio: true },
    banner: false,
  });

  return () => {
    if (disposed) return;
    disposed = true;
    removeCommandListener();
    // Phaser releases its systems on the next frame through its public API.
    // Detach the canvas immediately so unmount never leaves visible content.
    game.destroy(true);
    game.canvas?.remove();
    if (ready) port.publish({ type: 'STATE_CHANGED', state: 'DESTROYED' });
  };
}

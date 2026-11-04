import Phaser from 'phaser';
import type { BootstrapRuntimePort } from '@english/contracts';

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

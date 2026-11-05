import type Phaser from 'phaser';
import type { IInputAdapter, InputSource } from '@english/contracts';

/**
 * The only place that reads Phaser pointers. Coordinates are already in game-world
 * space (worldX/worldY), so mechanics never touch DOM or device events.
 */
class PointerAdapter implements IInputAdapter {
  readonly sources: InputSource[];
  private off = () => {};
  constructor(
    private scene: Phaser.Scene,
    private source: 'TOUCH' | 'MOUSE',
  ) {
    this.sources = [source];
  }
  start(emit: Parameters<IInputAdapter['start']>[0]) {
    const handler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch !== (this.source === 'TOUCH')) return;
      emit({
        type: 'TAP',
        source: this.source,
        x: pointer.worldX,
        y: pointer.worldY,
        timestamp: Date.now(),
      });
    };
    this.scene.input.on('pointerup', handler);
    this.off = () => this.scene.input.off('pointerup', handler);
  }
  stop() {
    this.off();
    this.off = () => {};
  }
}

export const createTouchAdapter = (scene: Phaser.Scene): IInputAdapter =>
  new PointerAdapter(scene, 'TOUCH');
export const createMouseAdapter = (scene: Phaser.Scene): IInputAdapter =>
  new PointerAdapter(scene, 'MOUSE');

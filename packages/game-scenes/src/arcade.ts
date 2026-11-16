import Phaser from 'phaser';
import type { GameContext, IScenePlugin } from '@english/contracts';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@english/contracts';
import { fruitWorldBackground } from './metadata';

/** Art and lifecycle only; every interaction is behind the objects contract. */
export class ArcadeWorldScene implements IScenePlugin {
  private background: Phaser.GameObjects.Image | undefined;
  private shade: Phaser.GameObjects.Rectangle | undefined;
  private context: GameContext | undefined;
  constructor(private scene: Phaser.Scene) {}

  initialize(context: GameContext, config: Record<string, unknown>) {
    this.context = context;
    if (!context.objects.startArcade)
      throw new Error('Arcade World needs the arcade renderer');
    this.background = this.scene.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, fruitWorldBackground(config))
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setDepth(-20);
    this.shade = this.scene.add
      .rectangle(640, 360, 1280, 720, 0x164d63, 0.24)
      .setDepth(-19);
    context.eventBus.emit('SCENE_LOADED', { sceneId: 'arcade-world' }, 'scene');
  }
  start() {
    this.context?.eventBus.emit(
      'SCENE_STARTED',
      { sceneId: 'arcade-world' },
      'scene',
    );
  }
  pause() {
    this.scene.scene.pause();
  }
  resume() {
    this.scene.scene.resume();
  }
  destroy() {
    this.context?.objects.clear();
    this.background?.destroy();
    this.shade?.destroy();
    this.context?.eventBus.emit(
      'SCENE_DESTROYED',
      { sceneId: 'arcade-world' },
      'scene',
    );
    this.context = undefined;
  }
}

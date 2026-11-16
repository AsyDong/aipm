import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@english/contracts';
import type { GameContext, IScenePlugin } from '@english/contracts';
import { fruitCatchAssets, fruitCatchTheme } from './catch-metadata';

/** The orchard supplies art only; movement and collisions live behind ISceneObjects. */
export class FruitCatchScene implements IScenePlugin {
  private background: Phaser.GameObjects.Image | undefined;
  private context: GameContext | undefined;
  constructor(private scene: Phaser.Scene) {}

  initialize(context: GameContext) {
    this.context = context;
    if (!context.objects.configureCatch)
      throw new Error('Fruit Catch needs the action object renderer');
    this.background = this.scene.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, '/images/scenes/market.webp')
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setDepth(-10);
    context.objects.configureCatch(fruitCatchTheme);
    context.eventBus.emit('SCENE_LOADED', { sceneId: 'catch-world' }, 'scene');
  }

  start() {
    this.context?.eventBus.emit(
      'SCENE_STARTED',
      { sceneId: 'catch-world' },
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
    this.background = undefined;
    this.context?.eventBus.emit(
      'SCENE_DESTROYED',
      { sceneId: 'catch-world' },
      'scene',
    );
    this.context = undefined;
  }
}

export { fruitCatchAssets };

import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@english/contracts';
import type { GameContext, IScenePlugin } from '@english/contracts';
import { fruitWorldBackground, fruitWorldShelf } from './metadata';

/** Draws the storybook backdrop. Fruit and feedback belong to the runtime's object facade. */
export class FruitWorldScene implements IScenePlugin {
  private background: Phaser.GameObjects.Image | undefined;
  private context: GameContext | undefined;
  constructor(private scene: Phaser.Scene) {}
  initialize(context: GameContext, config: Record<string, unknown>) {
    this.context = context;
    this.background = this.scene.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, fruitWorldBackground(config))
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setDepth(-10);
    const shelf = fruitWorldShelf(config);
    context.objects.setShelf(shelf.centerX, shelf.baseY);
    context.eventBus.emit('SCENE_LOADED', { sceneId: 'fruit-world' }, 'scene');
  }
  start() {
    this.context?.eventBus.emit(
      'SCENE_STARTED',
      { sceneId: 'fruit-world' },
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
      { sceneId: 'fruit-world' },
      'scene',
    );
    this.context = undefined;
  }
}

import Phaser from 'phaser';
import type {
  GameContext,
  IScenePlugin,
  PluginMetadata,
} from '@english/contracts';

export const fruitWorldMetadata: PluginMetadata = {
  id: 'fruit-world',
  name: 'Fruit World',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'SCENE',
  requiredCapabilities: [],
  capabilities: ['OBJECTS', 'ANIMATION', 'HIT_TEST'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { theme: { enum: ['ORCHARD', 'FOREST'] } },
  },
};

export class FruitWorldScene implements IScenePlugin {
  private background: Phaser.GameObjects.Container | undefined;
  private context: GameContext | undefined;
  constructor(private scene: Phaser.Scene) {}
  initialize(context: GameContext, config: Record<string, unknown>) {
    this.context = context;
    this.createBackdrop(config);
    context.eventBus.emit('SCENE_LOADED', { sceneId: 'fruit-world' }, 'scene');
  }
  /** Also used by the independent scene preview, before mechanics exist. */
  createBackdrop(config: Record<string, unknown>) {
    const forest = config.theme === 'FOREST';
    this.scene.cameras.main.setBackgroundColor(forest ? '#234b46' : '#263e37');
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(forest ? 0x355b51 : 0x3a5141);
    graphics.fillEllipse(480, 590, 1400, 450);
    graphics.fillStyle(0x78916a, 0.16);
    graphics.fillEllipse(180, 550, 650, 320);
    graphics.fillStyle(0xe9c883, 0.1);
    graphics.fillCircle(820, 70, 130);
    graphics.lineStyle(1, 0xa8bc8c, 0.2);
    for (let y = 405; y < 540; y += 32) graphics.lineBetween(0, y, 960, y);
    const label = this.scene.add.text(
      40,
      28,
      forest ? 'THE WOODLAND' : 'THE ORCHARD',
      {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#c5d1b8',
        letterSpacing: 3,
      },
    );
    const fireflies = Array.from({ length: 7 }, (_, i) => {
      const dot = this.scene.add.circle(
        60 + i * 145,
        80 + (i % 3) * 100,
        2,
        0xeacb81,
        0.5,
      );
      this.scene.tweens.add({
        targets: dot,
        y: dot.y - 15,
        alpha: 0.1,
        yoyo: true,
        repeat: -1,
        duration: 1800 + i * 250,
      });
      return dot;
    });
    this.background = this.scene.add
      .container(0, 0, [graphics, label, ...fireflies])
      .setDepth(-10);
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
    for (const child of this.background?.list ?? [])
      this.scene.tweens.killTweensOf(child);
    this.background?.destroy(true);
    this.background = undefined;
    this.context?.eventBus.emit(
      'SCENE_DESTROYED',
      { sceneId: 'fruit-world' },
      'scene',
    );
    this.context = undefined;
  }
}

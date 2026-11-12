import Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '@english/contracts';
import type { GameContext, IScenePlugin } from '@english/contracts';
import {
  fruitWorldBackground,
  fruitWorldPlace,
  fruitWorldShelf,
  type PlaceLayout,
} from './metadata';

/**
 * Draws the storybook backdrop and the stop's collection place. Solved items
 * visibly land in the basket, on the shelf, on the plate, at a friend's spot
 * or in the box; the scene learns this from events, never from the mechanic.
 */
export class FruitWorldScene implements IScenePlugin {
  private background: Phaser.GameObjects.Image | undefined;
  private context: GameContext | undefined;
  private props: Phaser.GameObjects.Image[] = [];
  private offs: (() => void)[] = [];
  private place: PlaceLayout | undefined;
  private box: Phaser.GameObjects.Image | undefined;
  private rounds = 0;
  private solved = 0;
  constructor(private scene: Phaser.Scene) {}
  initialize(context: GameContext, config: Record<string, unknown>) {
    this.context = context;
    this.background = this.scene.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, fruitWorldBackground(config))
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setDepth(-10);
    const shelf = fruitWorldShelf(config);
    context.objects.setShelf(shelf.centerX, shelf.baseY);
    this.place = fruitWorldPlace(config);
    const place = this.place;
    if (place?.prop) {
      const prop = place.prop;
      const image = this.scene.add
        .image(prop.x, prop.y, prop.image)
        .setDisplaySize(prop.width, prop.height)
        .setDepth(-4);
      this.track(image);
      if (place.kind === 'BASKET') {
        const source = image.texture.getSourceImage();
        const front = this.scene.add
          .image(prop.x, prop.y, prop.image)
          .setDisplaySize(prop.width, prop.height)
          .setDepth(5);
        // Same texture and geometry: the rim and front wall occlude landed fruit.
        front.setCrop(
          0,
          source.height * 0.2,
          source.width,
          source.height * 0.8,
        );
        this.track(front);
      }
    }
    if (place?.kind === 'BOX' && config.box) {
      const rect = config.box as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      this.box = this.scene.add
        .image(rect.x, rect.y, '/images/props/box.webp')
        .setDisplaySize(rect.width, rect.height)
        .setDepth(-3);
      this.track(this.box);
    }
    for (const character of place?.characters ?? []) {
      const image = this.scene.add
        .image(character.x, character.y, character.image)
        .setDepth(-3);
      image.setScale(character.height / image.height);
      this.track(image);
    }
    if (place) {
      this.offs.push(
        context.eventBus.on('TASK_PRESENTED', () => {
          this.rounds++;
          if (place.kind === 'CHARACTERS') this.bounce(this.requesterImage());
        }),
        context.eventBus.on('AUDIO_PLAYED', () => {
          if (place.kind === 'CHARACTERS') this.bounce(this.requesterImage());
        }),
        context.eventBus.on('ANSWER_CORRECT', (event) => {
          if (place.kind === 'BOX') {
            this.bounce(this.box);
            return;
          }
          const object = context.objects.findByContent(event.payload.contentId);
          if (!object) return;
          const slot =
            place.slots[Math.min(this.solved, place.slots.length - 1)];
          this.solved++;
          if (slot) context.objects.collect?.(object.objectId, slot);
        }),
        context.eventBus.on('ANSWER_INCORRECT', () => {
          // A wrongly packed box goes back to empty so the child can try again.
          if (place.kind === 'BOX') context.objects.clearCollected?.();
        }),
      );
    }
    context.eventBus.emit('SCENE_LOADED', { sceneId: 'fruit-world' }, 'scene');
  }
  private track(image: Phaser.GameObjects.Image) {
    image.setData('baseScale', image.scaleX);
    this.props.push(image);
  }
  /** Picnic: friends take turns asking, one per round. */
  private requester() {
    return (this.rounds - 1) % (this.place?.characters?.length ?? 1);
  }
  private requesterImage() {
    const index = this.requester();
    return this.place?.characters?.length
      ? this.props[this.props.length - this.place.characters.length + index]
      : undefined;
  }
  private bounce(image: Phaser.GameObjects.Image | undefined) {
    if (!image) return;
    const base =
      (image.getData('baseScale') as number | undefined) ?? image.scaleX;
    this.scene.tweens.killTweensOf(image);
    image.setScale(base);
    this.scene.tweens.add({
      targets: image,
      scaleX: base * 1.08,
      scaleY: base * 1.08,
      yoyo: true,
      duration: 180,
      ease: 'Sine.inOut',
    });
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
    for (const off of this.offs.splice(0)) off();
    for (const prop of this.props.splice(0)) prop.destroy();
    this.box = undefined;
    this.context?.objects.clear();
    this.background?.destroy();
    this.background = undefined;
    this.place = undefined;
    this.context?.eventBus.emit(
      'SCENE_DESTROYED',
      { sceneId: 'fruit-world' },
      'scene',
    );
    this.context = undefined;
  }
}

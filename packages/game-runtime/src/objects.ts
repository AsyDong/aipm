import Phaser from 'phaser';
import type { ISceneObjects, SceneItem, SceneObject } from '@english/contracts';

interface Slot {
  model: SceneObject;
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Ellipse;
}

/** Places fruit on the counter, animates feedback, and answers hit tests. */
export class PhaserObjects implements ISceneObjects {
  private slots: Slot[] = [];
  private centerX = 640;
  private baseY = 520;
  constructor(private scene: Phaser.Scene) {}
  setShelf(centerX: number, baseY: number) {
    this.centerX = centerX;
    this.baseY = baseY;
  }
  show(items: SceneItem[]) {
    this.clear();
    const count = items.length;
    const size = count <= 3 ? 210 : count === 4 ? 180 : 150;
    const spacing = size + 30;
    items.forEach((item, index) => {
      const x = this.centerX + (index - (count - 1) / 2) * spacing;
      const y = this.baseY - size / 2;
      const plate = this.scene.add
        .ellipse(x, this.baseY + 8, size * 0.95, 30, 0x000000, 0.25)
        .setDepth(1);
      const fruit = this.scene.add
        .image(0, 0, item.image)
        .setDisplaySize(size, size);
      const container = this.scene.add
        .container(x, y - 280, [fruit])
        .setDepth(2)
        .setAlpha(0);
      const model: SceneObject = {
        objectId: item.objectId,
        contentId: item.contentId,
        x,
        y,
        width: size + 20,
        height: size + 40,
      };
      this.slots.push({ model, container, plate });
      // Drop in with a bounce, then bob gently while waiting.
      this.scene.tweens.add({
        targets: container,
        y,
        alpha: 1,
        duration: 520,
        delay: index * 110,
        ease: 'Bounce.easeOut',
        onComplete: () =>
          this.scene.tweens.add({
            targets: container,
            y: y - 6,
            duration: 1500 + index * 220,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
          }),
      });
    });
  }
  hitTest(x: number, y: number) {
    return this.slots.find(
      ({ model }) =>
        Math.abs(x - model.x) <= model.width / 2 &&
        Math.abs(y - model.y) <= model.height / 2,
    )?.model;
  }
  findByContent(contentId: string) {
    return this.slots.find(({ model }) => model.contentId === contentId)?.model;
  }
  feedback(objectId: string, kind: 'CORRECT' | 'RETRY' | 'HINT') {
    const slot = this.slots.find(({ model }) => model.objectId === objectId);
    if (!slot) return;
    const { container, plate, model } = slot;
    if (kind === 'HINT') {
      // A bright gold plate under the right fruit: kind and visible, never scolding.
      plate.setFillStyle(0xffd21f, 1);
      this.scene.tweens.add({
        targets: container,
        scaleX: 1.12,
        scaleY: 1.12,
        yoyo: true,
        repeat: 2,
        duration: 260,
        ease: 'Sine.inOut',
      });
    } else if (kind === 'RETRY') {
      // A small wobble means "not this one"; no red and no penalty colour.
      this.scene.tweens.add({
        targets: container,
        x: model.x + 14,
        yoyo: true,
        repeat: 2,
        duration: 70,
      });
    } else {
      plate.setFillStyle(0x7ddc5a, 0.85);
      this.scene.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        yoyo: true,
        duration: 240,
        ease: 'Back.easeOut',
      });
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI * 2) / 10;
        const star = this.scene.add
          .star(model.x, model.y, 5, 6, 14, 0xffd21f)
          .setDepth(3);
        this.scene.tweens.add({
          targets: star,
          x: model.x + Math.cos(angle) * 170,
          y: model.y + Math.sin(angle) * 140,
          alpha: 0,
          angle: 180,
          duration: 700,
          ease: 'Cubic.easeOut',
          onComplete: () => star.destroy(),
        });
      }
    }
  }
  clear() {
    for (const { container, plate } of this.slots) {
      this.scene.tweens.killTweensOf(container);
      container.destroy(true);
      plate.destroy();
    }
    this.slots = [];
  }
}

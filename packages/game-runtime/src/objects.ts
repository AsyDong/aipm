import Phaser from 'phaser';
import type { ISceneObjects, SceneItem, SceneObject } from '@english/contracts';

interface Slot {
  model: SceneObject;
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Ellipse;
  image: string;
  cut: boolean;
  collected: boolean;
}

/** Places fruit on the counter, animates feedback, and answers hit tests. */
export class PhaserObjects implements ISceneObjects {
  private slots: Slot[] = [];
  private collected: Phaser.GameObjects.Image[] = [];
  private centerX = 640;
  private baseY = 520;
  constructor(private scene: Phaser.Scene) {}
  setShelf(centerX: number, baseY: number) {
    this.centerX = centerX;
    this.baseY = baseY;
  }
  show(items: SceneItem[]) {
    this.clearSlots();
    // A LARGE item is the question picture: it stands apart, left of the shelf.
    const featured = items.find((item) => item.size === 'LARGE');
    const row = items.filter((item) => item !== featured);
    const count = row.length;
    const size = row.some((item) => item.size === 'SMALL')
      ? 110
      : count <= 3
        ? 210
        : count === 4
          ? 180
          : 150;
    const spacing = size + 30;
    if (featured) this.place(featured, 230, 320, 260);
    row.forEach((item, index) => {
      const x = this.centerX + (index - (count - 1) / 2) * spacing;
      const y = this.baseY - size / 2;
      this.place(item, x, y, size);
    });
  }
  private place(item: SceneItem, x: number, y: number, size: number) {
    const index = this.slots.length;
    const plate = this.scene.add
      .ellipse(x, y + size / 2 + 8, size * 0.95, 30, 0x000000, 0.25)
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
    this.slots.push({
      model,
      container,
      plate,
      image: item.image,
      cut: false,
      collected: false,
    });
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
  }
  /** A solved item visibly joins the basket, shelf, plate or box; it survives show(). */
  collect(objectId: string, to: { x: number; y: number; scale?: number }) {
    const slot = this.slots.find(({ model }) => model.objectId === objectId);
    if (!slot || slot.collected) return;
    slot.collected = true;
    const size = to.scale ? (slot.model.width - 20) * to.scale : 80;
    const mini = this.scene.add
      .image(slot.model.x, slot.model.y, slot.image)
      .setDisplaySize(size, size)
      .setDepth(4);
    this.collected.push(mini);
    this.scene.tweens.add({
      targets: mini,
      x: to.x,
      y: to.y,
      duration: 520,
      ease: 'Cubic.easeInOut',
    });
    // The original leaves the counter: it now lives in the collection place.
    this.scene.tweens.killTweensOf(slot.container);
    this.scene.tweens.add({
      targets: slot.container,
      alpha: 0,
      duration: 300,
    });
  }
  /** Empties every collected mini (e.g. a wrongly packed box), keeps the shelf. */
  clearCollected() {
    for (const mini of this.collected.splice(0)) {
      this.scene.tweens.killTweensOf(mini);
      mini.destroy();
    }
    // Emptied boxes hand their contents back to the counter for another try.
    for (const slot of this.slots) {
      if (!slot.collected) continue;
      slot.collected = false;
      this.scene.tweens.add({
        targets: slot.container,
        alpha: 1,
        duration: 250,
      });
    }
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
  slice(objectId: string) {
    const slot = this.slots.find(({ model }) => model.objectId === objectId);
    if (!slot || slot.cut) return;
    slot.cut = true;
    const { container, image } = slot;
    this.scene.tweens.killTweensOf(container);
    container.removeAll(true);
    container.setScale(1).setAlpha(1);
    const size = slot.model.width - 20;
    const source = this.scene.textures.get(image).getSourceImage();
    for (const side of [-1, 1]) {
      const half = this.scene.add.image(0, 0, image).setDisplaySize(size, size);
      half.setCrop(
        side < 0 ? 0 : source.width / 2,
        0,
        source.width / 2,
        source.height,
      );
      container.add(half);
      this.scene.tweens.add({
        targets: half,
        x: side * 65,
        y: 100,
        angle: side * 35,
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeIn',
      });
    }
  }
  feedback(objectId: string, kind: 'CORRECT' | 'RETRY' | 'HINT') {
    const slot = this.slots.find(({ model }) => model.objectId === objectId);
    if (!slot) return;
    const { container, plate, model } = slot;
    if (slot.cut && kind !== 'CORRECT') return;
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
    this.clearSlots();
    this.clearCollected();
  }
  private clearSlots() {
    for (const { container, plate } of this.slots) {
      this.scene.tweens.killTweensOf(container.list);
      this.scene.tweens.killTweensOf(container);
      container.destroy(true);
      plate.destroy();
    }
    this.slots = [];
  }
}

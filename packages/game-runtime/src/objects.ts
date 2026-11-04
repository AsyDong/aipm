import Phaser from 'phaser';
import type {
  ISceneObjects,
  LearningTask,
  SceneObject,
} from '@english/contracts';

export class PhaserObjects implements ISceneObjects {
  private objects: {
    model: SceneObject;
    container: Phaser.GameObjects.Container;
    frame: Phaser.GameObjects.Rectangle;
  }[] = [];
  constructor(private scene: Phaser.Scene) {}
  show(task: LearningTask) {
    this.clear();
    const count = task.candidates.length;
    const width = count <= 3 ? 220 : 180;
    const gap = count <= 3 ? 34 : 24;
    const cols = Math.min(count, 3);
    const rows = Math.ceil(count / cols);
    task.candidates.forEach((content, index) => {
      const row = Math.floor(index / cols);
      const columns = Math.min(cols, count - row * cols);
      const x = 480 + ((index % cols) - (columns - 1) / 2) * (width + gap);
      const y = rows === 1 ? 280 : 200 + row * 220;
      const frame = this.scene.add
        .rectangle(0, 0, width, 190, 0xfbf5e7)
        .setStrokeStyle(2, 0xd4d6ba);
      const image = this.scene.add.image(0, -8, content.assets.image);
      image.setDisplaySize(140, 140);
      const marker = this.scene.add
        .text(0, 77, '●', {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: '#a3ac8e',
        })
        .setOrigin(0.5);
      const container = this.scene.add.container(x, y, [frame, image, marker]);
      const model = {
        objectId: `${task.id}:${index}`,
        contentId: content.id,
        x,
        y,
        width,
        height: 190,
      };
      this.objects.push({ model, container, frame });
      this.scene.tweens.add({
        targets: container,
        y: y - 5,
        duration: 1800 + index * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });
  }
  hitTest(x: number, y: number) {
    return this.objects.find(
      ({ model, container }) =>
        Math.abs(x - container.x) <= model.width / 2 &&
        Math.abs(y - container.y) <= model.height / 2,
    )?.model;
  }
  feedback(objectId: string, kind: 'CORRECT' | 'RETRY' | 'HINT') {
    const object = this.objects.find(
      (object) => object.model.objectId === objectId,
    );
    if (!object) return;
    object.frame.setStrokeStyle(
      kind === 'HINT' ? 5 : 4,
      kind === 'RETRY' ? 0xca8c65 : kind === 'HINT' ? 0xc99c39 : 0x538565,
    );
    if (kind === 'CORRECT') {
      this.scene.tweens.add({
        targets: object.container,
        scaleX: 1.08,
        scaleY: 1.08,
        yoyo: true,
        duration: 220,
      });
      for (let i = 0; i < 8; i++) {
        const dot = this.scene.add.circle(
          object.container.x,
          object.container.y,
          5,
          0xf5ca75,
        );
        this.scene.tweens.add({
          targets: dot,
          x: dot.x + Math.cos((i * Math.PI) / 4) * 120,
          y: dot.y + Math.sin((i * Math.PI) / 4) * 100,
          alpha: 0,
          duration: 650,
          onComplete: () => dot.destroy(),
        });
      }
    }
  }
  findContent(contentId: string) {
    return this.objects.find((object) => object.model.contentId === contentId)
      ?.model;
  }
  clear() {
    for (const { container } of this.objects) {
      this.scene.tweens.killTweensOf(container);
      container.destroy(true);
    }
    this.objects = [];
  }
}

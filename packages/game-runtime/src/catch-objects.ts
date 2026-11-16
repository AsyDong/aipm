import type Phaser from 'phaser';
import type {
  CatchTheme,
  ISceneObjects,
  SceneItem,
  SceneObject,
} from '@english/contracts';

interface Drop {
  model: SceneObject;
  image: Phaser.GameObjects.Image;
  index: number;
  active: boolean;
  respawnAt: number;
  respawns: number;
  speed: number;
  spin: number;
  baseScale: number;
}
interface Player {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  leftLeg: Phaser.GameObjects.Image;
  rightLeg: Phaser.GameObjects.Image;
  basket: Phaser.GameObjects.Image;
}

const clampX = (x: number) => Math.max(90, Math.min(1150, x));
// No opening lane is under the stationary basket: the player has to move.
const DROP_LANES = [267, 478, 850, 1060, 360, 950];
const BASKET_X = 82;
const BASKET_Y = 18;

/** Continuous movement, falling objects and collision feedback for action scenes. */
export class PhaserCatchObjects implements ISceneObjects {
  private theme: CatchTheme | undefined;
  private drops: Drop[] = [];
  private player: Player | undefined;
  private comboText: Phaser.GameObjects.Text | undefined;
  private onCatch: ((object: SceneObject) => boolean) | undefined;
  private active = false;
  private direction: -1 | 0 | 1 = 0;
  private targetX = 640;
  private combo = 0;

  constructor(private scene: Phaser.Scene) {}

  configureCatch(theme: CatchTheme) {
    this.theme = theme;
  }

  startCatch(
    items: SceneItem[],
    onCatch: (object: SceneObject) => boolean,
    speed: number,
  ) {
    this.clearDrops();
    const player = this.ensurePlayer();
    this.onCatch = onCatch;
    this.active = false;
    this.comboText?.setText('');
    this.direction = 0;
    this.targetX = player.container.x;
    this.scene.events.off('update', this.update, this);
    this.scene.events.on('update', this.update, this);
    const source = Array.from(
      { length: items.length * 3 },
      (_, index) => items[index % items.length]!,
    );
    source.forEach((item, index) => {
      const image = this.scene.add
        .image(0, 0, item.image)
        .setDisplaySize(104, 104);
      const drop: Drop = {
        model: {
          objectId: `${item.objectId}:drop-${index}`,
          contentId: item.contentId,
          x: 0,
          y: 0,
          width: 120,
          height: 120,
        },
        image,
        index,
        active: true,
        respawnAt: 0,
        respawns: 0,
        speed: speed + (index % 3) * 16,
        spin: (index % 2 ? -1 : 1) * (30 + (index % 3) * 10),
        baseScale: image.scaleX,
      };
      image.setDepth(2);
      this.resetDrop(drop, 90 - index * 115);
      this.drops.push(drop);
    });
  }

  private ensurePlayer() {
    if (this.player) return this.player;
    if (!this.theme) throw new Error('Catch artwork is not configured');
    const size = 180;
    const rightLeg = this.scene.add
      .image((0.5 - 0.615) * size, (0.5 - 0.855) * size, this.theme.legRight)
      .setDisplaySize(size, size)
      .setOrigin(0.615, 0.855);
    const leftLeg = this.scene.add
      .image((0.5 - 0.454) * size, (0.5 - 0.855) * size, this.theme.legLeft)
      .setDisplaySize(size, size)
      .setOrigin(0.454, 0.855);
    const body = this.scene.add
      .image(0, 0, this.theme.body)
      .setDisplaySize(size, size);
    const basket = this.scene.add
      .image(BASKET_X, BASKET_Y, this.theme.basket)
      .setDisplaySize(120, 88);
    const container = this.scene.add
      .container(640, 600, [rightLeg, leftLeg, body, basket])
      .setDepth(4);
    this.player = { container, body, leftLeg, rightLeg, basket };
    this.comboText = this.scene.add
      .text(640, 32, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#31515b',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(6);
    return this.player;
  }

  setCatchActive(active: boolean) {
    this.active = active;
    if (!active) this.direction = 0;
  }
  moveCatcher(x: number) {
    if (!this.player) return;
    this.direction = 0;
    this.targetX = clampX(x - BASKET_X);
  }
  steerCatcher(direction: -1 | 0 | 1) {
    if (!this.player) return;
    this.direction = direction;
    this.targetX = this.player.container.x;
  }

  private update(time: number, delta: number) {
    if (!this.active) return;
    const dt = Math.min(delta, 40) / 1000;
    const player = this.player;
    if (player) {
      const previous = player.container.x;
      if (this.direction)
        player.container.x = clampX(
          player.container.x + this.direction * 560 * dt,
        );
      else {
        const distance = this.targetX - player.container.x;
        player.container.x = clampX(
          player.container.x +
            Math.sign(distance) * Math.min(Math.abs(distance), 760 * dt),
        );
      }
      const moving = Math.abs(player.container.x - previous) > 0.03;
      const step = moving ? Math.sin(time * 0.025) : 0;
      player.leftLeg.setAngle(step * 23).setY(-63.9 - Math.max(0, step) * 6);
      player.rightLeg.setAngle(-step * 23).setY(-63.9 + Math.min(0, step) * 6);
      player.body.setY(-Math.abs(step) * 2);
      player.basket.setAngle(step * 3);
    }
    for (const drop of this.drops) {
      if (!drop.active) {
        if (drop.respawnAt && time >= drop.respawnAt) {
          this.scene.tweens.killTweensOf(drop.image);
          drop.image.setAlpha(1).setScale(drop.baseScale).setVisible(true);
          this.resetDrop(drop, -90);
          drop.active = true;
        }
        continue;
      }
      drop.model.y += drop.speed * dt;
      drop.image.setY(drop.model.y).setAngle(drop.image.angle + drop.spin * dt);
      if (player && this.intersectsBasket(drop) && this.onCatch?.(drop.model)) {
        drop.active = false;
        drop.respawnAt = 0;
      } else if (drop.model.y > 675) {
        drop.active = false;
        drop.model.y = 668;
        drop.image.setY(668);
        drop.respawnAt = time + 520;
        this.scene.tweens.add({
          targets: drop.image,
          alpha: 0,
          scaleY: drop.baseScale * 0.35,
          angle: drop.image.angle + 30,
          duration: 220,
        });
      }
    }
  }

  private intersectsBasket(drop: Drop) {
    const player = this.player!;
    return (
      Math.abs(drop.model.x - (player.container.x + BASKET_X)) < 95 &&
      drop.model.y > player.container.y + BASKET_Y - 68 &&
      drop.model.y < player.container.y + BASKET_Y + 25
    );
  }

  private resetDrop(drop: Drop, y: number) {
    drop.respawns++;
    const lane = DROP_LANES[drop.index % DROP_LANES.length]!;
    drop.model.x = 100 + ((lane - 100 + (drop.respawns - 1) * 167) % 1080);
    drop.model.y = y;
    drop.respawnAt = 0;
    drop.image
      .clearTint()
      .setPosition(drop.model.x, y)
      .setScale(drop.baseScale)
      .setAlpha(1)
      .setVisible(true);
  }

  hitTest(x: number, y: number) {
    return this.drops.find(
      ({ model, active }) =>
        active && Math.abs(x - model.x) <= 60 && Math.abs(y - model.y) <= 60,
    )?.model;
  }
  findByContent(contentId: string) {
    return this.drops.find(
      (drop) => drop.active && drop.model.contentId === contentId,
    )?.model;
  }

  feedback(objectId: string, kind: 'CORRECT' | 'RETRY' | 'HINT') {
    const drop = this.drops.find((item) => item.model.objectId === objectId);
    if (kind === 'HINT') {
      if (!drop) return;
      const ring = this.scene.add
        .ellipse(drop.model.x, drop.model.y, 150, 150)
        .setStrokeStyle(8, 0xffd21f)
        .setDepth(5);
      drop.image.setTint(0xffd21f);
      drop.speed *= 0.7;
      this.scene.tweens.add({
        targets: ring,
        scaleX: 1.35,
        scaleY: 1.35,
        alpha: 0,
        duration: 750,
        onComplete: () => ring.destroy(),
      });
      this.scene.time.delayedCall(800, () => {
        if (drop.image.active) drop.image.clearTint();
      });
      return;
    }
    if (kind === 'CORRECT') {
      this.combo++;
      this.comboText?.setText(
        this.combo > 1 ? `${this.combo} catch streak!` : 'Great catch!',
      );
      const player = this.player;
      if (drop && player) {
        drop.image.setDepth(5);
        this.scene.tweens.add({
          targets: drop.image,
          x: player.container.x + BASKET_X,
          y: player.container.y + BASKET_Y,
          scaleX: drop.baseScale * 0.25,
          scaleY: drop.baseScale * 0.25,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
        });
      }
      if (player) {
        const scaleX = player.basket.scaleX;
        const scaleY = player.basket.scaleY;
        this.scene.tweens.add({
          targets: player.basket,
          scaleX: scaleX * 1.16,
          scaleY: scaleY * 1.16,
          yoyo: true,
          duration: 150,
        });
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8;
          const star = this.scene.add
            .star(
              player.container.x + BASKET_X,
              player.container.y + BASKET_Y - 25,
              5,
              6,
              14,
              0xffd21f,
            )
            .setDepth(6);
          this.scene.tweens.add({
            targets: star,
            x: star.x + Math.cos(angle) * 130,
            y: star.y + Math.sin(angle) * 100,
            alpha: 0,
            duration: 600,
            onComplete: () => star.destroy(),
          });
        }
      }
      return;
    }
    this.combo = 0;
    this.comboText?.setText('Try again!');
    if (drop) {
      drop.respawnAt = this.scene.time.now + 700;
      this.scene.tweens.add({
        targets: drop.image,
        y: drop.image.y - 95,
        angle: drop.image.angle + 130,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
      });
    }
    if (this.player)
      this.scene.tweens.add({
        targets: this.player.basket,
        angle: 12,
        yoyo: true,
        repeat: 3,
        duration: 65,
      });
  }

  show(items: SceneItem[]) {
    this.startCatch(items, () => false, 140);
  }
  setShelf() {}
  clear() {
    this.active = false;
    this.scene.events.off('update', this.update, this);
    this.clearDrops();
    if (this.player) {
      this.scene.tweens.killTweensOf(this.player.container.list);
      this.player.container.destroy(true);
    }
    this.player = undefined;
    this.comboText?.destroy();
    this.comboText = undefined;
    this.onCatch = undefined;
    this.combo = 0;
  }
  private clearDrops() {
    for (const drop of this.drops) {
      this.scene.tweens.killTweensOf(drop.image);
      drop.image.destroy();
    }
    this.drops = [];
  }
}

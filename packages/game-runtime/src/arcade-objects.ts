import type Phaser from 'phaser';
import type {
  ArcadeAction,
  ArcadeMode,
  InputEvent,
  ISceneObjects,
  SceneItem,
  SceneObject,
} from '@english/contracts';

interface Card {
  model: SceneObject;
  box: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Rectangle;
  covers: Phaser.GameObjects.GameObject[];
  home: { x: number; y: number };
  baseX: number;
  baseY: number;
}
interface Particle {
  node: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  vx: number;
  vy: number;
}
interface MazeCell {
  walls: boolean[];
}

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/** Ten small action loops sharing only rendering helpers, never answer rules. */
export class PhaserArcadeObjects implements ISceneObjects {
  private mode: ArcadeMode = 'picture-pairs';
  private round = 0;
  private active = false;
  private answered = false;
  private onAction: ArcadeAction = () => false;
  private nodes: Phaser.GameObjects.GameObject[] = [];
  private cards: Card[] = [];
  private player: Phaser.GameObjects.Image | undefined;
  private playerV = { x: 0, y: 0 };
  private targetX = 180;
  private direction: -1 | 0 | 1 = 0;
  private grounded = true;
  private platforms: { x: number; y: number; width: number }[] = [];
  private particle: Particle | undefined;
  private enemies: Phaser.GameObjects.Container[] = [];
  private path: number[] = [];
  private maze: MazeCell[] = [];
  private mazePlayerCell = 0;
  private selected: Card | undefined;
  private dragging: Card | undefined;
  private delivery: { card: Card; falling: boolean; vy: number } | undefined;
  private racing = false;
  private raceLane = 0;
  private turnBusy = false;
  private built = 0;
  private elapsed = 0;

  constructor(private scene: Phaser.Scene) {}

  startArcade(
    mode: ArcadeMode,
    items: SceneItem[],
    onAction: ArcadeAction,
    round: number,
  ) {
    const changed = this.mode !== mode;
    this.clearRound();
    this.mode = mode;
    this.round = round;
    if (changed || round === 0) this.built = 0;
    this.onAction = onAction;
    switch (mode) {
      case 'picture-pairs':
        this.setupPairs(items);
        break;
      case 'little-chef':
        this.setupChef(items);
        break;
      case 'word-racers':
        this.setupRace(items);
        break;
      case 'maze-explorer':
        this.setupMaze(items);
        break;
      case 'sky-jumper':
        this.setupJumper(items);
        break;
      case 'bubble-pop':
        this.setupBubbles(items);
        break;
      case 'word-golf':
        this.setupGolf(items);
        break;
      case 'little-builders':
        this.setupBuilders(items);
        break;
      case 'garden-guardians':
        this.setupGuardians(items);
        break;
      case 'power-quest':
        this.setupQuest(items);
        break;
    }
    this.scene.events.on('update', this.update, this);
  }

  setArcadeActive(active: boolean) {
    this.active = active;
    if (!active) this.direction = 0;
  }

  arcadeInput(event: InputEvent) {
    if (!this.active || this.answered) return;
    if (event.type === 'STEER') {
      this.direction = event.direction;
      if (this.mode === 'word-racers' && event.direction && !this.racing) {
        this.raceLane = clamp(
          this.raceLane + event.direction,
          0,
          this.cards.length - 1,
        );
        this.startRace();
      }
      if (this.mode === 'maze-explorer' && event.direction)
        this.mazeStep(this.mazePlayerCell + event.direction);
      return;
    }
    if (event.type === 'MOVE') {
      if (this.mode === 'little-chef') this.dragIngredient(event.x, event.y);
      if (this.mode === 'sky-jumper') this.targetX = clamp(event.x, 55, 1225);
      return;
    }
    if (event.type === 'TAP') {
      this.tap(event.x, event.y);
      return;
    }
    if (event.type !== 'SWIPE' || !event.points.length) return;
    const first = event.points[0]!;
    const last = event.points.at(-1)!;
    const length = distance(first.x, first.y, last.x, last.y);
    if (this.mode === 'little-chef') {
      this.dropIngredient(last.x, last.y);
      return;
    }
    if (this.mode === 'word-golf') {
      if (length < 24) this.shootGolf(last.x - 170, last.y - 570, 620);
      else this.shootGolf(last.x - first.x, last.y - first.y, 3.2);
      return;
    }
    if (this.mode === 'sky-jumper' && first.y - last.y > 45) {
      this.jump();
      return;
    }
    if (length < 24) this.tap(last.x, last.y);
  }

  private tap(x: number, y: number) {
    const card = this.cardAt(x, y);
    if (this.mode === 'little-chef') this.dragging = undefined;
    switch (this.mode) {
      case 'picture-pairs':
        if (card) this.flip(card);
        break;
      case 'little-chef':
        if (card && !this.delivery) {
          card.home = { x: card.box.x, y: card.box.y };
          this.delivery = { card, falling: false, vy: 0 };
        }
        break;
      case 'word-racers': {
        const lane = this.nearestCard(x, y);
        if (lane >= 0 && !this.racing) {
          this.raceLane = lane;
          this.startRace();
        }
        break;
      }
      case 'maze-explorer':
        this.mazeTo(x, y);
        break;
      case 'sky-jumper':
        if (y < 480) this.jump();
        else this.targetX = clamp(x, 55, 1225);
        break;
      case 'bubble-pop':
        this.shootBubble(x, y);
        break;
      case 'little-builders':
        if (card && !this.delivery)
          this.delivery = { card, falling: false, vy: 0 };
        break;
      case 'garden-guardians':
        if (card && !this.particle) this.fireWater(card);
        break;
      case 'power-quest':
        if (card && !this.turnBusy) this.takeTurn(card);
        break;
      case 'word-golf':
        break;
    }
  }

  // ---------- Picture Pairs ----------
  private setupPairs(items: SceneItem[]) {
    const copies = items.flatMap((item) => [
      { ...item, objectId: `${item.objectId}:a` },
      { ...item, objectId: `${item.objectId}:b` },
    ]);
    // Interleave pairs so a fixed layout does not reveal the shuffle.
    const ordered = copies.map((_, index) => {
      const pair = index % items.length;
      const copy = Math.floor(index / items.length);
      return copies[pair * 2 + copy]!;
    });
    const columns = Math.min(4, items.length);
    const rows = Math.ceil(ordered.length / columns);
    ordered.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const card = this.makeCard(
        item,
        640 + (col - (columns - 1) / 2) * 220,
        390 + (row - (rows - 1) / 2) * 245,
        130,
      );
      const cover = this.add(
        this.scene.add.rectangle(0, 0, 154, 154, 0x389ed0, 1),
      );
      cover.setStrokeStyle(6, 0xffffff);
      const mark = this.add(this.scene.add.graphics());
      mark.lineStyle(11, 0xffffff, 1);
      mark.beginPath();
      mark.arc(0, -16, 28, Math.PI, Math.PI * 1.8);
      mark.lineTo(8, 5);
      mark.lineTo(0, 22);
      mark.strokePath();
      mark.fillStyle(0xffffff, 1);
      mark.fillCircle(0, 48, 7);
      card.box.add([cover, mark]);
      card.covers = [cover, mark];
      card.art.setAlpha(0);
    });
  }

  private flip(card: Card) {
    if (
      this.turnBusy ||
      !card.covers.length ||
      !(card.covers[0] as Phaser.GameObjects.Shape).visible
    )
      return;
    this.reveal(card, true);
    if (!this.selected) {
      this.selected = card;
      return;
    }
    const first = this.selected;
    this.selected = undefined;
    if (first === card) return;
    this.turnBusy = true;
    if (first.model.contentId === card.model.contentId) {
      const result = this.act(card);
      if (result === 'RETRY') this.coverLater([first, card]);
      else {
        this.reveal(first, true);
        this.turnBusy = false;
      }
    } else {
      this.scene.tweens.add({
        targets: [first.box, card.box],
        angle: 5,
        yoyo: true,
        repeat: 2,
        duration: 70,
      });
      this.coverLater([first, card]);
    }
  }

  private reveal(card: Card, visible: boolean) {
    card.covers.forEach((cover) =>
      (cover as Phaser.GameObjects.Shape).setVisible(!visible),
    );
    card.art.setAlpha(visible ? 1 : 0);
  }
  private coverLater(cards: Card[]) {
    this.scene.time.delayedCall(550, () => {
      cards.forEach((card) => this.reveal(card, false));
      this.turnBusy = false;
    });
  }

  // ---------- Little Chef ----------
  private setupChef(items: SceneItem[]) {
    this.add(this.scene.add.rectangle(640, 420, 1160, 360, 0xf5d9a6, 0.94))
      .setStrokeStyle(8, 0xb97b42)
      .setDepth(-1);
    for (let y = 280; y <= 520; y += 120)
      this.add(this.scene.add.rectangle(560, y + 62, 900, 8, 0x8e664c));
    this.add(this.scene.add.ellipse(1050, 530, 230, 120, 0x394d59));
    this.add(this.scene.add.ellipse(1050, 495, 205, 82, 0xffc857));
    this.label(1050, 610, 'POT', 25);
    items.forEach((item, index) => {
      const card = this.makeCard(
        item,
        240 + index * 190,
        280 + (index % 2) * 160,
        104,
      );
      card.baseY = card.box.y;
    });
  }
  private dragIngredient(x: number, y: number) {
    if (this.delivery) return;
    if (!this.dragging) this.dragging = this.cardAt(x, y);
    if (this.dragging) this.moveCard(this.dragging, x, y);
  }
  private dropIngredient(x: number, y: number) {
    const card = this.dragging;
    this.dragging = undefined;
    if (!card) return;
    if (distance(x, y, 1050, 500) < 150) {
      this.act(card);
      this.moveCard(card, card.home.x, card.home.y);
    } else this.moveCard(card, card.home.x, card.home.y);
  }

  // ---------- Word Racers ----------
  private setupRace(items: SceneItem[]) {
    this.add(
      this.scene.add.rectangle(640, 390, 1060, 580, 0x526675, 0.94),
    ).setDepth(-1);
    items.forEach((item, index) => {
      const x = this.laneX(index, items.length);
      this.add(
        this.scene.add.rectangle(x, 390, 210, 560, 0x627b89),
      ).setStrokeStyle(5, 0xffffff, 0.45);
      for (let y = 240; y < 640; y += 100)
        this.add(this.scene.add.rectangle(x, y, 8, 48, 0xffe477));
      this.makeCard(item, x, 150, 100);
      this.add(this.scene.add.rectangle(x, 215, 170, 12, 0xffffff));
    });
    this.player = this.add(
      this.scene.add.image(
        this.laneX(0, items.length),
        590,
        '/images/mascot.webp',
      ),
    );
    this.player.setDisplaySize(105, 105).setAngle(-12);
    this.add(this.scene.add.rectangle(0, 34, 70, 38, 0xef5b4c)).setPosition(
      this.player.x,
      this.player.y + 38,
    );
  }
  private laneX(index: number, count = this.cards.length) {
    return 640 + (index - (count - 1) / 2) * 260;
  }
  private startRace() {
    if (!this.player || !this.cards[this.raceLane]) return;
    this.racing = true;
    this.player.setX(this.laneX(this.raceLane));
  }

  // ---------- Maze Explorer ----------
  private setupMaze(items: SceneItem[]) {
    const columns = 8;
    const rows = 4;
    this.maze = Array.from({ length: columns * rows }, () => ({
      walls: [true, true, true, true],
    }));
    let seed = 37 + this.round * 19;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const visited = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      const current = stack.at(-1)!;
      const x = current % columns;
      const y = Math.floor(current / columns);
      const options = [
        ...(y > 0 ? [{ cell: current - columns, wall: 0, other: 2 }] : []),
        ...(x < columns - 1 ? [{ cell: current + 1, wall: 1, other: 3 }] : []),
        ...(y < rows - 1
          ? [{ cell: current + columns, wall: 2, other: 0 }]
          : []),
        ...(x > 0 ? [{ cell: current - 1, wall: 3, other: 1 }] : []),
      ].filter(({ cell }) => !visited.has(cell));
      if (!options.length) {
        stack.pop();
        continue;
      }
      const next = options[Math.floor(random() * options.length)]!;
      this.maze[current]!.walls[next.wall] = false;
      this.maze[next.cell]!.walls[next.other] = false;
      visited.add(next.cell);
      stack.push(next.cell);
    }
    this.add(
      this.scene.add.rectangle(640, 370, 1000, 520, 0xe9dfbd, 0.96),
    ).setDepth(-1);
    this.maze.forEach((cell, index) => {
      const { x, y } = this.mazeCenter(index);
      const left = x - 60;
      const top = y - 60;
      if (cell.walls[0]) this.wall(left, top, 120, 8);
      if (cell.walls[3]) this.wall(left, top, 8, 120);
      if (index % columns === columns - 1 && cell.walls[1])
        this.wall(left + 112, top, 8, 120);
      if (index >= columns * (rows - 1) && cell.walls[2])
        this.wall(left, top + 112, 120, 8);
    });
    const cells = [7, 15, 23, 31];
    items.forEach((item, index) => {
      const point = this.mazeCenter(cells[index % cells.length]!);
      this.makeCard(item, point.x, point.y, 66);
    });
    const start = this.mazeCenter(0);
    this.player = this.add(
      this.scene.add.image(start.x, start.y, '/images/mascot.webp'),
    );
    this.player.setDisplaySize(72, 72);
    this.mazePlayerCell = 0;
  }
  private wall(x: number, y: number, width: number, height: number) {
    this.add(
      this.scene.add.rectangle(
        x + width / 2,
        y + height / 2,
        width,
        height,
        0x49785b,
      ),
    );
  }
  private mazeCenter(cell: number) {
    return { x: 220 + (cell % 8) * 120, y: 190 + Math.floor(cell / 8) * 120 };
  }
  private mazeTo(x: number, y: number) {
    const col = clamp(Math.floor((x - 160) / 120), 0, 7);
    const row = clamp(Math.floor((y - 130) / 120), 0, 3);
    this.mazeStep(row * 8 + col, true);
  }
  private mazeStep(destination: number, findPath = false) {
    if (!this.player || destination < 0 || destination >= this.maze.length)
      return;
    if (!findPath) {
      const from = this.mazePlayerCell;
      if (
        Math.abs((from % 8) - (destination % 8)) !== 1 ||
        Math.floor(from / 8) !== Math.floor(destination / 8)
      )
        return;
      const wall = destination > from ? 1 : 3;
      if (this.maze[from]!.walls[wall]) return;
      this.path = [destination];
      return;
    }
    const queue = [this.mazePlayerCell];
    const previous = new Map<number, number>();
    const seen = new Set(queue);
    while (queue.length) {
      const current = queue.shift()!;
      if (current === destination) break;
      const x = current % 8;
      const y = Math.floor(current / 8);
      const next = [
        ...(y > 0 && !this.maze[current]!.walls[0] ? [current - 8] : []),
        ...(x < 7 && !this.maze[current]!.walls[1] ? [current + 1] : []),
        ...(y < 3 && !this.maze[current]!.walls[2] ? [current + 8] : []),
        ...(x > 0 && !this.maze[current]!.walls[3] ? [current - 1] : []),
      ];
      for (const cell of next)
        if (!seen.has(cell)) {
          seen.add(cell);
          previous.set(cell, current);
          queue.push(cell);
        }
    }
    if (!seen.has(destination)) return;
    const path = [destination];
    while (path[0] !== this.mazePlayerCell)
      path.unshift(previous.get(path[0]!)!);
    this.path = path.slice(1);
  }

  // ---------- Sky Jumper ----------
  private setupJumper(items: SceneItem[]) {
    this.add(this.scene.add.rectangle(640, 655, 1280, 90, 0x65a852));
    this.platforms = [
      { x: 300, y: 550, width: 230 },
      { x: 650, y: 455, width: 230 },
      { x: 1000, y: 550, width: 230 },
      { x: 650, y: 620, width: 180 },
    ];
    this.platforms.forEach((platform) =>
      this.add(
        this.scene.add.rectangle(
          platform.x,
          platform.y,
          platform.width,
          24,
          0xd59a52,
        ),
      ).setStrokeStyle(5, 0xffdf85),
    );
    items.forEach((item, index) => {
      const platform = this.platforms[index % this.platforms.length]!;
      this.makeCard(item, platform.x, platform.y - 75, 82);
    });
    this.player = this.add(
      this.scene.add.image(100, 590, '/images/mascot.webp'),
    );
    this.player.setDisplaySize(90, 90);
    this.targetX = 100;
    this.playerV = { x: 0, y: 0 };
    this.grounded = true;
  }
  private jump() {
    if (!this.player || !this.grounded) return;
    this.playerV.y = -735;
    this.grounded = false;
  }

  // ---------- Bubble Pop ----------
  private setupBubbles(items: SceneItem[]) {
    this.add(this.scene.add.circle(130, 600, 65, 0xef7b52));
    this.add(this.scene.add.rectangle(130, 625, 180, 22, 0x744c3a));
    items.forEach((item, index) => {
      const card = this.makeCard(
        item,
        440 + index * 220,
        240 + (index % 2) * 170,
        104,
      );
      card.baseX = card.box.x;
      card.baseY = card.box.y;
      const bubble = this.add(this.scene.add.circle(0, 0, 73, 0xa7e5f5, 0.25));
      bubble.setStrokeStyle(5, 0xd8f8ff, 0.8);
      card.box.addAt(bubble, 0);
    });
  }
  private shootBubble(x: number, y: number) {
    if (this.particle) return;
    const dx = x - 130;
    const dy = y - 600;
    const length = Math.max(1, Math.hypot(dx, dy));
    const node = this.add(this.scene.add.circle(130, 600, 18, 0xffe169));
    node.setStrokeStyle(5, 0xffffff);
    this.particle = { node, vx: (dx / length) * 850, vy: (dy / length) * 850 };
  }

  // ---------- Word Golf ----------
  private setupGolf(items: SceneItem[]) {
    this.add(
      this.scene.add.ellipse(700, 430, 1120, 500, 0x75bd68, 0.96),
    ).setDepth(-1);
    items.forEach((item, index) => {
      const x = 570 + (index % 2) * 430;
      const y = 260 + Math.floor(index / 2) * 250;
      this.add(this.scene.add.ellipse(x, y + 40, 94, 34, 0x294d38));
      this.makeCard(item, x, y - 20, 82);
    });
    const ball = this.add(this.scene.add.circle(170, 570, 22, 0xffffff));
    ball.setStrokeStyle(4, 0x9fc3cf);
    this.player = ball as unknown as Phaser.GameObjects.Image;
    this.playerV = { x: 0, y: 0 };
  }
  private shootGolf(dx: number, dy: number, multiplier: number) {
    if (!this.player || Math.hypot(this.playerV.x, this.playerV.y) > 25) return;
    const length = Math.hypot(dx, dy);
    if (length < 12) return;
    const speed = Math.min(1050, length * multiplier);
    this.playerV = { x: (dx / length) * speed, y: (dy / length) * speed };
  }

  // ---------- Little Builders ----------
  private setupBuilders(items: SceneItem[]) {
    this.add(this.scene.add.rectangle(1020, 620, 360, 34, 0x80624b));
    this.add(this.scene.add.rectangle(1020, 115, 430, 22, 0xf2bd45));
    this.add(this.scene.add.rectangle(1200, 345, 22, 480, 0xf2bd45));
    for (let floor = 0; floor < this.built; floor++) {
      this.add(
        this.scene.add.rectangle(
          1020,
          570 - floor * 74,
          250,
          68,
          floor % 2 ? 0xffd273 : 0xf39a68,
        ),
      ).setStrokeStyle(5, 0xffffff);
      this.add(
        this.scene.add.rectangle(1020, 570 - floor * 74, 54, 42, 0x8fd7e8),
      );
    }
    items.forEach((item, index) => {
      const card = this.makeCard(
        item,
        250 + index * 205,
        260 + (index % 2) * 130,
        100,
      );
      card.baseY = card.box.y;
      this.add(this.scene.add.rectangle(card.box.x, 150, 7, 160, 0x526675));
    });
  }

  // ---------- Garden Guardians ----------
  private setupGuardians(items: SceneItem[]) {
    this.add(
      this.scene.add.rectangle(640, 370, 1130, 520, 0x86bd68, 0.92),
    ).setDepth(-1);
    this.enemies = [];
    items.forEach((item, index) => {
      const x = 320 + index * (items.length > 3 ? 210 : 260);
      const enemy = this.add(this.scene.add.container(x, 150));
      const cloud = this.add(this.scene.add.circle(0, 0, 47, 0x8068a9));
      const eyeA = this.add(this.scene.add.circle(-15, -5, 6, 0xffffff));
      const eyeB = this.add(this.scene.add.circle(15, -5, 6, 0xffffff));
      enemy.add([cloud, eyeA, eyeB]);
      this.enemies.push(enemy);
      this.makeCard(item, x, 545, 100);
      this.add(
        this.scene.add.rectangle(x, 625, 150, 65, 0x4b8e52),
      ).setStrokeStyle(5, 0xd8ef9c);
    });
    this.label(640, 680, 'Keep the garden growing!', 25);
  }
  private fireWater(card: Card) {
    const enemy = this.enemies[this.cards.indexOf(card)];
    if (!enemy) return;
    const node = this.add(this.scene.add.circle(card.box.x, 475, 16, 0x75d9f3));
    node.setStrokeStyle(4, 0xe6fbff);
    this.particle = { node, vx: 0, vy: -680 };
    this.particle.node.setData('tower', this.cards.indexOf(card));
  }

  // ---------- Power Quest ----------
  private setupQuest(items: SceneItem[]) {
    this.add(this.scene.add.ellipse(330, 450, 340, 75, 0x234c59, 0.35));
    this.add(this.scene.add.ellipse(980, 450, 300, 70, 0x234c59, 0.35));
    this.player = this.add(
      this.scene.add.image(290, 365, '/images/mascot.webp'),
    );
    this.player.setDisplaySize(190, 190);
    const rival = this.add(this.scene.add.container(980, 350));
    const body = this.add(this.scene.add.circle(0, 0, 100, 0x8a6fc0));
    body.setStrokeStyle(8, 0xd6baf2);
    const eyes = this.add(
      this.scene.add.text(0, -15, '•  •', {
        fontSize: '62px',
        color: '#ffffff',
      }),
    );
    eyes.setOrigin(0.5);
    rival.add([body, eyes]);
    rival.setName('rival');
    items.forEach((item, index) =>
      this.makeCard(
        item,
        320 + index * (items.length > 3 ? 210 : 260),
        585,
        102,
      ),
    );
    this.turnBusy = false;
  }
  private takeTurn(card: Card) {
    if (!this.player) return;
    this.turnBusy = true;
    this.scene.tweens.add({
      targets: this.player,
      x: 730,
      y: 320,
      angle: 12,
      duration: 420,
      ease: 'Quad.easeIn',
      yoyo: true,
      onYoyo: () => {
        const result = this.act(card);
        if (result === 'RETRY') this.turnBusy = false;
      },
      onComplete: () => {
        this.player?.setAngle(0).setPosition(290, 365);
        if (!this.answered) this.turnBusy = false;
      },
    });
  }

  // ---------- Shared motion and answer feedback ----------
  private update(time: number, delta: number) {
    if (!this.active) return;
    const dt = Math.min(delta, 40) / 1000;
    this.elapsed = time / 1000;
    switch (this.mode) {
      case 'little-chef':
        for (const card of this.cards) {
          if (card === this.dragging || this.delivery?.card === card) continue;
          const x = card.box.x + (55 + this.round * 5) * dt;
          this.moveCard(
            card,
            x > 920 ? 180 : x,
            card.baseY + Math.sin(time / 450 + card.baseX) * 6,
          );
        }
        this.updateDelivery(dt, 1050, 475);
        break;
      case 'word-racers':
        if (this.racing && this.player) {
          this.player.y -= (390 + this.round * 20) * dt;
          this.player.setAngle(Math.sin(time / 70) * 4 - 12);
          if (this.player.y < 190) {
            this.racing = false;
            this.act(this.cards[this.raceLane]!);
          }
        }
        break;
      case 'maze-explorer':
        this.updateMaze(dt);
        break;
      case 'sky-jumper':
        this.updateJumper(dt);
        break;
      case 'bubble-pop':
        this.cards.forEach((card, index) => {
          if (card.art.alpha)
            this.moveCard(
              card,
              card.baseX + Math.sin(time / 900 + index) * 95,
              card.baseY + Math.sin(time / 540 + index) * 28,
            );
        });
        this.updateBubble(dt);
        break;
      case 'word-golf':
        this.updateGolf(dt);
        break;
      case 'little-builders':
        this.cards.forEach((card, index) => {
          if (this.delivery?.card !== card)
            this.moveCard(
              card,
              card.home.x,
              card.baseY + Math.sin(time / 400 + index) * 35,
            );
        });
        this.updateDelivery(dt, 1020, 560 - this.built * 74);
        break;
      case 'garden-guardians':
        this.enemies.forEach((enemy, index) => {
          enemy.y += (45 + this.round * 5 + index * 3) * dt;
          enemy.x += Math.sin(time / 500 + index) * 0.35;
          if (enemy.y > 475) enemy.y = 120;
        });
        this.updateWater(dt);
        break;
      case 'power-quest':
        if (!this.turnBusy) this.player?.setY(365 + Math.sin(time / 300) * 7);
        break;
      case 'picture-pairs':
        break;
    }
  }

  private updateMaze(dt: number) {
    if (!this.player || !this.path.length) return;
    const next = this.path[0]!;
    const target = this.mazeCenter(next);
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const step = 250 * dt;
    if (Math.hypot(dx, dy) <= step) {
      this.player.setPosition(target.x, target.y);
      this.mazePlayerCell = next;
      this.path.shift();
      const card = this.cards.find(
        (item) =>
          distance(item.box.x, item.box.y, target.x, target.y) < 45 &&
          item.art.alpha > 0,
      );
      if (card && this.path.length === 0) {
        this.act(card);
      }
    } else {
      this.player.x += (dx / Math.hypot(dx, dy)) * step;
      this.player.y += (dy / Math.hypot(dx, dy)) * step;
      this.player.setAngle(Math.sin(this.elapsed * 25) * 4);
    }
  }

  private updateJumper(dt: number) {
    const player = this.player;
    if (!player) return;
    const previousY = player.y;
    if (this.direction) player.x += this.direction * 390 * dt;
    else {
      const dx = this.targetX - player.x;
      player.x += Math.sign(dx) * Math.min(Math.abs(dx), 430 * dt);
    }
    player.x = clamp(player.x, 50, 1230);
    this.playerV.y += 1500 * dt;
    player.y += this.playerV.y * dt;
    this.grounded = false;
    let floor = 610;
    for (const platform of this.platforms) {
      if (
        Math.abs(player.x - platform.x) < platform.width / 2 + 25 &&
        previousY + 42 <= platform.y &&
        player.y + 42 >= platform.y &&
        this.playerV.y >= 0
      )
        floor = Math.min(floor, platform.y - 42);
    }
    if (player.y >= floor && this.playerV.y >= 0) {
      player.y = floor;
      this.playerV.y = 0;
      this.grounded = true;
    }
    player.setAngle(
      this.grounded && Math.abs(this.targetX - player.x) > 5
        ? Math.sin(this.elapsed * 25) * 5
        : 0,
    );
    const card = this.cards.find(
      (item) =>
        item.art.alpha > 0 &&
        distance(player.x, player.y, item.box.x, item.box.y) < 80,
    );
    if (card) this.act(card);
  }

  private updateBubble(dt: number) {
    const shot = this.particle;
    if (!shot) return;
    shot.node.x += shot.vx * dt;
    shot.node.y += shot.vy * dt;
    const card = this.cards.find(
      (item) =>
        item.art.alpha > 0 &&
        distance(shot.node.x, shot.node.y, item.box.x, item.box.y) < 78,
    );
    if (card) {
      this.removeParticle();
      this.act(card);
    } else if (
      shot.node.x > 1320 ||
      shot.node.x < -40 ||
      shot.node.y < -40 ||
      shot.node.y > 760
    )
      this.removeParticle();
  }

  private updateGolf(dt: number) {
    if (!this.player) return;
    this.player.x += this.playerV.x * dt;
    this.player.y += this.playerV.y * dt;
    const drag = Math.pow(0.22, dt);
    this.playerV.x *= drag;
    this.playerV.y *= drag;
    if (this.player.x < 30 || this.player.x > 1250) {
      this.player.x = clamp(this.player.x, 30, 1250);
      this.playerV.x *= -0.55;
    }
    if (this.player.y < 100 || this.player.y > 690) {
      this.player.y = clamp(this.player.y, 100, 690);
      this.playerV.y *= -0.55;
    }
    const card = this.cards.find(
      (item) =>
        item.art.alpha > 0 &&
        distance(this.player!.x, this.player!.y, item.box.x, item.box.y + 35) <
          65,
    );
    if (card) {
      this.playerV = { x: 0, y: 0 };
      this.act(card);
    }
  }

  private updateDelivery(dt: number, targetX: number, targetY: number) {
    const delivery = this.delivery;
    if (!delivery) return;
    const card = delivery.card;
    if (!delivery.falling) {
      const dx = targetX - card.box.x;
      const dy = 170 - card.box.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const step = 620 * dt;
      this.moveCard(
        card,
        card.box.x + (dx / length) * Math.min(step, Math.abs(dx)),
        card.box.y + (dy / length) * Math.min(step, Math.abs(dy)),
      );
      if (Math.abs(dx) < 8 && Math.abs(dy) < 12) delivery.falling = true;
    } else {
      delivery.vy += 1200 * dt;
      this.moveCard(card, card.box.x, card.box.y + delivery.vy * dt);
      if (card.box.y >= targetY) {
        this.delivery = undefined;
        this.act(card);
      }
    }
  }

  private updateWater(dt: number) {
    const shot = this.particle;
    if (!shot) return;
    shot.node.y += shot.vy * dt;
    const index = shot.node.getData('tower') as number;
    const enemy = this.enemies[index];
    if (enemy && distance(shot.node.x, shot.node.y, enemy.x, enemy.y) < 62) {
      this.removeParticle();
      this.act(this.cards[index]!);
    } else if (shot.node.y < 30) this.removeParticle();
  }

  private act(card: Card) {
    if (!card || this.answered || !this.active) return false;
    return this.onAction(card.model);
  }

  hitTest(x: number, y: number) {
    return this.cardAt(x, y)?.model;
  }
  findByContent(contentId: string) {
    return this.cards.find(
      (card) =>
        card.model.contentId === contentId &&
        card.box.visible &&
        card.box.alpha > 0.1,
    )?.model;
  }
  feedback(objectId: string, kind: 'CORRECT' | 'RETRY' | 'HINT') {
    const found = this.cards.filter(
      (card) =>
        card.model.objectId === objectId ||
        (this.mode === 'picture-pairs' &&
          card.model.contentId ===
            this.cards.find((item) => item.model.objectId === objectId)?.model
              .contentId),
    );
    if (kind === 'HINT') {
      for (const card of this.cards.filter(
        (item) => item.model.contentId === found[0]?.model.contentId,
      )) {
        const frame = (card.covers[0] ??
          card.frame) as Phaser.GameObjects.Rectangle;
        const original = card.covers.length ? 0xffffff : 0x7b5a3a;
        frame.setStrokeStyle(9, 0xffd21f);
        this.scene.tweens.add({
          targets: card.box,
          scaleX: 1.13,
          scaleY: 1.13,
          yoyo: true,
          repeat: 2,
          duration: 180,
          onComplete: () => frame.setStrokeStyle(5, original),
        });
      }
      return;
    }
    if (kind === 'CORRECT') {
      this.answered = true;
      if (this.mode === 'little-builders') this.built++;
      for (const card of found) {
        if (this.mode === 'picture-pairs') this.reveal(card, true);
        this.scene.tweens.add({
          targets: card.box,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: this.mode === 'picture-pairs' ? 1 : 0.3,
          yoyo: true,
          duration: 260,
        });
        this.burst(card.box.x, card.box.y);
      }
      return;
    }
    this.turnBusy = false;
    this.racing = false;
    this.path = [];
    this.delivery = undefined;
    this.removeParticle();
    for (const card of found) {
      this.scene.tweens.add({
        targets: card.box,
        angle: 10,
        yoyo: true,
        repeat: 3,
        duration: 65,
        onComplete: () => card.box.setAngle(0),
      });
      if (this.mode === 'little-chef')
        this.moveCard(card, card.home.x, card.home.y);
    }
    if (this.mode === 'word-racers' && this.player)
      this.scene.tweens.add({ targets: this.player, y: 590, duration: 420 });
    if (this.mode === 'word-golf' && this.player) {
      this.player.setPosition(170, 570);
      this.playerV = { x: 0, y: 0 };
    }
    if (this.mode === 'sky-jumper' && this.player) {
      this.player.setPosition(100, 590);
      this.targetX = 100;
      this.playerV = { x: 0, y: 0 };
    }
    if (this.mode === 'maze-explorer' && this.player) {
      const start = this.mazeCenter(this.mazePlayerCell);
      this.player.setPosition(start.x, start.y);
    }
  }

  private burst(x: number, y: number) {
    for (let index = 0; index < 9; index++) {
      const angle = (index / 9) * Math.PI * 2;
      const star = this.scene.add.star(x, y, 5, 5, 12, 0xffd21f).setDepth(8);
      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 120,
        y: y + Math.sin(angle) * 100,
        alpha: 0,
        duration: 600,
        onComplete: () => star.destroy(),
      });
    }
  }

  private makeCard(item: SceneItem, x: number, y: number, size: number): Card {
    const frame = this.scene.add
      .rectangle(0, 0, size + 24, size + 24, 0xfff6dc)
      .setStrokeStyle(5, 0x7b5a3a);
    const art = this.scene.add
      .image(0, 0, item.image)
      .setDisplaySize(size, size);
    const box = this.add(this.scene.add.container(x, y, [frame, art]));
    box.setDepth(3);
    const card: Card = {
      model: {
        objectId: item.objectId,
        contentId: item.contentId,
        x,
        y,
        width: size + 24,
        height: size + 24,
      },
      box,
      art,
      frame,
      covers: [],
      home: { x, y },
      baseX: x,
      baseY: y,
    };
    this.cards.push(card);
    return card;
  }
  private moveCard(card: Card, x: number, y: number) {
    card.box.setPosition(x, y);
    card.model.x = x;
    card.model.y = y;
  }
  private cardAt(x: number, y: number) {
    return [...this.cards]
      .reverse()
      .find(
        (card) =>
          card.box.visible &&
          card.box.alpha > 0.1 &&
          Math.abs(x - card.box.x) < card.model.width / 2 &&
          Math.abs(y - card.box.y) < card.model.height / 2,
      );
  }
  private nearestCard(x: number, y: number) {
    let best = -1;
    let length = 160;
    this.cards.forEach((card, index) => {
      const next = distance(x, y, card.box.x, card.box.y);
      if (next < length) {
        best = index;
        length = next;
      }
    });
    // Race lanes remain tappable along their full height.
    if (best < 0 && this.mode === 'word-racers')
      this.cards.forEach((card, index) => {
        if (Math.abs(x - card.box.x) < 120 && y > 100 && y < 680) best = index;
      });
    return best;
  }
  private removeParticle() {
    this.particle?.node.destroy();
    this.particle = undefined;
  }
  private add<T extends Phaser.GameObjects.GameObject>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  private label(x: number, y: number, text: string, size: number) {
    const node = this.add(
      this.scene.add.text(x, y, text, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: `${size}px`,
        color: '#ffffff',
        stroke: '#31515b',
        strokeThickness: 5,
      }),
    );
    node.setOrigin(0.5);
  }

  show(items: SceneItem[]) {
    this.startArcade('picture-pairs', items, () => false, 0);
  }
  setShelf() {}
  clear() {
    this.clearRound();
    this.built = 0;
  }
  private clearRound() {
    this.active = false;
    this.answered = false;
    this.scene.events.off('update', this.update, this);
    this.scene.tweens.killAll();
    this.scene.time.removeAllEvents();
    for (const node of this.nodes) if (node.active) node.destroy();
    this.nodes = [];
    this.cards = [];
    this.enemies = [];
    this.platforms = [];
    this.player = undefined;
    this.particle = undefined;
    this.path = [];
    this.selected = undefined;
    this.dragging = undefined;
    this.delivery = undefined;
    this.racing = false;
    this.turnBusy = false;
    this.direction = 0;
    this.playerV = { x: 0, y: 0 };
  }
}

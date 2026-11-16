import type Phaser from 'phaser';
import type {
  IInputAdapter,
  InputSource,
  SwipeInputEvent,
} from '@english/contracts';

export type PointerGesture = 'TAP' | 'SWIPE' | 'DRAG';

/**
 * The only place that reads Phaser pointers. Coordinates are already in game-world
 * space (worldX/worldY), so mechanics never touch DOM or device events.
 */
class PointerAdapter implements IInputAdapter {
  readonly sources: InputSource[];
  private off = () => {};
  constructor(
    private scene: Phaser.Scene,
    private source: 'TOUCH' | 'MOUSE',
    private gesture: PointerGesture = 'TAP',
  ) {
    this.sources = [source];
  }
  private points: SwipeInputEvent['points'] = [];
  private pointerId: number | undefined;
  reset() {
    this.points = [];
    this.pointerId = undefined;
  }
  start(emit: Parameters<IInputAdapter['start']>[0]) {
    this.stop();
    const matches = (pointer: Phaser.Input.Pointer) =>
      pointer.wasTouch === (this.source === 'TOUCH');
    const sample = (pointer: Phaser.Input.Pointer) => ({
      x: pointer.worldX,
      y: pointer.worldY,
      timestamp: Date.now(),
    });
    const down = (pointer: Phaser.Input.Pointer) => {
      if (!matches(pointer) || this.pointerId !== undefined) return;
      this.pointerId = pointer.id;
      this.points = [sample(pointer)];
      if (this.gesture === 'DRAG')
        emit({ type: 'MOVE', source: this.source, ...sample(pointer) });
    };
    const move = (pointer: Phaser.Input.Pointer) => {
      if (!matches(pointer) || this.pointerId !== pointer.id || !pointer.isDown)
        return;
      if (this.gesture === 'DRAG') {
        emit({ type: 'MOVE', source: this.source, ...sample(pointer) });
        return;
      }
      const last = this.points.at(-1)!;
      if (Math.hypot(pointer.worldX - last.x, pointer.worldY - last.y) < 4)
        return;
      if (this.points.length >= 127) {
        this.reset();
        return;
      }
      this.points.push(sample(pointer));
    };
    const handler = (pointer: Phaser.Input.Pointer) => {
      if (!matches(pointer)) return;
      if (this.gesture === 'DRAG') {
        if (this.pointerId !== pointer.id) return;
        const points = [...this.points, sample(pointer)];
        const first = points[0]!;
        const last = points.at(-1)!;
        const short = Math.hypot(last.x - first.x, last.y - first.y) < 24;
        this.reset();
        if (short)
          emit({
            type: 'TAP',
            source: this.source,
            x: last.x,
            y: last.y,
            timestamp: Date.now(),
          });
        else
          emit({
            type: 'SWIPE',
            source: this.source,
            points,
            timestamp: Date.now(),
          });
        return;
      }
      if (this.gesture === 'SWIPE') {
        if (this.pointerId !== pointer.id) return;
        const points = [...this.points, sample(pointer)];
        this.reset();
        emit({
          type: 'SWIPE',
          source: this.source,
          points,
          timestamp: Date.now(),
        });
        return;
      }
      emit({
        type: 'TAP',
        source: this.source,
        x: pointer.worldX,
        y: pointer.worldY,
        timestamp: Date.now(),
      });
    };
    const cancel = () => this.reset();
    this.scene.input.on('pointerup', handler);
    if (this.gesture !== 'TAP') {
      this.scene.input.on('pointerdown', down);
      this.scene.input.on('pointermove', move);
      this.scene.input.on('pointerupoutside', cancel);
      this.scene.input.on('gameout', cancel);
    }
    this.off = () => {
      this.scene.input.off('pointerup', handler);
      this.scene.input.off('pointerdown', down);
      this.scene.input.off('pointermove', move);
      this.scene.input.off('pointerupoutside', cancel);
      this.scene.input.off('gameout', cancel);
    };
  }
  stop() {
    this.off();
    this.off = () => {};
    this.reset();
  }
}

export const createTouchAdapter = (
  scene: Phaser.Scene,
  gesture: PointerGesture = 'TAP',
): IInputAdapter => new PointerAdapter(scene, 'TOUCH', gesture);
export const createMouseAdapter = (
  scene: Phaser.Scene,
  gesture: PointerGesture = 'TAP',
): IInputAdapter => new PointerAdapter(scene, 'MOUSE', gesture);

/** Arrow keys and A/D feed the same mechanic as touch drag and screen buttons. */
export function createKeyboardAdapter(): IInputAdapter {
  const pressed = new Set<'LEFT' | 'RIGHT'>();
  let off = () => {};
  return {
    sources: ['KEYBOARD'],
    start(emit) {
      const send = () =>
        emit({
          type: 'STEER',
          source: 'KEYBOARD',
          direction: pressed.has('RIGHT') ? 1 : pressed.has('LEFT') ? -1 : 0,
          timestamp: Date.now(),
        });
      const direction = (key: string) =>
        key === 'ArrowLeft' || key.toLowerCase() === 'a'
          ? 'LEFT'
          : key === 'ArrowRight' || key.toLowerCase() === 'd'
            ? 'RIGHT'
            : undefined;
      const down = (event: KeyboardEvent) => {
        const value = direction(event.key);
        if (!value) return;
        event.preventDefault();
        pressed.add(value);
        if (!event.repeat) send();
      };
      const up = (event: KeyboardEvent) => {
        const value = direction(event.key);
        if (!value) return;
        event.preventDefault();
        pressed.delete(value);
        send();
      };
      const blur = () => {
        pressed.clear();
        send();
      };
      addEventListener('keydown', down);
      addEventListener('keyup', up);
      addEventListener('blur', blur);
      off = () => {
        removeEventListener('keydown', down);
        removeEventListener('keyup', up);
        removeEventListener('blur', blur);
      };
    },
    stop() {
      off();
      off = () => {};
      pressed.clear();
    },
    reset() {
      pressed.clear();
    },
  };
}

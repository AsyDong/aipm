import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createMouseAdapter, createTouchAdapter } from './pointer-adapters';
import { InputManager } from './input';

function sceneInput() {
  const handlers = new Map<string, Set<(p: unknown) => void>>();
  const input = {
    on: (name: string, fn: (p: unknown) => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(fn);
    },
    off: (name: string, fn: (p: unknown) => void) =>
      handlers.get(name)?.delete(fn),
  };
  return {
    scene: { input } as unknown as Phaser.Scene,
    emit: (name: string, pointer: unknown) =>
      handlers.get(name)?.forEach((fn) => fn(pointer)),
  };
}
const pointer = (x: number, touch = false, id = 1) => ({
  id,
  wasTouch: touch,
  worldX: x,
  worldY: 42,
  isDown: true,
});

it.each([false, true])(
  'collects one device-neutral world-coordinate swipe (touch=%s)',
  (touch) => {
    const t = sceneInput();
    const adapter = touch
      ? createTouchAdapter(t.scene, 'SWIPE')
      : createMouseAdapter(t.scene, 'SWIPE');
    const emit = vi.fn();
    adapter.start(emit);
    t.emit('pointerdown', pointer(10, touch));
    t.emit('pointermove', pointer(999, touch, 2)); // another finger never joins this gesture
    t.emit('pointermove', pointer(20, touch));
    t.emit('pointerup', pointer(30, touch));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0]).toMatchObject({
      type: 'SWIPE',
      source: touch ? 'TOUCH' : 'MOUSE',
      points: [
        { x: 10, y: 42 },
        { x: 20, y: 42 },
        { x: 30, y: 42 },
      ],
    });
    adapter.stop();
    t.emit('pointerup', pointer(40, touch));
    expect(emit).toHaveBeenCalledTimes(1);
  },
);

it('drops outside, overlong and prompt-crossing gestures and preserves Tap', () => {
  const t = sceneInput();
  const manager = new InputManager();
  manager.registerAdapter(createMouseAdapter(t.scene, 'SWIPE'));
  const emit = vi.fn();
  manager.subscribe(emit);
  manager.enable(['MOUSE']);
  for (const boundary of ['gameout', 'pointerupoutside']) {
    t.emit('pointerdown', pointer(10));
    t.emit(boundary, pointer(20));
    t.emit('pointerup', pointer(30));
  }
  t.emit('pointerdown', pointer(10));
  manager.disable();
  manager.enable(['MOUSE']);
  t.emit('pointerup', pointer(30));
  t.emit('pointerdown', pointer(0));
  for (let i = 1; i <= 130; i++) t.emit('pointermove', pointer(i * 4));
  t.emit('pointerup', pointer(600));
  expect(emit).not.toHaveBeenCalled();
  manager.destroy();
  const tap = createMouseAdapter(t.scene);
  tap.start(emit);
  t.emit('pointerup', pointer(30));
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'TAP', x: 30, y: 42 }),
  );
  tap.stop();
});

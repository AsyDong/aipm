import { expect, it, vi } from 'vitest';
import { InputManager } from './input';
import type { IInputAdapter, InputEvent } from '@english/contracts';

const event = {
  type: 'TAP' as const,
  source: 'TOUCH' as const,
  x: 100,
  y: 100,
  timestamp: 1,
};
it('filters sources, disabled input and invalid coordinates; unsubscribes', () => {
  const manager = new InputManager();
  const handler = vi.fn();
  const off = manager.subscribe(handler);
  manager.dispatch(event);
  expect(handler).not.toHaveBeenCalled();
  manager.enable(['TOUCH']);
  manager.dispatch({ ...event, source: 'MOUSE' });
  manager.dispatch({ ...event, x: NaN });
  expect(handler).not.toHaveBeenCalled();
  manager.dispatch(event);
  expect(handler).toHaveBeenCalledTimes(1);
  off();
  manager.dispatch(event);
  expect(handler).toHaveBeenCalledTimes(1);
  manager.destroy();
  manager.dispatch(event);
  expect(handler).toHaveBeenCalledTimes(1);
});

it('accepts SWIPE events from any device and rejects malformed trajectories', () => {
  const manager = new InputManager();
  const handler = vi.fn();
  manager.subscribe(handler);
  manager.enable(['MOUSE', 'TOUCH']);
  const swipe = (points: { x: number; y: number; timestamp: number }[]) =>
    ({ type: 'SWIPE', source: 'MOUSE', points, timestamp: 1 }) as InputEvent;
  manager.dispatch(swipe([]));
  manager.dispatch(swipe([{ x: 1, y: Infinity, timestamp: 1 }]));
  expect(handler).not.toHaveBeenCalled();
  manager.dispatch(
    swipe([
      { x: 1, y: 2, timestamp: 1 },
      { x: 5, y: 6, timestamp: 2 },
    ]),
  );
  expect(handler).toHaveBeenCalledTimes(1);
});

it('starts adapters on registration and stops them exactly once', () => {
  const manager = new InputManager();
  let emit: (e: InputEvent) => void = () => {};
  const stop = vi.fn();
  const adapter: IInputAdapter = {
    sources: ['TOUCH'],
    start: (fn) => {
      emit = fn;
    },
    stop,
  };
  const handler = vi.fn();
  manager.subscribe(handler);
  manager.enable(['TOUCH']);
  const unregister = manager.registerAdapter(adapter);
  emit(event);
  expect(handler).toHaveBeenCalledTimes(1);
  unregister();
  unregister();
  manager.destroy(); // must not stop a second time
  expect(stop).toHaveBeenCalledTimes(1);
});

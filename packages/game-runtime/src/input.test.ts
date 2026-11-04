import { expect, it, vi } from 'vitest';
import { InputManager } from './input';
it('filters sources, disabled input and invalid coordinates; unsubscribes', () => {
  const manager = new InputManager();
  const handler = vi.fn();
  const off = manager.subscribe(handler);
  const event = {
    type: 'TAP' as const,
    source: 'TOUCH' as const,
    x: 100,
    y: 100,
    timestamp: 1,
  };
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

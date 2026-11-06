import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  refresh: vi.fn(),
  destroy: vi.fn(),
  disconnect: vi.fn(),
  observe: vi.fn(),
}));
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    CANVAS: 1,
    Scale: { FIT: 1, CENTER_BOTH: 1 },
    Game: class {
      scale = { refresh: state.refresh };
      canvas = { remove: vi.fn() };
      destroy = state.destroy;
    },
  },
}));
import { createViewport } from './viewport';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('coalesces resize frames and cancels pending refresh and listeners on repeated disposal', async () => {
  const listeners = new Map<string, () => void>();
  let frame: (() => void) | undefined;
  const request = vi.fn((callback: () => void) => {
    frame = callback;
    return 42;
  });
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  vi.stubGlobal('addEventListener', (name: string, callback: () => void) =>
    listeners.set(name, callback),
  );
  vi.stubGlobal('removeEventListener', (name: string) =>
    listeners.delete(name),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = state.observe;
      disconnect = state.disconnect;
    },
  );
  const viewport = createViewport({} as HTMLElement);
  const resize = listeners.get('resize')!;
  resize();
  resize();
  resize();
  expect(request).toHaveBeenCalledTimes(1);
  frame!();
  expect(state.refresh).toHaveBeenCalledTimes(1);
  resize();
  await viewport.destroy();
  await viewport.destroy();
  expect(cancel).toHaveBeenCalledExactlyOnceWith(42);
  frame!();
  resize();
  expect(state.refresh).toHaveBeenCalledTimes(1);
  expect(state.destroy).toHaveBeenCalledTimes(1);
  expect(state.disconnect).toHaveBeenCalledTimes(1);
  expect(listeners.size).toBe(0);
});

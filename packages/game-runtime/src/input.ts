import type {
  IInputAdapter,
  IInputManager,
  InputEvent,
  InputSource,
} from '@english/contracts';

const finite = (value: number) => Number.isFinite(value);

function valid(event: InputEvent) {
  if (event.type === 'VOICE')
    return (
      event.source === 'VOICE' &&
      !!event.taskId &&
      !!event.sessionId &&
      (event.failure !== undefined || typeof event.text === 'string') &&
      (event.confidence === undefined ||
        (finite(event.confidence) &&
          event.confidence >= 0 &&
          event.confidence <= 1))
    );
  if (event.type === 'TAP') return finite(event.x) && finite(event.y);
  return (
    event.points.length >= 2 &&
    event.points.length <= 128 &&
    event.points.every(
      (point) => finite(point.x) && finite(point.y) && finite(point.timestamp),
    )
  );
}

export class InputManager implements IInputManager {
  private allowed = new Set<InputSource>();
  private handlers = new Set<(event: InputEvent) => void>();
  private adapters = new Set<IInputAdapter>();
  registerAdapter(adapter: IInputAdapter) {
    this.adapters.add(adapter);
    adapter.start((event) => this.dispatch(event));
    return () => {
      if (this.adapters.delete(adapter)) adapter.stop();
    };
  }
  enable(sources: InputSource[]) {
    for (const adapter of this.adapters) adapter.reset?.();
    this.allowed = new Set(sources);
  }
  disable() {
    for (const adapter of this.adapters) adapter.reset?.();
    this.allowed.clear();
  }
  subscribe(handler: (event: InputEvent) => void) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
  dispatch(event: InputEvent) {
    if (!this.allowed.has(event.source) || !valid(event)) return;
    for (const handler of [...this.handlers]) handler(event);
  }
  destroy() {
    this.disable();
    for (const adapter of this.adapters) adapter.stop();
    this.adapters.clear();
    this.handlers.clear();
  }
}

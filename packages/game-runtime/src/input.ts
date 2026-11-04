import type {
  IInputManager,
  InputEvent,
  InputSource,
} from '@english/contracts';

export class InputManager implements IInputManager {
  private allowed = new Set<InputSource>();
  private handlers = new Set<(event: InputEvent) => void>();
  enable(sources: InputSource[]) {
    this.allowed = new Set(sources);
  }
  disable() {
    this.allowed.clear();
  }
  subscribe(handler: (event: InputEvent) => void) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
  dispatch(event: InputEvent) {
    if (
      !this.allowed.has(event.source) ||
      !Number.isFinite(event.x) ||
      !Number.isFinite(event.y)
    )
      return;
    for (const handler of [...this.handlers]) handler(event);
  }
  destroy() {
    this.disable();
    this.handlers.clear();
  }
}

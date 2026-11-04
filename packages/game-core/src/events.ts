import type {
  EventPayloadMap,
  GameEvent,
  GameEventType,
  IEventBus,
} from '@english/contracts';

export class EventBus implements IEventBus {
  private listeners = new Map<GameEventType, Set<(event: GameEvent) => void>>();
  constructor(
    private gameId: string,
    private sessionId: string,
    private onError: (error: unknown) => void = console.error,
  ) {}
  on<K extends GameEventType>(type: K, handler: (event: GameEvent<K>) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    this.listeners.set(type, listeners);
    const erased = handler as (event: GameEvent) => void;
    listeners.add(erased);
    return () => {
      listeners.delete(erased);
    };
  }
  once<K extends GameEventType>(
    type: K,
    handler: (event: GameEvent<K>) => void,
  ) {
    const off = this.on(type, (event) => {
      off();
      handler(event);
    });
    return off;
  }
  emit<K extends GameEventType>(
    type: K,
    payload: EventPayloadMap[K],
    source = 'core',
  ) {
    const event: GameEvent<K> = {
      eventId: crypto.randomUUID(),
      type,
      gameId: this.gameId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      source,
      payload,
      version: '1.0.0',
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      try {
        listener(event);
      } catch (error) {
        try {
          this.onError(error);
        } catch {
          /* reporting cannot break dispatch */
        }
      }
    }
  }
  clear() {
    this.listeners.clear();
  }
}

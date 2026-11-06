import type {
  GameDefinition,
  IGameBridge,
  LearningContent,
  GameMessage,
  LearningOptions,
} from '@english/contracts';

/** Synchronous host handle; async Phaser import never mounts after disposal. */
export function mountAdventure(
  parent: HTMLElement,
  definition: GameDefinition,
  contents: LearningContent[],
  learning?: LearningOptions,
): IGameBridge {
  let inner: IGameBridge | undefined;
  let disposed = false;
  const listeners = new Set<(message: GameMessage) => void>();
  void import('./adventure')
    .then(({ createAdventure }) => {
      if (disposed) return;
      inner = createAdventure(parent, definition, contents, learning);
      inner.subscribe((message) => {
        for (const listener of listeners) listener(message);
      });
    })
    .catch((error: unknown) => {
      if (!disposed)
        for (const listener of listeners)
          listener({
            type: 'ERROR',
            code: 'LOAD_FAILED',
            message: error instanceof Error ? error.message : 'Unable to load',
          });
    });
  return {
    send(command) {
      inner?.send(command);
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    destroy() {
      disposed = true;
      listeners.clear();
      inner?.destroy();
    },
  };
}

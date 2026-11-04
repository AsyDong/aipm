import type { BootstrapRuntimePort } from '@english/contracts';

/** Async module loading can finish after React unmounts, so cancellation is checked first. */
export function mountBootstrapRuntime(
  parent: HTMLElement,
  port: BootstrapRuntimePort,
  onError: (error: unknown) => void,
): () => void {
  let disposed = false;
  let cleanup: (() => void) | undefined;

  void import('./phaser-bootstrap')
    .then(({ createPhaserBootstrap }) => {
      if (!disposed) cleanup = createPhaserBootstrap(parent, port);
    })
    .catch((error: unknown) => {
      if (!disposed) onError(error);
    });

  return () => {
    if (disposed) return;
    disposed = true;
    cleanup?.();
  };
}

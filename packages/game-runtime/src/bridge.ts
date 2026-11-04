import type {
  BootstrapBridge,
  BootstrapCommand,
  BootstrapMessage,
  BootstrapRuntimePort,
} from '@english/contracts';

export function createBootstrapBridge(
  onListenerError: (error: unknown) => void,
) {
  const messages = new Set<(message: BootstrapMessage) => void>();
  const commands = new Set<(command: BootstrapCommand) => void>();
  let destroyed = false;

  function dispatch<T>(listeners: Set<(value: T) => void>, value: T) {
    for (const handler of [...listeners]) {
      try {
        handler(value);
      } catch (error) {
        onListenerError(error);
      }
    }
  }

  const bridge: BootstrapBridge = {
    send(command) {
      if (!destroyed) dispatch(commands, command);
    },
    subscribe(handler) {
      if (!destroyed) messages.add(handler);
      return () => {
        messages.delete(handler);
      };
    },
  };
  const runtimePort: BootstrapRuntimePort = {
    publish(message) {
      if (!destroyed) dispatch(messages, message);
    },
    onCommand(handler) {
      if (!destroyed) commands.add(handler);
      return () => {
        commands.delete(handler);
      };
    },
  };

  return {
    bridge,
    runtimePort,
    destroy() {
      destroyed = true;
      messages.clear();
      commands.clear();
    },
  };
}

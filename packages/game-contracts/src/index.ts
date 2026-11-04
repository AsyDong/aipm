/** Phase 0 transport only. Learning and plugin contracts are defined in Phase 1. */
export type Unsubscribe = () => void;

export type BootstrapCommand = { type: 'PAUSE' } | { type: 'RESUME' };
export type BootstrapState = 'READY' | 'RUNNING' | 'PAUSED' | 'DESTROYED';
export type BootstrapMessage =
  { type: 'READY' } | { type: 'STATE_CHANGED'; state: BootstrapState };

/** Application-facing side. React never receives a Phaser reference. */
export interface BootstrapBridge {
  send(command: BootstrapCommand): void;
  subscribe(handler: (message: BootstrapMessage) => void): Unsubscribe;
}

/** Runtime-facing side, kept separate to prevent accidental command feedback loops. */
export interface BootstrapRuntimePort {
  publish(message: BootstrapMessage): void;
  onCommand(handler: (command: BootstrapCommand) => void): Unsubscribe;
}

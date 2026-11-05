import type {
  ContextFactory,
  GameContext,
  GameDefinition,
  GameLifecycleState,
  IGameEngine,
  IPlugin,
} from '@english/contracts';
import { EventBus } from './events';
import { PluginManager } from './plugins';
import { uuid } from './ids';
import { GameFailure } from './errors';

export class GameEngine implements IGameEngine {
  private lifecycle: GameLifecycleState = 'CREATED';
  private context: GameContext | undefined;
  private plugins: IPlugin[] = [];
  private dispose: (() => void | Promise<void>) | undefined;
  private definition: GameDefinition | undefined;
  private pending: Promise<void> | undefined;
  private destroying = false;
  constructor(
    private manager: PluginManager,
    private factory: ContextFactory,
  ) {}
  getState() {
    return this.lifecycle;
  }
  getContext() {
    if (!this.context) throw new Error('No active context');
    return this.context;
  }
  private require(state: GameLifecycleState) {
    if (this.lifecycle !== state || this.destroying)
      throw new Error(
        `Invalid lifecycle: ${this.lifecycle}, expected ${state}`,
      );
  }
  async initialize(definition: GameDefinition) {
    this.require('CREATED');
    this.lifecycle = 'INITIALIZING';
    this.definition = definition;
    const work = async () => {
      try {
        const validation = this.manager.validate(definition);
        if (!validation.valid)
          throw new GameFailure(
            'CONFIG_INVALID',
            'core',
            validation.errors.join('; '),
          );
        const readState = () => this.lifecycle;
        const base = {
          gameId: definition.id,
          sessionId: uuid(),
          definition,
          eventBus: new EventBus(definition.id, ''),
          state: {
            get lifecycle() {
              return readState();
            },
          },
        };
        base.eventBus = new EventBus(base.gameId, base.sessionId);
        const scope = this.factory(base);
        this.context = scope.context;
        this.dispose = scope.dispose;
        for (const spec of [definition.scene, definition.mechanic]) {
          const plugin = this.manager.create(spec);
          this.plugins.push(plugin); // Own it before initialize, including partial failures.
          await plugin.initialize(this.context, spec.config);
        }
        this.lifecycle = 'READY';
        this.context.eventBus.emit('GAME_INITIALIZED', {});
      } catch (error) {
        this.lifecycle = 'ERROR';
        await this.cleanup();
        throw error;
      }
    };
    this.pending = work();
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  async start() {
    this.require('READY');
    this.lifecycle = 'RUNNING';
    try {
      this.getContext().eventBus.emit('GAME_STARTED', {});
      for (const plugin of this.plugins) await plugin.start();
    } catch (error) {
      this.lifecycle = 'ERROR';
      await this.cleanup();
      throw error;
    }
  }
  pause() {
    this.require('RUNNING');
    this.lifecycle = 'PAUSED';
    for (const plugin of this.plugins) plugin.pause();
    this.context?.eventBus.emit('GAME_PAUSED', {});
  }
  resume() {
    this.require('PAUSED');
    this.lifecycle = 'RUNNING';
    for (const plugin of this.plugins) plugin.resume();
    this.context?.eventBus.emit('GAME_RESUMED', {});
  }
  complete(durationMs: number) {
    this.require('RUNNING');
    this.lifecycle = 'COMPLETED';
    this.context?.input?.disable();
    this.context?.eventBus.emit('GAME_COMPLETED', { durationMs });
  }
  async restart() {
    if (
      !['RUNNING', 'PAUSED', 'COMPLETED', 'ERROR'].includes(this.lifecycle) ||
      !this.definition ||
      this.destroying
    )
      throw new Error('Cannot restart');
    const definition = this.definition;
    await this.cleanup();
    this.lifecycle = 'CREATED';
    await this.initialize(definition);
    await this.start();
  }
  private async cleanup() {
    const errors: unknown[] = [];
    for (const plugin of this.plugins.splice(0).reverse()) {
      try {
        await plugin.destroy();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await this.dispose?.();
    } catch (error) {
      errors.push(error);
    }
    this.dispose = undefined;
    this.context?.eventBus.clear();
    this.context = undefined;
    for (const error of errors) console.error('Cleanup failure', error);
  }
  async destroy() {
    if (this.lifecycle === 'DESTROYED') return;
    if (this.destroying) {
      await this.pending;
      return;
    }
    this.destroying = true;
    try {
      await this.pending;
    } catch {
      /* initialize already cleaned failure */
    }
    const cleanup = this.cleanup();
    this.pending = cleanup;
    await cleanup;
    this.lifecycle = 'DESTROYED';
    this.pending = undefined;
  }
}

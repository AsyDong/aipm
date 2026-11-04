import { describe, expect, it, vi } from 'vitest';
import { EventBus, GameEngine, PluginManager } from './index';
import type {
  GameDefinition,
  PluginRegistration,
  GameContext,
} from '@english/contracts';

const definition: GameDefinition = {
  id: 'test',
  version: '1.0.0',
  schemaVersion: '1.0.0',
  name: 'Test',
  scene: { id: 'scene', version: '1.0.0', config: {} },
  mechanic: { id: 'tap', version: '1.0.0', config: {} },
  content: {
    curriculumId: 'sample',
    unitId: 'unit',
    items: [{ contentId: 'one' }],
  },
  input: { allowed: ['MOUSE', 'TOUCH'] },
  rules: { rounds: 1, allowRetry: true },
  reward: { type: 'STAR', successReward: 1 },
};

function registration(
  id: string,
  type: 'SCENE' | 'MECHANIC',
  overrides = {},
): PluginRegistration {
  return {
    metadata: {
      id,
      type,
      version: '1.0.0',
      apiVersion: '1.0.0',
      name: id,
      requiredCapabilities: type === 'MECHANIC' ? ['OBJECTS'] : [],
      capabilities: type === 'SCENE' ? ['OBJECTS'] : [],
      configSchema: { type: 'object', additionalProperties: false },
    },
    create: () => ({
      initialize: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      destroy: vi.fn(),
      ...overrides,
    }),
  };
}

describe('typed synchronous EventBus', () => {
  it('isolates listeners, unsubscribes, clears and makes once reentrancy safe', () => {
    const errors = vi.fn();
    const bus = new EventBus('game', 'session', errors);
    const listener = vi.fn();
    bus.on('GAME_STARTED', () => {
      throw new Error('bad listener');
    });
    const off = bus.on('GAME_STARTED', listener);
    bus.once('GAME_STARTED', () => bus.emit('GAME_STARTED', {}));
    bus.emit('GAME_STARTED', {});
    expect(listener).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledTimes(2);
    const event = listener.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      gameId: 'game',
      sessionId: 'session',
      version: '1.0.0',
    });
    expect(event.eventId).toBeTruthy();
    expect(event.timestamp).toBeGreaterThan(0);
    off();
    bus.clear();
    bus.emit('GAME_STARTED', {});
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('local plugin validation', () => {
  it('rejects duplicates, missing plugin, versions, config, capabilities and unknown definition fields', () => {
    const manager = new PluginManager();
    manager.register(registration('scene', 'SCENE'));
    manager.register(registration('tap', 'MECHANIC'));
    expect(manager.validate(definition).valid).toBe(true);
    expect(() => manager.register(registration('tap', 'MECHANIC'))).toThrow();
    expect(manager.validate({ ...definition, surprise: true }).valid).toBe(
      false,
    );
    expect(
      manager.validate({
        ...definition,
        mechanic: { ...definition.mechanic, id: 'missing' },
      }).valid,
    ).toBe(false);
    expect(
      manager.validate({
        ...definition,
        mechanic: { ...definition.mechanic, version: '2.0.0' },
      }).valid,
    ).toBe(false);
    expect(
      manager.validate({
        ...definition,
        scene: { ...definition.scene, config: { invalid: true } },
      }).valid,
    ).toBe(false);
    const incompatible = new PluginManager();
    incompatible.register(registration('tap', 'MECHANIC'));
    incompatible.register({
      ...registration('scene', 'SCENE'),
      metadata: {
        ...registration('scene', 'SCENE').metadata,
        capabilities: [],
      },
    });
    expect(incompatible.validate(definition).valid).toBe(false);
  });
});

describe('engine lifecycle and ownership', () => {
  function setup(fail = false) {
    const manager = new PluginManager();
    const sceneDestroy = vi.fn();
    const mechanicDestroy = vi.fn();
    manager.register(registration('scene', 'SCENE', { destroy: sceneDestroy }));
    manager.register(
      registration('tap', 'MECHANIC', {
        destroy: mechanicDestroy,
        initialize: fail
          ? () => {
              throw new Error('initialization');
            }
          : vi.fn(),
      }),
    );
    const release = vi.fn();
    const engine = new GameEngine(manager, (base) => ({
      context: base as GameContext,
      dispose: release,
    }));
    return { engine, sceneDestroy, mechanicDestroy, release };
  }
  it('enforces transitions, starts new sessions on restart, and destroys idempotently', async () => {
    const { engine, sceneDestroy, mechanicDestroy, release } = setup();
    await expect(engine.start()).rejects.toThrow();
    await engine.initialize(definition);
    expect(engine.getState()).toBe('READY');
    expect(() => engine.pause()).toThrow();
    const first = engine.getContext().sessionId;
    await engine.start();
    engine.pause();
    engine.resume();
    await engine.restart();
    expect(engine.getContext().sessionId).not.toBe(first);
    expect(engine.getState()).toBe('RUNNING');
    await engine.destroy();
    await engine.destroy();
    expect(sceneDestroy).toHaveBeenCalledTimes(2);
    expect(mechanicDestroy).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
    expect(engine.getState()).toBe('DESTROYED');
  });
  it('cleans partially initialized plugins and resources after failure', async () => {
    const { engine, sceneDestroy, mechanicDestroy, release } = setup(true);
    await expect(engine.initialize(definition)).rejects.toThrow(
      'initialization',
    );
    expect(engine.getState()).toBe('ERROR');
    expect(sceneDestroy).toHaveBeenCalledTimes(1);
    expect(mechanicDestroy).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    await engine.destroy();
    expect(sceneDestroy).toHaveBeenCalledTimes(1);
  });
});

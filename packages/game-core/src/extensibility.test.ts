import { expect, it, vi } from 'vitest';
import { GameEngine, PluginManager } from './index';
import type {
  GameContext,
  GameDefinition,
  IMechanicPlugin,
  InputEvent,
  PluginRegistration,
} from '@english/contracts';

/**
 * Acceptance E ("a new mechanic needs no Core change"): this stub is a complete
 * mechanic written against the public contracts only; Core is untouched.
 */
class ReactionMechanic implements IMechanicPlugin {
  static destroyed = vi.fn();
  private off = () => {};
  initialize(context: GameContext, config: Record<string, unknown>) {
    this.off = context.input.subscribe((event: InputEvent) => {
      if (event.type === 'TAP')
        context.eventBus.emit(
          'INPUT_RECEIVED',
          { inputType: 'REACTION', source: event.source },
          String(config.label),
        );
    });
  }
  start() {}
  pause() {}
  resume() {}
  destroy() {
    this.off();
    ReactionMechanic.destroyed();
  }
}
const reaction: PluginRegistration = {
  metadata: {
    id: 'reaction',
    name: 'Reaction',
    version: '1.0.0',
    apiVersion: '1.0.0',
    type: 'MECHANIC',
    requiredCapabilities: ['OBJECTS'],
    capabilities: ['TAP'],
    configSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['label'],
      properties: { label: { type: 'string' } },
    },
  },
  create: () => new ReactionMechanic(),
};
const scene: PluginRegistration = {
  metadata: {
    id: 'scene',
    name: 'Scene',
    version: '1.0.0',
    apiVersion: '1.0.0',
    type: 'SCENE',
    requiredCapabilities: [],
    capabilities: ['OBJECTS'],
    configSchema: { type: 'object' },
  },
  create: () => ({
    initialize() {},
    start() {},
    pause() {},
    resume() {},
    destroy() {},
  }),
};
const definition: GameDefinition = {
  id: 'r',
  version: '1.0.0',
  schemaVersion: '1.0.0',
  name: 'Reaction',
  scene: { id: 'scene', version: '1.0.0', config: {} },
  mechanic: { id: 'reaction', version: '1.0.0', config: { label: 'r1' } },
  content: { curriculumId: 'c', unitId: 'u', items: [{ contentId: 'a' }] },
  input: { allowed: ['MOUSE'] },
  rules: { rounds: 1, allowRetry: true },
  reward: { type: 'STAR', successReward: 1 },
};

it('registers, validates, runs and cleans up a brand-new mechanic using only public APIs', async () => {
  const manager = new PluginManager();
  manager.register(scene);
  manager.register(reaction);
  expect(manager.validate(definition).valid).toBe(true);
  // The plugin's own config schema is enforced.
  expect(
    manager.validate({
      ...definition,
      mechanic: { ...definition.mechanic, config: {} },
    }).valid,
  ).toBe(false);

  const handlers = new Set<(e: InputEvent) => void>();
  const engine = new GameEngine(manager, (base) => ({
    context: {
      ...base,
      input: {
        subscribe: (h: (e: InputEvent) => void) => {
          handlers.add(h);
          return () => handlers.delete(h);
        },
      },
    } as unknown as GameContext,
    dispose: () => {},
  }));
  await engine.initialize(definition);
  await engine.start();
  const seen = vi.fn();
  engine.getContext().eventBus.on('INPUT_RECEIVED', seen);
  [...handlers][0]?.({
    type: 'TAP',
    source: 'MOUSE',
    x: 1,
    y: 1,
    timestamp: 1,
  });
  expect(seen).toHaveBeenCalledTimes(1);
  expect(seen.mock.calls[0]?.[0].source).toBe('r1');
  await engine.destroy();
  expect(ReactionMechanic.destroyed).toHaveBeenCalledTimes(1);
  expect(handlers.size).toBe(0); // no listener left behind
});

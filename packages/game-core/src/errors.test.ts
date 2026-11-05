import { expect, it } from 'vitest';
import { EventBus, GameEngine, GameFailure, PluginManager } from './index';
import type { GameContext, GameDefinition } from '@english/contracts';

it('rejects an invalid definition with a typed, non-silent CONFIG_INVALID failure', async () => {
  const engine = new GameEngine(new PluginManager(), (base) => ({
    context: {
      ...base,
      eventBus: new EventBus('g', 's'),
    } as unknown as GameContext,
    dispose: () => {},
  }));
  const error = await engine
    .initialize({ id: 'x' } as unknown as GameDefinition)
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GameFailure);
  expect(error).toMatchObject({
    code: 'CONFIG_INVALID',
    module: 'core',
    recoverable: false,
  });
  expect(engine.getState()).toBe('ERROR');
});

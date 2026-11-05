import { expect, it } from 'vitest';
import { validateAdventure } from './validate-adventure';
import { definitionFor } from '../../../apps/web/src/content';

it('rejects reserved options that the current adventure cannot execute', () => {
  const definition = definitionFor('powerup0-listen-find');
  expect(() => validateAdventure(definition)).not.toThrow();
  expect(() =>
    validateAdventure({
      ...definition,
      rules: { ...definition.rules, allowRetry: false },
    }),
  ).toThrow('retries');
  expect(() =>
    validateAdventure({
      ...definition,
      rules: { ...definition.rules, timeLimitMs: 5000 },
    }),
  ).toThrow('time limit');
  expect(() =>
    validateAdventure({
      ...definition,
      reward: { ...definition.reward, type: 'BADGE' },
    }),
  ).toThrow('star');
});

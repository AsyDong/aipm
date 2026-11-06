import { expect, it } from 'vitest';
import { validateComposition } from './composer';
import definition from '../../../apps/web/src/data/powerup0-listen-find.json';
import contents from '../../../apps/web/src/data/contents.json';
import { parseContents } from '@english/learning-core';

const content = parseContents(contents);
it('validates all three local mechanics using the same scene and standard schema', async () => {
  for (const id of ['tap', 'slice', 'voice-match']) {
    const game = structuredClone(definition);
    game.mechanic = {
      id,
      version: '1.0.0',
      config: {} as typeof game.mechanic.config,
    };
    game.input.allowed = id === 'voice-match' ? ['VOICE'] : ['MOUSE', 'TOUCH'];
    expect((await validateComposition(game, content)).mechanic.id).toBe(id);
  }
});
it('rejects malformed JSON shapes, unsupported combinations, ownership and options', async () => {
  await expect(validateComposition({}, content)).rejects.toThrow();
  await expect(
    validateComposition(
      { ...definition, input: { allowed: ['VOICE'] } },
      content,
    ),
  ).rejects.toThrow('matching mechanic');
  await expect(
    validateComposition(
      { ...definition, scene: { ...definition.scene, id: 'remote' } },
      content,
    ),
  ).rejects.toThrow('Unknown');
  await expect(
    validateComposition(
      { ...definition, content: { ...definition.content, unitId: 'foreign' } },
      content,
    ),
  ).rejects.toThrow('ownership');
  await expect(
    validateComposition(
      { ...definition, difficulty: { optionCount: 6 } },
      content,
    ),
  ).rejects.toThrow('exceeds');
});

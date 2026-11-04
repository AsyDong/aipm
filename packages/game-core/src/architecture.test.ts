import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('keeps core, contracts and learning independent of rendering frameworks', () => {
  for (const name of ['game-core', 'game-contracts', 'learning-core']) {
    const root = resolve('packages', name, 'src');
    for (const file of readdirSync(root).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    )) {
      expect(readFileSync(resolve(root, file), 'utf8')).not.toMatch(
        /from ['"](?:phaser|react|@english\/game-scenes|@english\/game-mechanics)/,
      );
    }
  }
});

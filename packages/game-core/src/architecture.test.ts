import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === 'node_modules' || name === 'dist' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every import/export specifier in the production sources under a directory. */
function imports(dir: string) {
  return sources(resolve(dir)).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => ({
      file,
      spec: m[1]!,
    }));
  });
}
const forbid = (dir: string, pattern: RegExp) =>
  imports(dir).filter(({ spec }) => pattern.test(spec));
const pkg = (name: string) => `packages/${name}/src`;

const FRAMEWORKS = /^(phaser|react|react-dom)(\/|$)/;
const ENGINE_LAYERS =
  /game-scenes|game-mechanics|game-runtime|@english\/runtime/;

describe('dependency rules (task book 1.3)', () => {
  it('keeps core, contracts, learning and speech free of rendering frameworks', () => {
    for (const name of [
      'game-core',
      'game-contracts',
      'learning-core',
      'speech-core',
    ])
      expect(forbid(pkg(name), FRAMEWORKS), name).toEqual([]);
  });
  it('keeps core and learning independent of scenes, mechanics and runtime', () => {
    for (const name of ['game-core', 'learning-core'])
      expect(forbid(pkg(name), ENGINE_LAYERS), name).toEqual([]);
  });
  it('keeps scenes and mechanics independent of each other and of runtime', () => {
    expect(forbid(pkg('game-scenes'), /game-mechanics|runtime/)).toEqual([]);
    expect(forbid(pkg('game-mechanics'), /game-scenes|runtime/)).toEqual([]);
  });
  it('keeps mechanics free of Phaser and of curriculum data', () => {
    expect(forbid(pkg('game-mechanics'), FRAMEWORKS)).toEqual([]);
    expect(forbid(pkg('game-mechanics'), /learning-core|apps\/web/)).toEqual(
      [],
    );
  });
  it('lets the web app reach the game only through the runtime bridge', () => {
    expect(
      forbid(
        'apps/web/src',
        /^phaser(\/|$)|game-scenes|game-mechanics|game-core/,
      ),
    ).toEqual([]);
  });
  it('does not hard-code vocabulary in mechanics or scenes', () => {
    const words = /\b(apple|banana|grapes|orange|watermelon|pear)\b/i;
    for (const name of ['game-mechanics', 'game-scenes'])
      for (const file of sources(resolve(pkg(name))))
        expect(readFileSync(file, 'utf8'), file).not.toMatch(words);
  });
});

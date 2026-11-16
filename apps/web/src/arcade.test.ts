import { describe, expect, it } from 'vitest';
import { ARCADE_MODES } from '@english/contracts';
import { arcadeDefinition, arcadeGames, nextArcadeLevel } from './arcade';
import { definitionFor, world } from './content';

it('offers ten distinct modes and preserves the selected lesson contracts', () => {
  expect(arcadeGames.map((game) => game.mode)).toEqual([...ARCADE_MODES]);
  const level = world.levels.find((item) => item.game === 'hello-greet')!;
  const base = definitionFor(level.game!);
  for (const mode of ARCADE_MODES) {
    const game = arcadeDefinition(level, mode);
    expect(game.content).toEqual(base.content);
    expect(game.rules).toEqual(base.rules);
    expect(game.reward).toEqual(base.reward);
    expect(game.scene.id).toBe('arcade-world');
    expect(game.mechanic).toEqual({
      id: 'arcade',
      version: '1.0.0',
      config: { mode },
    });
    expect(game.difficulty!.optionCount).toBeLessThanOrEqual(
      mode === 'word-racers' ? 3 : 4,
    );
  }
});

describe('automatic lesson selection', () => {
  it('starts at the first unfinished unlocked story stop', () => {
    expect(nextArcadeLevel({})?.game).toBe('hello-greet');
  });
  it('advances after saved completion and honors a stop chosen by the child', () => {
    const first = world.levels.find((item) => item.game === 'hello-greet')!;
    const second = world.levels.find((item) => item.game === 'hello-bus')!;
    expect(nextArcadeLevel({ [first.id]: 3 })?.id).toBe(second.id);
    expect(nextArcadeLevel({}, second)?.id).toBe(second.id);
  });
});

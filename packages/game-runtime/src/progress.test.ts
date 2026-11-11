import { afterEach, expect, it, vi } from 'vitest';
import {
  gameStars,
  loadStars,
  saveStars,
} from '../../../apps/web/src/progress';
import {
  allContent,
  definitionFor,
  nextStoryLevel,
  storyLevels,
} from '../../../apps/web/src/content';
import { ContentResolver, createTasks } from '@english/learning-core';

afterEach(() => vi.unstubAllGlobals());

it('authors counting questions with same-food alternatives and distinct quantities', async () => {
  const game = definitionFor('u3-count');
  const content = await new ContentResolver(allContent).resolve(game.content);
  const tasks = createTasks(
    content,
    game.rules.rounds!,
    game.difficulty!.optionCount,
    () => 0.2,
    game.rules.progression?.mode,
  );
  for (const task of tasks) {
    const prefix = task.target.assets.image.replace(/\d+\.webp$/, '');
    expect(task.candidates).toHaveLength(game.difficulty!.optionCount);
    expect(
      task.candidates.every((candidate) =>
        candidate.assets.image.startsWith(prefix),
      ),
    ).toBe(true);
    expect(
      new Set(task.candidates.map((candidate) => candidate.assets.image)).size,
    ).toBe(game.difficulty!.optionCount);
    // Every count-pack task shows a picture to count or food to pack.
    expect(task.target.illustration).toBeTruthy();
  }
  // The delivery station counts first (numeral targets), then packs (quantity).
  expect(
    tasks.slice(0, 2).every((task) => task.target.quantity === undefined),
  ).toBe(true);
  expect(tasks.slice(2).every((task) => (task.target.quantity ?? 0) >= 2)).toBe(
    true,
  );
  // Numeral answers are numerals only; counted answers stay the same food.
  expect(tasks[0]!.candidates.every((c) => c.id.includes('numeral'))).toBe(
    true,
  );
  expect(nextStoryLevel(storyLevels[2]!)?.id).toBe('fruit-market');
  expect(nextStoryLevel(storyLevels.at(-1)!)).toBeUndefined();
  expect(definitionFor('hello-board').content.items.at(-1)?.contentId).toBe(
    'powerup0-unit0-boat',
  );
  expect(definitionFor('hello-board').rules.progression?.mode).toBe(
    'SEQUENTIAL',
  );
});

it('uses the actual maximum for short, counted and six-round games', () => {
  for (const [id, points] of [
    ['hello-greet', 4],
    ['hello-bus', 5],
    ['u3-count', 7],
    ['u3-picnic', 7],
  ] as const)
    expect(gameStars(points, definitionFor(id))).toBe(3);
});

it('preserves old keys and merges renamed levels without losing a higher result', () => {
  let stored = JSON.stringify({
    'voice-market': 6,
    waterfall: 4,
    'fruit-kitchen': 6,
    market: 6,
  });
  vi.stubGlobal('localStorage', {
    getItem: () => stored,
    setItem: (_: string, value: string) => {
      stored = value;
    },
  });
  expect(loadStars()).toMatchObject({
    'talking-market': 6,
    'fruit-kitchen': 6,
    market: 6,
  });
  saveStars('harbour-friends', 4);
  expect(loadStars()).toMatchObject({
    'voice-market': 6,
    waterfall: 4,
    'harbour-friends': 4,
  });
  expect(loadStars()['fruit-market']).toBeUndefined();
});

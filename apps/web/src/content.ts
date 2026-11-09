import type { GameDefinition } from '@english/contracts';
import { parseContents } from '@english/learning-core';
import contentData from './data/contents.json';
import curriculumGame from './data/powerup0-listen-find.json';
import demoGame from './data/fruit-sampler.json';
import worldData from './data/world.json';
import guideData from './data/guide.json';

/**
 * Levels, vocabulary and the world map are data, not code: edit src/data/*.json.
 * Content is checked at load; each definition is validated by the runtime before
 * it starts. Power Up 0 Unit 3 entries were verified against printed page 28.
 * The Friendly World sample nodes share one Listen & Find template below; the
 * Slice and Voice Match variants reuse the curriculum definition as before.
 */
export const allContent = parseContents(contentData);

const FRUITS = ['apple', 'banana', 'grapes', 'orange', 'watermelon'].map(
  (word) => ({ contentId: `powerup0-unit3-${word}` }),
);
const FOODS = ['rice', 'beans', 'egg', 'burger', 'carrot'].map((word) => ({
  contentId: `powerup0-unit3-${word}`,
}));
const COUNTS = [
  { contentId: 'powerup0-unit3-count-apples-3' },
  { contentId: 'powerup0-unit3-count-bananas-6' },
  { contentId: 'powerup0-unit3-count-oranges-2' },
  { contentId: 'powerup0-unit3-count-burgers-4' },
  { contentId: 'powerup0-unit3-count-eggs-5' },
];
const CHARACTERS = ['cameron', 'jim', 'jenny'].map((name) => ({
  contentId: `powerup0-unit0-${name}`,
}));
const BUSES = ['red', 'blue', 'green', 'yellow'].map((color) => ({
  contentId: `powerup0-unit0-bus-${color}`,
}));
const HELLO_UNIT = { curriculumId: 'powerup-0', unitId: 'unit-0' };
const U3_UNIT = { curriculumId: 'powerup-0', unitId: 'unit-3' };

/** One Listen & Find node: the same loop, only content and pacing change. */
function listenFind(
  id: string,
  items: { contentId: string }[],
  options: {
    rounds: number;
    optionCount: number;
    unit: { curriculumId: string; unitId: string };
    theme?: 'MARKET' | 'FOREST' | 'HARBOUR';
  },
): GameDefinition {
  return {
    id,
    version: '1.0.0',
    schemaVersion: '1.0.0',
    name: 'Listen & Find',
    scene: {
      id: 'fruit-world',
      version: '1.0.0',
      config: { theme: options.theme ?? 'MARKET' },
    },
    mechanic: {
      id: 'tap',
      version: '1.0.0',
      config: { selectionMode: 'SINGLE' },
    },
    content: { ...options.unit, items },
    input: { allowed: ['MOUSE', 'TOUCH'] },
    rules: {
      rounds: options.rounds,
      allowRetry: true,
      timeLimitMs: null,
      hintPolicy: { enabled: true, afterAttempts: 0, hintLevel: 1 },
      progression: { mode: 'RANDOM' },
    },
    reward: { type: 'STAR', successReward: 1, completionBonus: 1 },
    difficulty: { optionCount: options.optionCount },
  };
}

const games: Record<string, GameDefinition> = {
  'powerup0-listen-find': curriculumGame as GameDefinition,
  'fruit-sampler': demoGame as GameDefinition,
  'powerup0-slice': {
    ...curriculumGame,
    id: 'powerup0-slice',
    name: 'Listen & Slice',
    mechanic: { id: 'slice', version: '1.0.0', config: { minDistance: 32 } },
  } as GameDefinition,
  'powerup0-voice-match': {
    ...curriculumGame,
    id: 'powerup0-voice-match',
    name: 'Listen & Say',
    mechanic: { id: 'voice-match', version: '1.0.0', config: {} },
    input: { allowed: ['VOICE'] },
  } as GameDefinition,
  // Welcome Harbour (Hello): greet, ride, board.
  'hello-greet': listenFind('hello-greet', CHARACTERS, {
    rounds: 3,
    optionCount: 3,
    unit: HELLO_UNIT,
    theme: 'HARBOUR',
  }),
  'hello-bus': listenFind('hello-bus', BUSES, {
    rounds: 4,
    optionCount: 3,
    unit: HELLO_UNIT,
    theme: 'HARBOUR',
  }),
  'hello-board': listenFind(
    'hello-board',
    [{ contentId: 'powerup0-unit0-boat' }, ...BUSES.slice(0, 2), ...CHARACTERS],
    { rounds: 5, optionCount: 3, unit: HELLO_UNIT, theme: 'HARBOUR' },
  ),
  // Market Street (Unit 3): basket, stall, grocery, counting, picnic.
  'u3-basket': listenFind('u3-basket', FRUITS, {
    rounds: 5,
    optionCount: 2,
    unit: U3_UNIT,
  }),
  'u3-stall': listenFind('u3-stall', FRUITS, {
    rounds: 5,
    optionCount: 5,
    unit: U3_UNIT,
  }),
  'u3-grocery': listenFind('u3-grocery', FOODS, {
    rounds: 5,
    optionCount: 3,
    unit: U3_UNIT,
  }),
  'u3-count': listenFind('u3-count', COUNTS, {
    rounds: 5,
    optionCount: 3,
    unit: U3_UNIT,
  }),
  'u3-picnic': listenFind('u3-picnic', [...FRUITS, ...FOODS], {
    rounds: 6,
    optionCount: 4,
    unit: U3_UNIT,
  }),
};
export function definitionFor(gameId: string): GameDefinition {
  const game = games[gameId];
  if (!game) throw new Error(`Unknown game: ${gameId}`);
  return game;
}

export type GuideKey = keyof typeof guideData;
/** On-screen text for a guide line; {word} is filled in once the answer is revealed.
 *  A level may bring its own spoken HELLO line so every place introduces itself. */
export const guideText = (key: GuideKey, word?: string, level?: WorldLevel) =>
  key === 'HELLO' && level?.hello
    ? level.hello
    : guideData[key].text.replace('{word}', word ?? 'right');
/** Spoken file for a guide line, or undefined when the line is text-only. */
export const guideAudio = (key: GuideKey, level?: WorldLevel) => {
  if (key === 'HELLO' && level?.hello)
    return `/audio/guide/hello-${level.id}.mp3`;
  return key === 'LISTEN' ? undefined : `/audio/guide/${key.toLowerCase()}.mp3`;
};

export interface WorldLevel {
  id: string;
  title: string;
  subtitle?: string;
  game?: string;
  locked?: boolean;
  x: number;
  y: number;
  /** Story context shown before the level starts. */
  story?: string;
  /** This place's own spoken welcome line; audio lives at hello-<id>.mp3. */
  hello?: string;
}
export const world = worldData as { title: string; levels: WorldLevel[] };

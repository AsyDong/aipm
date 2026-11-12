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
 * Market Street stops share the Listen & Find builder but differ in what the
 * child does: fill a basket, stock a shelf, shop from a list, count and pack
 * (the Count & Pack mechanic), slice onto a plate, and serve the friends.
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
  { contentId: 'powerup0-unit3-count-oranges-2' },
  { contentId: 'powerup0-unit3-count-burgers-4' },
  { contentId: 'powerup0-unit3-count-eggs-5' },
];
/** Two count-the-group rounds, then four pack-the-box rounds; six apples is
 *  pool-only so even a full box can be judged (and repacked after a miss). */
const COUNT_PACK = [
  { contentId: 'powerup0-unit3-numeral-3' },
  { contentId: 'powerup0-unit3-numeral-4' },
  ...COUNTS,
  { contentId: 'powerup0-unit3-count-apples-6' },
];
/** Shared by the scene (drawn box) and the mechanic (tap-to-finish zone). */
const PACK_BOX = { x: 1000, y: 540, width: 260, height: 220 };
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
    progression?: 'SEQUENTIAL' | 'RANDOM';
    place?: 'BASKET' | 'SHELF' | 'PLATE' | 'CHARACTERS' | 'BOX';
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
      config: { theme: options.theme ?? 'MARKET', place: options.place },
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
      progression: { mode: options.progression ?? 'RANDOM' },
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
    [...CHARACTERS, ...BUSES.slice(0, 2), { contentId: 'powerup0-unit0-boat' }],
    {
      rounds: 6,
      optionCount: 3,
      unit: HELLO_UNIT,
      theme: 'HARBOUR',
      progression: 'SEQUENTIAL',
    },
  ),
  // Market Street (Unit 3): each stop now works differently, not just new words.
  // 1 Entrance: a friend hands over a basket that visibly fills.
  'u3-basket': listenFind('u3-basket', FRUITS, {
    rounds: 5,
    optionCount: 2,
    unit: U3_UNIT,
    place: 'BASKET',
  }),
  // 2 Stall: meet the five fruits first (level.meet), then stock the shelf
  // in a fixed order so the empty stall becomes a full one.
  'u3-stall': listenFind('u3-stall', FRUITS, {
    rounds: 5,
    optionCount: 5,
    unit: U3_UNIT,
    place: 'SHELF',
    progression: 'SEQUENTIAL',
  }),
  // 3 Grocery: a picture shopping list (level.checklist), food into the basket.
  'u3-grocery': listenFind('u3-grocery', FOODS, {
    rounds: 5,
    optionCount: 3,
    unit: U3_UNIT,
    place: 'BASKET',
  }),
  // 4 Delivery station: count a group and tap the numeral, then pack the
  // heard quantity into the box and tap the box. A different interaction,
  // not another listen-and-point round.
  'u3-count': {
    id: 'u3-count',
    version: '1.0.0',
    schemaVersion: '1.0.0',
    name: 'Count & Pack',
    scene: {
      id: 'fruit-world',
      version: '1.0.0',
      config: { theme: 'MARKET', place: 'BOX', box: PACK_BOX },
    },
    mechanic: {
      id: 'count-pack',
      version: '1.0.0',
      config: { box: PACK_BOX },
    },
    content: { ...U3_UNIT, items: COUNT_PACK },
    input: { allowed: ['MOUSE', 'TOUCH'] },
    rules: {
      rounds: 6,
      allowRetry: true,
      timeLimitMs: null,
      hintPolicy: { enabled: true, afterAttempts: 0, hintLevel: 1 },
      progression: { mode: 'SEQUENTIAL' },
    },
    reward: { type: 'STAR', successReward: 1, completionBonus: 1 },
    difficulty: { optionCount: 4 },
  } as GameDefinition,
  // 5 Kitchen: slice the right fruit; the plate fills piece by piece.
  'u3-kitchen': {
    ...curriculumGame,
    id: 'u3-kitchen',
    name: 'Listen & Slice',
    mechanic: { id: 'slice', version: '1.0.0', config: { minDistance: 32 } },
    scene: {
      id: 'fruit-world',
      version: '1.0.0',
      config: { theme: 'MARKET', place: 'PLATE' },
    },
  } as GameDefinition,
  // 6 Picnic: friends take turns asking; each gets the food they asked for.
  'u3-picnic': listenFind('u3-picnic', [...FRUITS, ...FOODS], {
    rounds: 6,
    optionCount: 4,
    unit: U3_UNIT,
    place: 'CHARACTERS',
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
    : key === 'ASK' && level?.ask
      ? level.ask
      : guideData[key].text.replace('{word}', word ?? 'right');
/** Spoken file for a guide line, or undefined when the line is text-only. */
export const guideAudio = (key: GuideKey, level?: WorldLevel) => {
  if (key === 'HELLO' && level?.hello)
    return `/audio/guide/hello-${level.id}.mp3`;
  return key === 'LISTEN' ? undefined : `/audio/guide/${key.toLowerCase()}.mp3`;
};

export interface MapPoint {
  x: number;
  y: number;
}
export interface MapPerson extends MapPoint {
  image: string;
  size: number;
}
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
  /** A stop's own question line while the child chooses (e.g. "How many?"). */
  ask?: string;
  /** Meet-the-words strip on the intro overlay: tap a picture, hear its word. */
  meet?: string[];
  /** The grocery stop shows its whole shopping list, ticking off what is found. */
  checklist?: boolean;
  chapter?: string;
  order?: number;
  collection?: string;
  outcome?: string;
  marker?: string;
  unitId?: string;
  /** Road waypoints from the previous stop to the front of this location. */
  walk?: MapPoint[];
}
export interface WorldUnit {
  id: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  marker: string;
  scene: string;
  /** Unit map art; falls back to the world overview when absent. */
  map?: string;
  start?: MapPoint;
  people?: MapPerson[];
}
export const world = worldData as {
  title: string;
  people?: MapPerson[];
  units: WorldUnit[];
  levels: WorldLevel[];
};
export const storyLevels = world.levels.filter((level) => level.chapter);
export const nextStoryLevel = (level: WorldLevel) =>
  level.chapter
    ? storyLevels[storyLevels.findIndex((item) => item.id === level.id) + 1]
    : undefined;

/** A finished stop (at least one raw star) opens the next playable stop. */
export const levelUnlocked = (
  level: WorldLevel,
  stars: Record<string, number>,
) => {
  const levels = world.levels.filter((item) => item.unitId === level.unitId);
  const index = levels.findIndex((item) => item.id === level.id);
  const previous = levels
    .slice(0, Math.max(0, index))
    .reverse()
    .find((item) => item.game && !item.locked);
  return (
    !!level.game &&
    !level.locked &&
    (!previous || (stars[previous.id] ?? 0) > 0)
  );
};

/** Skip empty future units so the playable U0 → U3 journey never dead-ends. */
export const unitUnlocked = (
  unit: WorldUnit,
  stars: Record<string, number>,
) => {
  const playable = world.units.filter((item) =>
    world.levels.some((level) => level.unitId === item.id && level.chapter),
  );
  const previous =
    playable[playable.findIndex((item) => item.id === unit.id) - 1];
  return (
    playable.some((item) => item.id === unit.id) &&
    (!previous ||
      world.levels
        .filter((level) => level.unitId === previous.id && level.chapter)
        .every((level) => (stars[level.id] ?? 0) > 0))
  );
};

/** Follow each stop's road waypoints forwards, or retrace them for a replay. */
export const routeTo = (
  levels: WorldLevel[],
  currentIndex: number,
  targetIndex: number,
): MapPoint[] => {
  const path = (level: WorldLevel) => level.walk ?? [level];
  if (targetIndex > currentIndex)
    return levels
      .slice(currentIndex + 1, targetIndex + 1)
      .flatMap((level) => path(level));
  return levels
    .slice(targetIndex + 1, currentIndex + 1)
    .reverse()
    .flatMap((level) => [...path(level)].reverse());
};

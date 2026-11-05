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
 */
export const allContent = parseContents(contentData);

const games: Record<string, GameDefinition> = {
  'powerup0-listen-find': curriculumGame as GameDefinition,
  'fruit-sampler': demoGame as GameDefinition,
};
export function definitionFor(gameId: string): GameDefinition {
  const game = games[gameId];
  if (!game) throw new Error(`Unknown game: ${gameId}`);
  return game;
}

export type GuideKey = keyof typeof guideData;
/** On-screen text for a guide line; {word} is filled in once the answer is revealed. */
export const guideText = (key: GuideKey, word?: string) =>
  guideData[key].text.replace('{word}', word ?? 'right');
/** Spoken file for a guide line, or undefined when the line is text-only. */
export const guideAudio = (key: GuideKey) =>
  key === 'LISTEN' ? undefined : `/audio/guide/${key.toLowerCase()}.mp3`;

export interface WorldLevel {
  id: string;
  title: string;
  subtitle?: string;
  game?: string;
  locked?: boolean;
  x: number;
  y: number;
}
export const world = worldData as { title: string; levels: WorldLevel[] };

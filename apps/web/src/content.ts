import type { GameDefinition } from '@english/contracts';
import { parseContents } from '@english/learning-core';
import contentData from './data/contents.json';
import curriculumGame from './data/powerup0-listen-find.json';
import demoGame from './data/fruit-sampler.json';

/**
 * Levels and vocabulary are data, not code: edit src/data/*.json. Content is
 * checked at load; each definition is validated by the runtime before it starts.
 * Power Up 0 Unit 3 entries were verified against printed page 28 of the textbook.
 */
export const allContent = parseContents(contentData);
export function definitionFor(mode: 'CURRICULUM' | 'DEMO'): GameDefinition {
  return (mode === 'CURRICULUM' ? curriculumGame : demoGame) as GameDefinition;
}

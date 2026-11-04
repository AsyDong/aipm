import type { GameDefinition, LearningContent } from '@english/contracts';

/** Verified against the supplied scanned textbook, printed page 28. */
export const curriculumContent: LearningContent[] = [
  'apple',
  'banana',
  'grapes',
  'orange',
  'watermelon',
].map((text) => ({
  id: `powerup0-unit3-${text}`,
  curriculumId: 'powerup-0',
  unitId: 'unit-3',
  text,
  assets: { image: `/images/${text}.svg`, audio: `/audio/${text}.mp3` },
  source: {
    kind: 'CURRICULUM',
    reference: 'Cambridge Power Up 0, Unit 3: Food shopping, Vocabulary 1',
    page: '28',
  },
}));
export const demoContent: LearningContent[] = ['pear', 'apple', 'orange'].map(
  (text) => ({
    id: `demo-${text}`,
    curriculumId: 'demo',
    unitId: 'fruit-sampler',
    text,
    assets: { image: `/images/${text}.svg`, audio: `/audio/${text}.mp3` },
    source: {
      kind: 'DEMO',
      reference:
        'Independent content-reuse fixture, not official textbook content',
    },
  }),
);
export const allContent = [...curriculumContent, ...demoContent];
export function definitionFor(mode: 'CURRICULUM' | 'DEMO'): GameDefinition {
  const items = mode === 'CURRICULUM' ? curriculumContent : demoContent;
  return {
    id: mode === 'CURRICULUM' ? 'powerup0-listen-find' : 'fruit-sampler',
    version: '1.0.0',
    schemaVersion: '1.0.0',
    name: 'Listen & Find',
    scene: {
      id: 'fruit-world',
      version: '1.0.0',
      config: { theme: mode === 'CURRICULUM' ? 'ORCHARD' : 'FOREST' },
    },
    mechanic: {
      id: 'tap',
      version: '1.0.0',
      config: { selectionMode: 'SINGLE' },
    },
    content: {
      curriculumId: items[0]!.curriculumId,
      unitId: items[0]!.unitId,
      items: items.map((content) => ({ contentId: content.id })),
    },
    input: { allowed: ['MOUSE', 'TOUCH'] },
    rules: {
      rounds: 5,
      allowRetry: true,
      timeLimitMs: null,
      hintPolicy: { enabled: true, afterAttempts: 0, hintLevel: 1 },
      progression: { mode: 'RANDOM' },
    },
    reward: { type: 'STAR', successReward: 1, completionBonus: 1 },
    difficulty: { optionCount: 3 },
  };
}

import type { ArcadeMode, GameDefinition } from '@english/contracts';
import {
  definitionFor,
  levelUnlocked,
  world,
  type WorldLevel,
} from './content';

export const arcadeGames: {
  mode: ArcadeMode;
  title: string;
  tag: string;
  instruction: string;
  icon: string;
}[] = [
  {
    mode: 'picture-pairs',
    title: 'Picture Pairs',
    tag: 'Flip & match',
    instruction: 'Flip two cards. Match two pictures of the word you hear!',
    icon: '🃏',
  },
  {
    mode: 'little-chef',
    title: 'Little Chef',
    tag: 'Drag & cook',
    instruction:
      'Drag the food you hear into the pot, or tap it to send it cooking!',
    icon: '🍲',
  },
  {
    mode: 'word-racers',
    title: 'Word Racers',
    tag: 'Choose a lane',
    instruction:
      'Choose the lane with the word you hear and race to the finish!',
    icon: '🏁',
  },
  {
    mode: 'maze-explorer',
    title: 'Maze Explorer',
    tag: 'Find a path',
    instruction: 'Tap a picture. Find a path through the maze to collect it!',
    icon: '🧭',
  },
  {
    mode: 'sky-jumper',
    title: 'Sky Jumper',
    tag: 'Run & jump',
    instruction:
      'Drag to move. Swipe up or tap the sky to jump to the picture!',
    icon: '☁️',
  },
  {
    mode: 'bubble-pop',
    title: 'Bubble Pop',
    tag: 'Aim & pop',
    instruction:
      'Tap a moving bubble to launch a star at the picture you hear!',
    icon: '🫧',
  },
  {
    mode: 'word-golf',
    title: 'Word Golf',
    tag: 'Aim & putt',
    instruction:
      'Swipe toward the picture you hear. A longer swipe hits farther!',
    icon: '⛳',
  },
  {
    mode: 'little-builders',
    title: 'Little Builders',
    tag: 'Lift & build',
    instruction:
      'Tap the material you hear. Lift it over and build a new floor!',
    icon: '🏗️',
  },
  {
    mode: 'garden-guardians',
    title: 'Garden Guardians',
    tag: 'Stop the clouds',
    instruction:
      'Tap the guardian with the word you hear to splash its grumpy cloud!',
    icon: '🌻',
  },
  {
    mode: 'power-quest',
    title: 'Power Quest',
    tag: 'Take your turn',
    instruction:
      'Choose the power card you hear and watch your hero take a turn!',
    icon: '⚡',
  },
];

export const arcadeGame = (mode: ArcadeMode) =>
  arcadeGames.find((game) => game.mode === mode)!;

/** The next unlocked story stop is the child's current learning goal. */
export function nextArcadeLevel(
  stars: Record<string, number>,
  preferred?: WorldLevel,
) {
  if (
    preferred?.game &&
    definitionFor(preferred.game).mechanic.id !== 'count-pack'
  )
    return preferred;
  const open = world.levels.filter((level) => {
    if (!level.chapter || !level.game || !levelUnlocked(level, stars))
      return false;
    return definitionFor(level.game).mechanic.id !== 'count-pack';
  });
  return open.find((level) => (stars[level.id] ?? 0) === 0) ?? open.at(-1);
}

/** Only presentation and input change. Content, rewards and rules come from the stop. */
export function arcadeDefinition(
  level: WorldLevel,
  mode: ArcadeMode,
): GameDefinition {
  const base = definitionFor(level.game!);
  if (base.mechanic.id === 'count-pack')
    throw new Error('Count & Pack uses its own quantity mechanic');
  const theme = ['MARKET', 'FOREST', 'HARBOUR'].includes(
    String(base.scene.config.theme),
  )
    ? base.scene.config.theme
    : 'MARKET';
  return {
    ...base,
    id: `${base.id}--${mode}`,
    name: arcadeGame(mode).title,
    description: arcadeGame(mode).instruction,
    scene: { id: 'arcade-world', version: '1.0.0', config: { theme } },
    mechanic: { id: 'arcade', version: '1.0.0', config: { mode } },
    input: { allowed: ['TOUCH', 'MOUSE', 'KEYBOARD'] },
    difficulty: {
      optionCount: Math.min(
        base.difficulty?.optionCount ?? 3,
        mode === 'word-racers' ? 3 : 4,
      ),
    },
  };
}

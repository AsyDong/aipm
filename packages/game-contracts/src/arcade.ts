import type { SceneObject } from './game';

/** Small, local adaptations of established game loops; no curriculum lives here. */
export const ARCADE_MODES = [
  'picture-pairs',
  'little-chef',
  'word-racers',
  'maze-explorer',
  'sky-jumper',
  'bubble-pop',
  'word-golf',
  'little-builders',
  'garden-guardians',
  'power-quest',
] as const;
export type ArcadeMode = (typeof ARCADE_MODES)[number];

/** The renderer reports an action; the mechanic and shared rules judge it. */
export type ArcadeAnswer = 'CORRECT' | 'RETRY';
export type ArcadeAction = (object: SceneObject) => ArcadeAnswer | false;

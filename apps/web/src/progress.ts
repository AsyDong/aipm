import type { GameDefinition } from '@english/contracts';

/** Stars per level, kept only on this device (no account, no learning record). */
const KEY = 'english-adventure:stars';

export function loadStars(): Record<string, number> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return {};
    const stars = Object.fromEntries(
      Object.entries(raw).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' &&
          Number.isFinite(entry[1]) &&
          entry[1] >= 0,
      ),
    );
    for (const [oldId, newId] of [
      ['voice-market', 'talking-market'],
      ['waterfall', 'fruit-kitchen'],
    ] as const) {
      if (stars[oldId] !== undefined)
        stars[newId] = Math.max(stars[newId] ?? 0, stars[oldId]);
    }
    return stars;
  } catch {
    return {};
  }
}

export function saveStars(levelId: string, stars: number) {
  const all = loadStars();
  all[levelId] = Math.max(all[levelId] ?? 0, stars);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: progress is simply not remembered */
  }
  return all;
}

/** 0-3 stars on the map: a finished level always shows at least one. */
export const mapStars = (earned: number, total: number) =>
  earned <= 0 ? 0 : Math.max(1, Math.min(3, Math.round((earned / total) * 3)));

export const gameStars = (earned: number, game: GameDefinition) =>
  mapStars(
    earned,
    (game.rules.rounds ?? 1) * game.reward.successReward +
      (game.reward.completionBonus ?? 0),
  );

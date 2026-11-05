/** Stars per level, kept only on this device (no account, no learning record). */
const KEY = 'english-adventure:stars';

export function loadStars(): Record<string, number> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return {};
    return Object.fromEntries(
      Object.entries(raw).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      ),
    );
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

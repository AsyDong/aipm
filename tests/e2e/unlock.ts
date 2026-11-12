import type { Page } from '@playwright/test';
import world from '../../apps/web/src/data/world.json';

/** Seed only this test browser's prerequisites; real progress still wins on reload. */
export async function unlockBefore(page: Page, title: string) {
  const targetIndex = world.levels.findIndex((level) => level.title === title);
  if (targetIndex < 0) throw new Error(`Unknown level: ${title}`);
  const target = world.levels[targetIndex]!;
  const stars = Object.fromEntries(
    world.levels
      .slice(0, targetIndex)
      .filter(
        (level) =>
          level.game && (level.chapter || level.unitId === target.unitId),
      )
      .map((level) => [level.id, 1]),
  );
  await page.addInitScript((fixture) => {
    const key = 'english-adventure:stars';
    const current = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<
      string,
      number
    >;
    localStorage.setItem(key, JSON.stringify({ ...fixture, ...current }));
  }, stars);
}

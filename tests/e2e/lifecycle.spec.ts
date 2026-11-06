import { test, expect } from '@playwright/test';

test('repeated scene and mechanic switches release all managed asset URLs and canvases', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const live = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      live.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      live.delete(url);
      revoke(url);
    };
    Object.assign(window, { liveAssetCount: () => live.size });
  });
  await page.goto('/');
  for (const name of [
    'Fruit Market',
    'Woodland',
    'Waterfall',
    'Talking Market',
    'Fruit Market',
    'Waterfall',
  ]) {
    await page.getByRole('button', { name: `Play ${name}` }).click();
    await expect(
      page.getByRole('button', { name: 'Let’s play' }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Back to the map' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { liveAssetCount(): number }).liveAssetCount(),
        ),
      )
      .toBe(0);
  }
  expect(errors).toEqual([]);
});

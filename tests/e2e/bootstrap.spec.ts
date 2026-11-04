import { test, expect } from '@playwright/test';

test('canvas communicates and survives repeated mount/unmount', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  for (let cycle = 0; cycle < 3; cycle++) {
    await expect(page.getByRole('status')).toHaveText('Ready to explore');
    await expect(page.locator('canvas')).toHaveCount(1);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    expect(
      await canvas.evaluate((element) => (element as HTMLCanvasElement).width),
    ).toBe(960);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Paused');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Ready to explore');
    await page.getByRole('button', { name: 'Close preview' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open preview' }).click();
  }
  await expect(page.getByRole('status')).toHaveText('Ready to explore');
  expect(errors).toEqual([]);
});

test('closing during async initialization leaves no canvas', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.getByRole('status')).toHaveText('Ready to explore');
  await expect(page.locator('canvas')).toHaveCount(1);
});

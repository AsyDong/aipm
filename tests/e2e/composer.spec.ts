import { test, expect } from '@playwright/test';

test('composer validates, saves, imports and previews a locally composed tap level', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Game Composer for grown-ups' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Game Composer' }),
  ).toBeVisible();
  await page.getByLabel('Title').fill('My Forest Practice');
  await page.getByLabel('Theme').selectOption('FOREST');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Configuration and assets are valid.',
  );
  await page.getByRole('button', { name: 'Save level' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Level saved on this device.',
  );
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'My Forest Practice' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Let’s play' }).click();
  await expect(page.getByRole('status')).toHaveText('Which one is it?');
});
